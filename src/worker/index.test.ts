import { describe, expect, it } from 'vitest'

import { createTestDatabase } from '@/test/d1'
import { installGoogleIdentity } from '@/test/google'
import type { Env } from './env'
import worker from './index'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const OWNER_EMAIL = 'owner@example.com'
const SERVICE_TOKEN = 'test-service-token'

const VALID_PROFILE = {
  weight: 78,
  height: 178,
  sex: 'm',
  birthDate: '1990-04-12',
  targetKcal: 2200,
}

const EMPTY_PROFILE = {
  weight: null,
  height: null,
  sex: null,
  birthDate: null,
  targetKcal: null,
}

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    GOOGLE_CLIENT_ID: CLIENT_ID,
    ALLOWED_EMAIL: OWNER_EMAIL,
  } as unknown as Env
}

function call(env: Env, path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`https://crumbs.test${path}`, init), env)
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

function jsonAuth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function seedUser(env: Env, id = 'user-1', email = OWNER_EMAIL): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, created_at) VALUES (?, ?, 'Owner', '2026-01-01T00:00:00.000Z')",
  )
    .bind(id, email)
    .run()
}

describe('worker routes', () => {
  it('serves the public health route', async () => {
    const response = await call(testEnv(), '/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('applies the schema migrations from scratch', async () => {
    const env = testEnv()

    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all<{ name: string }>()
    const names = tables.results.map((row) => row.name)

    expect(names).toEqual(
      expect.arrayContaining(['users', 'profiles', 'foods', 'meals', 'meal_items', 'api_cache']),
    )

    const mealColumns = await env.DB.prepare('PRAGMA table_info(meals)').all<{ name: string }>()
    expect(mealColumns.results.map((row) => row.name)).toContain('local_date')
  })

  it('creates the diary indexes and the foods uniqueness rules', async () => {
    const env = testEnv()
    await seedUser(env)

    const indexes = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index'",
    ).all<{ name: string }>()
    const names = indexes.results.map((row) => row.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'idx_meals_user_date',
        'idx_foods_user_last_used',
        'idx_meal_items_meal',
        'idx_foods_user_source',
        'idx_foods_user_name',
      ]),
    )

    const insert = (source: string, sourceId: string | null, name: string) =>
      env.DB.prepare(
        'INSERT INTO foods (id, user_id, name, source, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(`food-${name}-${sourceId}`, 'user-1', name, source, sourceId, 'now', 'now')
        .run()

    await insert('off', '123', 'Pane')
    await expect(insert('off', '123', 'Pane due')).rejects.toThrow()
    await insert('manual', null, 'Torta')
    await expect(insert('manual', null, ' torta ')).rejects.toThrow()
  })

  it('requires a credential for every API route except health', async () => {
    const env = testEnv()

    const missing = await call(env, '/api/profile')
    expect(missing.status).toBe(401)

    const invalid = await call(env, '/api/profile', { headers: bearer('not-a-token') })
    expect(invalid.status).toBe(401)

    const unknown = await call(env, '/api/unknown', { headers: bearer('not-a-token') })
    expect(unknown.status).toBe(401)
  })

  it('resolves the service token to the allowed email user', async () => {
    const env = testEnv()

    const missing = await call(env, '/api/profile', { headers: bearer(SERVICE_TOKEN) })
    expect(missing.status).toBe(403)
    const body = (await missing.json()) as { error: string }
    expect(body.error).toContain('Google')

    await seedUser(env)
    const response = await call(env, '/api/profile', { headers: bearer(SERVICE_TOKEN) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(EMPTY_PROFILE)
  })

  it('creates the user row on the first google request and updates it later', async () => {
    const env = testEnv()
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)

    const first = await call(env, '/api/me', {
      headers: bearer(await identity.sign()),
    })
    expect(first.status).toBe(200)

    const afterFirst = await env.DB.prepare(
      "SELECT id, email, name, picture, created_at FROM users",
    ).all<Record<string, unknown>>()
    expect(afterFirst.results).toEqual([
      {
        id: 'google-user-1',
        email: OWNER_EMAIL,
        name: 'Proprietario',
        picture: 'https://example.com/avatar.png',
        created_at: expect.any(String),
      },
    ])
    const createdAt = afterFirst.results[0]!.created_at

    const second = await call(env, '/api/me', {
      headers: bearer(
        await identity.sign({ name: 'Proprietario Due', picture: 'https://example.com/new.png' }),
      ),
    })
    expect(second.status).toBe(200)

    const afterSecond = await env.DB.prepare(
      'SELECT id, name, picture, created_at FROM users',
    ).all<Record<string, unknown>>()
    expect(afterSecond.results).toEqual([
      {
        id: 'google-user-1',
        name: 'Proprietario Due',
        picture: 'https://example.com/new.png',
        created_at: createdAt,
      },
    ])
  })

  it('returns null fields before the profile is saved', async () => {
    const env = testEnv()
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)

    const response = await call(env, '/api/profile', {
      headers: bearer(await identity.sign()),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(EMPTY_PROFILE)
  })

  it('round-trips the profile through PUT and GET', async () => {
    const env = testEnv()
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const token = await identity.sign()

    const saved = await call(env, '/api/profile', {
      method: 'PUT',
      headers: jsonAuth(token),
      body: JSON.stringify(VALID_PROFILE),
    })
    expect(saved.status).toBe(200)

    const read = await call(env, '/api/profile', { headers: bearer(token) })
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual(VALID_PROFILE)
  })

  it('rejects invalid profile values without writing', async () => {
    const env = testEnv()
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const token = await identity.sign()

    await call(env, '/api/profile', {
      method: 'PUT',
      headers: jsonAuth(token),
      body: JSON.stringify(VALID_PROFILE),
    })

    const invalidValues: Record<string, unknown>[] = [
      { ...VALID_PROFILE, weight: 29 },
      { ...VALID_PROFILE, weight: 301 },
      { ...VALID_PROFILE, height: 99 },
      { ...VALID_PROFILE, height: 251 },
      { ...VALID_PROFILE, sex: 'x' },
      { ...VALID_PROFILE, birthDate: '2099-01-01' },
      { ...VALID_PROFILE, birthDate: '1990-02-30' },
      { ...VALID_PROFILE, targetKcal: 799 },
      { ...VALID_PROFILE, targetKcal: 6001 },
    ]

    for (const body of invalidValues) {
      const response = await call(env, '/api/profile', {
        method: 'PUT',
        headers: jsonAuth(token),
        body: JSON.stringify(body),
      })
      expect(response.status, JSON.stringify(body)).toBe(400)
      const payload = (await response.json()) as { error?: unknown }
      expect(typeof payload.error).toBe('string')
    }

    const read = await call(env, '/api/profile', { headers: bearer(token) })
    expect(await read.json()).toEqual(VALID_PROFILE)
  })

  it('rejects a malformed profile body', async () => {
    const env = testEnv()
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)

    const response = await call(env, '/api/profile', {
      method: 'PUT',
      headers: jsonAuth(await identity.sign()),
      body: '{',
    })

    expect(response.status).toBe(400)
  })
})
