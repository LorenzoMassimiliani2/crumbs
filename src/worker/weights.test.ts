import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestDatabase } from '@/test/d1'
import type { Env } from './env'
import worker from './index'

const SERVICE_TOKEN = 'test-service-token'
const OWNER_EMAIL = 'owner@example.com'

const PROFILE = {
  weight: 78,
  height: 178,
  sex: 'm',
  birthDate: '1990-04-12',
  targetKcal: 2200,
}

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    ALLOWED_EMAIL: OWNER_EMAIL,
  } as unknown as Env
}

function call(env: Env, method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${SERVICE_TOKEN}` } }
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return worker.fetch(new Request(`https://crumbs.test${path}`, init), env)
}

async function seedUser(env: Env, id = 'user-1', email = OWNER_EMAIL): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, created_at) VALUES (?, ?, 'Owner', '2026-01-01T00:00:00.000Z')",
  )
    .bind(id, email)
    .run()
}

async function seedProfile(env: Env, overrides: Record<string, unknown> = {}): Promise<void> {
  const response = await call(env, 'PUT', '/api/profile', { ...PROFILE, ...overrides })
  expect(response.status).toBe(200)
}

async function profileWeight(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT weight_kg AS weight FROM profiles WHERE user_id = ?')
    .bind('user-1')
    .first<{ weight: number }>()
  return row!.weight
}

async function getWeights(env: Env, query = '?today=2026-11-05'): Promise<{ date: string; weight: number }[]> {
  const response = await call(env, 'GET', `/api/weights${query}`)
  expect(response.status).toBe(200)
  return (await response.json()) as { date: string; weight: number }[]
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/weights', () => {
  it('returns an empty log when there is no profile weight to seed', async () => {
    expect(await getWeights(env)).toEqual([])
  })

  it('seeds the profile weight on today only once', async () => {
    await seedProfile(env)

    expect(await getWeights(env)).toEqual([{ date: '2026-11-05', weight: 78 }])
    expect(await getWeights(env, '?today=2026-11-06')).toEqual([
      { date: '2026-11-05', weight: 78 },
    ])
  })

  it('does not reseed after every measurement is deleted', async () => {
    await seedProfile(env)
    await getWeights(env)

    await env.DB.prepare('DELETE FROM weight_entries WHERE user_id = ?').bind('user-1').run()

    expect(await getWeights(env, '?today=2026-12-01')).toEqual([])
  })

  it('falls back to the UTC date when today is missing or not a real date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-09T22:30:00.000Z'))
    await seedProfile(env)

    expect(await getWeights(env, '')).toEqual([{ date: '2026-03-09', weight: 78 }])
    await env.DB.prepare('DELETE FROM weight_entries').run()
    await env.DB.prepare('UPDATE users SET weights_seeded = 0').run()
    expect(await getWeights(env, '?today=2026-02-30')).toEqual([
      { date: '2026-03-09', weight: 78 },
    ])
  })

  it('returns the measurements in ascending date order', async () => {
    await call(env, 'PUT', '/api/weights/2026-11-03', { weight: 80 })
    await call(env, 'PUT', '/api/weights/2026-10-01', { weight: 82 })
    await call(env, 'PUT', '/api/weights/2026-11-01', { weight: 81 })

    expect(await getWeights(env)).toEqual([
      { date: '2026-10-01', weight: 82 },
      { date: '2026-11-01', weight: 81 },
      { date: '2026-11-03', weight: 80 },
    ])
  })

  it('only returns the measurements of the authenticated user', async () => {
    await seedUser(env, 'user-2', 'other@example.com')
    await env.DB.prepare(
      `INSERT INTO weight_entries (id, user_id, measured_on, weight_kg, created_at, updated_at)
       VALUES ('foreign', 'user-2', '2026-11-05', 95, '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z')`,
    ).run()

    expect(await getWeights(env)).toEqual([])
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(new Request('https://crumbs.test/api/weights'), env)
    expect(response.status).toBe(401)
  })
})

describe('PUT /api/weights/:date', () => {
  it('creates a measurement and returns it', async () => {
    const response = await call(env, 'PUT', '/api/weights/2026-11-05', { weight: 77.4 })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ date: '2026-11-05', weight: 77.4 })

    expect(await getWeights(env)).toEqual([{ date: '2026-11-05', weight: 77.4 }])
  })

  it('updates the measurement of the same date without duplicating it', async () => {
    await call(env, 'PUT', '/api/weights/2026-11-05', { weight: 77.4 })
    const response = await call(env, 'PUT', '/api/weights/2026-11-05', { weight: 77.1 })
    expect(response.status).toBe(200)

    const rows = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM weight_entries WHERE user_id = ?',
    )
      .bind('user-1')
      .first<{ n: number }>()
    expect(rows?.n).toBe(1)
    expect(await getWeights(env)).toEqual([{ date: '2026-11-05', weight: 77.1 }])
  })

  it('rejects an unreal date, a non numeric weight and weights outside 30-300', async () => {
    const bodies: unknown[] = [
      'abc',
      null,
      {},
      { weight: 'abc' },
      { weight: 29.9 },
      { weight: 300.1 },
    ]
    for (const body of bodies) {
      const response = await call(env, 'PUT', '/api/weights/2026-11-05', body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect((await response.json()) as { error: string }).toEqual({
        error: expect.any(String),
      })
    }

    const unrealDate = await call(env, 'PUT', '/api/weights/2026-02-30', { weight: 70 })
    expect(unrealDate.status).toBe(400)

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM weight_entries').first<{ n: number }>()
    expect(row?.n).toBe(0)
  })

  it('keeps the profile weight cache on the latest measurement', async () => {
    await seedProfile(env)

    await call(env, 'PUT', '/api/weights/2026-11-05', { weight: 79 })
    expect(await profileWeight(env)).toBe(79)

    // A retroactive measurement does not move the current weight.
    await call(env, 'PUT', '/api/weights/2026-10-01', { weight: 75 })
    expect(await profileWeight(env)).toBe(79)

    await call(env, 'PUT', '/api/weights/2026-11-05', { weight: 78.5 })
    expect(await profileWeight(env)).toBe(78.5)
  })

  it('keeps the last known profile weight when no measurement remains', async () => {
    await seedProfile(env)
    await getWeights(env)
    await call(env, 'PUT', '/api/weights/2026-11-05', { weight: 74 })
    expect(await profileWeight(env)).toBe(74)

    await env.DB.prepare('DELETE FROM weight_entries WHERE user_id = ?').bind('user-1').run()

    expect(await getWeights(env, '?today=2026-12-01')).toEqual([])
    expect(await profileWeight(env)).toBe(74)
  })

  it('updates only the authenticated user measurement on a shared date', async () => {
    await seedUser(env, 'user-2', 'other@example.com')
    await env.DB.prepare(
      `INSERT INTO weight_entries (id, user_id, measured_on, weight_kg, created_at, updated_at)
       VALUES ('foreign', 'user-2', '2026-11-05', 95, '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z')`,
    ).run()

    await call(env, 'PUT', '/api/weights/2026-11-05', { weight: 70 })

    const foreign = await env.DB.prepare(
      "SELECT weight_kg FROM weight_entries WHERE id = 'foreign'",
    ).first<{ weight_kg: number }>()
    expect(foreign?.weight_kg).toBe(95)
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/weights/2026-11-05', { method: 'PUT' }),
      env,
    )
    expect(response.status).toBe(401)
  })
})
