import { describe, expect, it } from 'vitest'

import { createTestDatabase } from '@/test/d1'
import type { Env } from './env'
import worker from './index'

const SERVICE_TOKEN = 'test-service-token'

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    GOOGLE_CLIENT_ID: '',
    ALLOWED_EMAIL: '',
  } as unknown as Env
}

function call(env: Env, path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`https://crumbs.test${path}`, init), env)
}

describe('worker routes', () => {
  it('serves the public health route', async () => {
    const response = await call(testEnv(), '/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('has the schema from the migrations applied to the test database', async () => {
    const env = testEnv()

    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meals'",
    ).all()

    expect(results).toEqual([{ name: 'meals' }])
  })

  it('requires a credential for the meals route', async () => {
    const response = await call(testEnv(), '/api/meals')

    expect(response.status).toBe(401)
  })

  it('reads meals from the test database through the route', async () => {
    const env = testEnv()

    const response = await call(env, '/api/meals', {
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ meals: [] })
  })
})
