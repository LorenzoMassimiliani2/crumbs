import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchStub } from '@/test/fetch'
import { type WeightEntry } from '@/lib/weight'
import WeightView from './WeightView.vue'

function json(entries: WeightEntry[]): Response {
  return Response.json(entries)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T09:30:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('WeightView', () => {
  it('asks for the local date and shows the empty state with a ready form', async () => {
    fetchStub().intercept(/\/api\/weights/, () => json([]))

    const wrapper = mount(WeightView)
    await flushPromises()

    const request = fetchStub().requests.find((entry) => entry.url.includes('/api/weights'))
    expect(new URL(request!.url).searchParams.get('today')).toBe('2026-11-05')

    expect(wrapper.text()).toContain('Nessuna misura')
    expect((wrapper.get('#weight-date').element as HTMLInputElement).value).toBe('2026-11-05')
    expect((wrapper.get('#weight-value').element as HTMLInputElement).value).toBe('')
    expect(wrapper.get('[data-testid="current-weight"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="weight-change"]').text()).toContain('—')
  })

  it('shows the current weight, the last date and the change from the previous entry', async () => {
    fetchStub().intercept(/\/api\/weights/, () =>
      json([
        { date: '2026-10-01', weight: 80 },
        { date: '2026-11-01', weight: 79.5 },
        { date: '2026-11-05', weight: 78 },
      ]),
    )

    const wrapper = mount(WeightView)
    await flushPromises()

    expect(wrapper.get('[data-testid="current-weight"]').text()).toContain('78,0')
    expect(wrapper.get('[data-testid="last-date"]').text()).toContain('5 novembre 2026')
    expect(wrapper.get('[data-testid="weight-change"]').text()).toContain('-1,5 kg')
  })

  it('lists the ten most recent measurements from the newest, read only', async () => {
    const entries: WeightEntry[] = Array.from({ length: 12 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      weight: 80 + index / 10,
    }))
    fetchStub().intercept(/\/api\/weights/, () => json(entries))

    const wrapper = mount(WeightView)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="weight-entry"]')
    expect(rows).toHaveLength(10)
    expect(rows[0]!.text()).toContain('12 ottobre 2026')
    expect(rows[0]!.text()).toContain('81,1')
    expect(rows[9]!.text()).toContain('3 ottobre 2026')
    expect(wrapper.findAll('[data-testid="weight-entry"] input')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="weight-entry"] button')).toHaveLength(0)
  })

  it('saves a new measurement and refreshes the shown values', async () => {
    let entries: WeightEntry[] = [{ date: '2026-11-01', weight: 79 }]
    let sentBody: unknown
    fetchStub()
      .intercept((request) => request.method === 'PUT', async (request) => {
        sentBody = await request.json()
        const { weight } = sentBody as { weight: number }
        entries = [...entries, { date: '2026-11-05', weight }]
        return Response.json(entries.at(-1))
      })
      .intercept(/\/api\/weights/, () => json(entries))

    const wrapper = mount(WeightView)
    await flushPromises()

    await wrapper.get('#weight-value').setValue('78.4')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const put = fetchStub().requests.find((request) => request.method === 'PUT')
    expect(new URL(put!.url).pathname).toBe('/api/weights/2026-11-05')
    expect(sentBody).toEqual({ weight: 78.4 })

    expect(wrapper.get('[data-testid="current-weight"]').text()).toContain('78,4')
    expect(wrapper.get('[data-testid="weight-change"]').text()).toContain('-0,6 kg')
    expect(wrapper.findAll('[data-testid="weight-entry"]')).toHaveLength(2)
  })

  it('sends the chosen date and shows the server error when the save is rejected', async () => {
    fetchStub()
      .intercept((request) => request.method === 'PUT', () =>
        Response.json({ error: 'Il peso deve essere compreso tra 30 e 300 kg.' }, { status: 400 }),
      )
      .intercept(/\/api\/weights/, () => json([]))

    const wrapper = mount(WeightView)
    await flushPromises()

    await wrapper.get('#weight-date').setValue('2026-10-31')
    await wrapper.get('#weight-value').setValue('500')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const put = fetchStub().requests.find((request) => request.method === 'PUT')
    expect(new URL(put!.url).pathname).toBe('/api/weights/2026-10-31')
    expect(wrapper.get('[role="alert"]').text()).toContain('tra 30 e 300')
  })

  it('draws the loaded measurements on the chart and refreshes it after a new one', async () => {
    let entries: WeightEntry[] = [
      { date: '2026-10-01', weight: 80 },
      { date: '2026-11-01', weight: 79 },
    ]
    fetchStub()
      .intercept((request) => request.method === 'PUT', async (request) => {
        const { weight } = (await request.json()) as { weight: number }
        entries = [...entries, { date: '2026-11-05', weight }]
        return Response.json(entries.at(-1))
      })
      .intercept(/\/api\/weights/, () => json(entries))

    const wrapper = mount(WeightView)
    await flushPromises()

    expect(wrapper.findAll('circle')).toHaveLength(2)

    await wrapper.get('#weight-value').setValue('78')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.findAll('circle')).toHaveLength(3)
  })
})
