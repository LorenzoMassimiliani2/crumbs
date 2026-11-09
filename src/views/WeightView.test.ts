import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearToasts, toasts } from '@/composables/useToast'
import { fetchStub } from '@/test/fetch'
import { type WeightEntry } from '@/lib/weight'
import WeightView from './WeightView.vue'

function json(entries: WeightEntry[]): Response {
  return Response.json(entries)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T09:30:00Z'))
  clearToasts()
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

  it('keeps the quick form collapsed until the CTA is pressed', async () => {
    fetchStub().intercept(/\/api\/weights/, () => json([{ date: '2026-11-05', weight: 78 }]))

    const wrapper = mount(WeightView)
    await flushPromises()

    const panel = wrapper.get('[data-testid="weight-form-panel"]')
    expect(panel.element.getAttribute('style')).toContain('display: none')
    await wrapper.get('[data-testid="open-weight-form"]').trigger('click')
    expect(panel.element.getAttribute('style') ?? '').not.toContain('display: none')
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
    expect(wrapper.get('[data-testid="last-date"]').text()).toContain('oggi')
    expect(wrapper.get('[data-testid="weight-change"]').text()).toContain('-1,5 kg')
  })

  it('lists the ten most recent measurements from the newest', async () => {
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
    expect(wrapper.findAll('[data-testid="weight-entry"] button')).toHaveLength(20)
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
    expect(toasts.value.some((toast) => toast.message.includes('tra 30 e 300'))).toBe(true)
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

function entryRow(wrapper: ReturnType<typeof mount>, date: string) {
  return wrapper
    .findAll('[data-testid="weight-entry"]')
    .find((row) => row.text().includes(date))!
}

describe('WeightView editing and deleting measurements', () => {
  it('offers an edit and a delete command on every row', async () => {
    fetchStub().intercept(/\/api\/weights/, () =>
      json([
        { date: '2026-11-01', weight: 79 },
        { date: '2026-11-05', weight: 78 },
      ]),
    )

    const wrapper = mount(WeightView)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="edit-weight"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="delete-weight"]')).toHaveLength(2)
  })

  it('opens the edit form with the saved date and weight and updates that measurement', async () => {
    const entries: WeightEntry[] = [{ date: '2026-11-01', weight: 79 }]
    fetchStub()
      .intercept((request) => request.method === 'PUT', async (request) => {
        const { weight } = (await request.json()) as { weight: number }
        entries[0] = { date: '2026-11-01', weight }
        return Response.json(entries[0])
      })
      .intercept(/\/api\/weights/, () => json([...entries]))

    const wrapper = mount(WeightView)
    await flushPromises()

    await entryRow(wrapper, '1 novembre 2026')
      .get('[data-testid="edit-weight"]')
      .trigger('click')

    expect((wrapper.get('[data-testid="edit-weight-date"]').element as HTMLInputElement).value).toBe(
      '2026-11-01',
    )
    expect(
      (wrapper.get('[data-testid="edit-weight-value"]').element as HTMLInputElement).value,
    ).toBe('79')

    await wrapper.get('[data-testid="edit-weight-value"]').setValue('78.4')
    await wrapper.get('[data-testid="edit-weight-form"]').trigger('submit')
    await flushPromises()

    const put = fetchStub().requests.find((request) => request.method === 'PUT')
    expect(new URL(put!.url).pathname).toBe('/api/weights/2026-11-01')
    expect(await put!.clone().json()).toEqual({ weight: 78.4 })
    expect(fetchStub().requests.some((request) => request.method === 'DELETE')).toBe(false)

    expect(wrapper.findAll('[data-testid="weight-entry"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="current-weight"]').text()).toContain('78,4')
  })

  it('moves a measurement to a free date by writing the new date and deleting the old one', async () => {
    const entries: WeightEntry[] = [{ date: '2026-11-01', weight: 79 }]
    fetchStub()
      .intercept((request) => request.method === 'PUT', async (request) => {
        const { weight } = (await request.json()) as { weight: number }
        entries.push({ date: '2026-10-20', weight })
        entries.sort((a, b) => a.date.localeCompare(b.date))
        return Response.json({ date: '2026-10-20', weight })
      })
      .intercept((request) => request.method === 'DELETE', (request) => {
        const date = new URL(request.url).pathname.split('/').at(-1)!
        entries.splice(entries.findIndex((entry) => entry.date === date), 1)
        return new Response(null, { status: 204 })
      })
      .intercept(/\/api\/weights/, () => json([...entries]))

    const wrapper = mount(WeightView)
    await flushPromises()

    await entryRow(wrapper, '1 novembre 2026')
      .get('[data-testid="edit-weight"]')
      .trigger('click')
    await wrapper.get('[data-testid="edit-weight-date"]').setValue('2026-10-20')
    await wrapper.get('[data-testid="edit-weight-form"]').trigger('submit')
    await flushPromises()

    const writes = fetchStub().requests.filter(
      (request) => request.method !== 'GET',
    )
    expect(writes.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ['PUT', '/api/weights/2026-10-20'],
      ['DELETE', '/api/weights/2026-11-01'],
    ])
    expect(wrapper.findAll('[data-testid="weight-entry"]')).toHaveLength(1)
  })

  it('asks for confirmation before moving a measurement onto an occupied date and writes nothing if cancelled', async () => {
    const entries: WeightEntry[] = [
      { date: '2026-10-01', weight: 80 },
      { date: '2026-11-05', weight: 78 },
    ]
    fetchStub().intercept(/\/api\/weights/, () => json(entries))

    const wrapper = mount(WeightView)
    await flushPromises()

    await entryRow(wrapper, '5 novembre 2026')
      .get('[data-testid="edit-weight"]')
      .trigger('click')
    await wrapper.get('[data-testid="edit-weight-date"]').setValue('2026-10-01')
    await wrapper.get('[data-testid="edit-weight-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="confirm-overwrite-weight"]').text()).toContain(
      '1 ottobre 2026',
    )
    expect(fetchStub().requests.filter((request) => request.method !== 'GET')).toHaveLength(0)

    await wrapper.get('[data-testid="cancel-overwrite-weight"]').trigger('click')

    expect(wrapper.find('[data-testid="confirm-overwrite-weight"]').exists()).toBe(false)
    expect(fetchStub().requests.filter((request) => request.method !== 'GET')).toHaveLength(0)
  })

  it('overwrites the occupied date only after confirmation and refreshes the view', async () => {
    const entries: WeightEntry[] = [
      { date: '2026-10-01', weight: 80 },
      { date: '2026-11-05', weight: 78 },
    ]
    fetchStub()
      .intercept((request) => request.method === 'PUT', async (request) => {
        const { weight } = (await request.json()) as { weight: number }
        entries[0] = { date: '2026-10-01', weight }
        return Response.json({ date: '2026-10-01', weight })
      })
      .intercept((request) => request.method === 'DELETE', (request) => {
        const date = new URL(request.url).pathname.split('/').at(-1)!
        entries.splice(entries.findIndex((entry) => entry.date === date), 1)
        return new Response(null, { status: 204 })
      })
      .intercept(/\/api\/weights/, () => json([...entries]))

    const wrapper = mount(WeightView)
    await flushPromises()

    await entryRow(wrapper, '5 novembre 2026')
      .get('[data-testid="edit-weight"]')
      .trigger('click')
    await wrapper.get('[data-testid="edit-weight-date"]').setValue('2026-10-01')
    await wrapper.get('[data-testid="edit-weight-value"]').setValue('77')
    await wrapper.get('[data-testid="edit-weight-form"]').trigger('submit')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-overwrite-weight-button"]').trigger('click')
    await flushPromises()

    const writes = fetchStub().requests.filter((request) => request.method !== 'GET')
    expect(writes.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ['PUT', '/api/weights/2026-10-01'],
      ['DELETE', '/api/weights/2026-11-05'],
    ])
    expect(wrapper.findAll('[data-testid="weight-entry"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="current-weight"]').text()).toContain('77,0')
  })

  it('deletes only after explicit confirmation and refreshes list, summary and chart', async () => {
    const entries: WeightEntry[] = [
      { date: '2026-10-01', weight: 80 },
      { date: '2026-11-05', weight: 78 },
    ]
    fetchStub()
      .intercept((request) => request.method === 'DELETE', (request) => {
        const date = new URL(request.url).pathname.split('/').at(-1)!
        entries.splice(entries.findIndex((entry) => entry.date === date), 1)
        return new Response(null, { status: 204 })
      })
      .intercept(/\/api\/weights/, () => json([...entries]))

    const wrapper = mount(WeightView)
    await flushPromises()

    expect(wrapper.findAll('circle')).toHaveLength(2)

    await entryRow(wrapper, '5 novembre 2026')
      .get('[data-testid="delete-weight"]')
      .trigger('click')

    expect(wrapper.get('[data-testid="confirm-delete-weight"]').text()).toContain(
      '5 novembre 2026',
    )
    expect(fetchStub().requests.some((request) => request.method === 'DELETE')).toBe(false)

    await wrapper.get('[data-testid="cancel-delete-weight"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-delete-weight"]').exists()).toBe(false)
    expect(fetchStub().requests.some((request) => request.method === 'DELETE')).toBe(false)

    await entryRow(wrapper, '5 novembre 2026')
      .get('[data-testid="delete-weight"]')
      .trigger('click')
    await wrapper.get('[data-testid="confirm-delete-weight-button"]').trigger('click')
    await flushPromises()

    const deletion = fetchStub().requests.find((request) => request.method === 'DELETE')
    expect(new URL(deletion!.url).pathname).toBe('/api/weights/2026-11-05')

    expect(wrapper.findAll('[data-testid="weight-entry"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="current-weight"]').text()).toContain('80,0')
    expect(wrapper.get('[data-testid="weight-change"]').text()).toContain('—')
    expect(wrapper.findAll('circle')).toHaveLength(1)
  })
})
