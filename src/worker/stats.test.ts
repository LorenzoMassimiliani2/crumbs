import { beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase } from '@/test/d1'
import { installGoogleIdentity } from '@/test/google'
import type { Env } from './env'
import worker from './index'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const OWNER_EMAIL = 'owner@example.com'
const SERVICE_TOKEN = 'test-service-token'

const PANE = {
  name: 'Pane',
  source: 'off',
  sourceId: '123',
  brand: 'Forno',
  grams: 150,
  per100g: { kcal: 356, protein: 12, carbs: 70, fat: 1.5, fiber: 3, sugar: 2, salt: 1 },
}

const MELA = {
  name: 'Mela',
  source: 'manual',
  sourceId: null,
  brand: null,
  grams: 100,
  per100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, salt: 0 },
}

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    GOOGLE_CLIENT_ID: CLIENT_ID,
    ALLOWED_EMAIL: OWNER_EMAIL,
  } as unknown as Env
}

function call(env: Env, method: string, path: string, body?: unknown, token = SERVICE_TOKEN) {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } }
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
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

async function addMeal(
  env: Env,
  localDate: string,
  type: string,
  items: unknown[] = [PANE],
  token = SERVICE_TOKEN,
): Promise<string> {
  const response = await call(
    env,
    'POST',
    '/api/meals',
    { occurredAt: `${localDate}T12:30:00.000Z`, localDate, type, items },
    token,
  )
  expect(response.status).toBe(201)
  return ((await response.json()) as { id: string }).id
}

function addDays(date: string, offset: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const value = new Date(Date.UTC(year, month - 1, day + offset))
  return value.toISOString().slice(0, 10)
}

interface StatsBody {
  targetKcal: number | null
  days: { date: string; kcal: number; meals: number }[]
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
})

describe('GET /api/stats', () => {
  it('returns the current target and one ascending entry per day with non-deleted meals', async () => {
    await call(env, 'PUT', '/api/profile', {
      height: 178,
      sex: 'm',
      birthDate: '1990-04-12',
      targetKcal: 2200,
    })

    await addMeal(env, '2026-11-06', 'cena')
    await addMeal(env, '2026-11-04', 'pranzo')
    await addMeal(env, '2026-11-04', 'colazione', [MELA])

    const response = await call(env, 'GET', '/api/stats?from=2026-10-20&to=2026-11-09')
    expect(response.status).toBe(200)

    const body = (await response.json()) as StatsBody
    expect(body.targetKcal).toBe(2200)
    expect(body.days.map((day) => day.date)).toEqual(['2026-11-04', '2026-11-06'])
    expect(body.days[0]!.meals).toBe(2)
    expect(body.days[1]!.meals).toBe(1)
    // 534 kcal (pane 150 g) + 52 kcal (mela 100 g)
    expect(body.days[0]!.kcal).toBe(586)
    expect(body.days[1]!.kcal).toBe(534)
  })

  it('reports a day kcal identical to the day view totals', async () => {
    await addMeal(env, '2026-11-05', 'pranzo', [PANE])
    await addMeal(env, '2026-11-05', 'cena', [MELA, { ...PANE, grams: 37 }])

    const stats = (await (
      await call(env, 'GET', '/api/stats?from=2026-11-05&to=2026-11-05')
    ).json()) as StatsBody
    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      totals: { kcal: number }
    }

    expect(stats.days).toHaveLength(1)
    expect(stats.days[0]!.kcal).toBe(day.totals.kcal)
  })

  it('ignores deleted meals and days without meals, and only reads the requested range', async () => {
    const removed = await addMeal(env, '2026-11-05', 'pranzo')
    await call(env, 'DELETE', `/api/meals/${removed}`)
    await addMeal(env, '2026-11-07', 'pranzo')
    await addMeal(env, '2026-11-20', 'pranzo')

    const body = (await (
      await call(env, 'GET', '/api/stats?from=2026-11-01&to=2026-11-10')
    ).json()) as StatsBody

    expect(body.days).toEqual([{ date: '2026-11-07', kcal: 534, meals: 1 }])
  })

  it('returns a null target when the profile has none', async () => {
    await addMeal(env, '2026-11-05', 'pranzo')

    const body = (await (
      await call(env, 'GET', '/api/stats?from=2026-11-01&to=2026-11-10')
    ).json()) as StatsBody
    expect(body.targetKcal).toBeNull()
  })

  it('does not leak meals of another user', async () => {
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const otherToken = await identity.sign({ sub: 'user-2' })
    await addMeal(env, '2026-11-05', 'pranzo', [PANE], otherToken)
    await addMeal(env, '2026-11-05', 'cena')

    const body = (await (
      await call(env, 'GET', '/api/stats?from=2026-11-01&to=2026-11-10')
    ).json()) as StatsBody
    expect(body.days).toEqual([{ date: '2026-11-05', kcal: 534, meals: 1 }])
  })

  it('accepts a range of 800 days and rejects one day more', async () => {
    const from = '2024-01-01'
    const maxTo = addDays(from, 799)

    expect((await call(env, 'GET', `/api/stats?from=${from}&to=${maxTo}`)).status).toBe(200)
    expect((await call(env, 'GET', `/api/stats?from=${from}&to=${addDays(from, 800)}`)).status).toBe(
      400,
    )
  })

  it('rejects missing or unreal dates and a reversed range', async () => {
    const paths = [
      '/api/stats',
      '/api/stats?from=2026-11-01',
      '/api/stats?to=2026-11-01',
      '/api/stats?from=2026-02-30&to=2026-11-01',
      '/api/stats?from=2026-11-10&to=2026-11-01',
    ]

    for (const path of paths) {
      const response = await call(env, 'GET', path)
      expect(response.status, path).toBe(400)
      expect(typeof ((await response.json()) as { error?: unknown }).error).toBe('string')
    }
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/stats?from=2026-11-01&to=2026-11-10'),
      env,
    )
    expect(response.status).toBe(401)
  })
})
