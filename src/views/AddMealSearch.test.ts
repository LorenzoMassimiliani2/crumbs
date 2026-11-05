import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchStub } from '@/test/fetch'
import HomeView from './HomeView.vue'

const EMPTY_DAY = {
  date: '2026-11-05',
  targetKcal: 2200,
  totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 },
  meals: [],
}

const PANE_PER_100G = {
  kcal: 260,
  protein: 14,
  carbs: 37,
  fat: 4.8,
  fiber: null,
  sugar: null,
  salt: null,
}

const PANE = {
  id: '8003170101142',
  name: 'PANE PROTEICO',
  brand: 'Piacersi Conad',
  barcode: '8003170101142',
  source: 'off',
  sourceId: '8003170101142',
  per100g: PANE_PER_100G,
  serving: { grams: 23.5, label: '23.5g' },
}

const MELA_USDA = {
  id: '1750340',
  name: 'Mela',
  brand: null,
  barcode: null,
  source: 'usda',
  sourceId: '1750340',
  per100g: {
    kcal: 52,
    protein: 0.26,
    carbs: 13.81,
    fat: 0.17,
    fiber: null,
    sugar: null,
    salt: 0.6,
  },
  serving: { grams: 100, label: '100 g' },
}

const SEARCH_BODY = { off: [PANE], usda: [] }

function stubApp(): void {
  fetchStub().intercept(/\/api\/days\//, () => Response.json(EMPTY_DAY))
  fetchStub().intercept(/\/api\/foods$/, () => Response.json([]))
  fetchStub().intercept(/\/api\/meals$/, () => Response.json({ id: 'meal-1' }, { status: 201 }))
  fetchStub().intercept(/\/api\/foods\/search/, () => Response.json(SEARCH_BODY))
  fetchStub().intercept(/\/api\/foods\/off\//, () => Response.json(PANE))
}

function searchRequests(): Request[] {
  return fetchStub().requests.filter((request) => request.url.includes('/api/foods/search'))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date(2026, 10, 5, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

async function openFlow() {
  const wrapper = mount(HomeView)
  await flushPromises()
  await wrapper.get('[data-testid="add-meal"]').trigger('click')
  await flushPromises()
  return wrapper
}

describe('external food search in the add-meal flow', () => {
  it('does not search with fewer than 3 characters, even after the pause', async () => {
    stubApp()
    const wrapper = await openFlow()

    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').setValue('pa')
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()

    expect(searchRequests()).toHaveLength(0)
    expect(wrapper.find('[data-testid="off-group"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="usda-group"]').exists()).toBe(false)
  })

  it('selects simple foods by default', async () => {
    stubApp()
    const wrapper = await openFlow()

    const select = wrapper.get('[data-testid="source-select"]')
    expect((select.element as unknown as HTMLSelectElement).value).toBe('usda')
    expect(select.text()).toContain('Alimenti semplici')
    expect(select.text()).toContain('Prodotti confezionati')
  })

  it('searches after a pause and shows the packaged-products group', async () => {
    stubApp()
    const wrapper = await openFlow()

    await wrapper.get('[data-testid="source-select"]').setValue('off')
    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').setValue('pane')
    expect(searchRequests()).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    expect(searchRequests()).toHaveLength(1)
    expect(searchRequests()[0]!.url).toContain('q=pane')
    expect(searchRequests()[0]!.url).toContain('source=off')

    const group = wrapper.get('[data-testid="off-group"]')
    expect(group.text()).toContain('Prodotti confezionati')
    expect(group.text()).toContain('PANE PROTEICO')
    expect(group.text()).toContain('Piacersi Conad')
    expect(group.text()).toContain('260')
    expect(group.text()).toContain('Open Food Facts')
  })

  it('searches immediately on submit', async () => {
    stubApp()
    const wrapper = await openFlow()

    const input = wrapper.get('input[aria-label="Cerca alimenti e prodotti"]')
    await input.setValue('pane')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(searchRequests()).toHaveLength(1)
  })

  it('adds the current product data to the draft and saves it as an Open Food Facts item', async () => {
    stubApp()
    const wrapper = await openFlow()

    await wrapper.get('[data-testid="source-select"]').setValue('off')
    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').setValue('pane')
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    await wrapper.get('[data-testid="off-result"]').trigger('click')
    await flushPromises()

    expect(
      fetchStub().requests.some((request) => request.url.endsWith('/api/foods/off/8003170101142')),
    ).toBe(true)
    expect(wrapper.text()).toContain('1 alimento')
    expect(wrapper.get('[data-testid="draft-total"]').text()).toContain('260')

    await wrapper.get('[data-testid="save-meal"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find((request) => request.method === 'POST')!
    const body = (await post.json()) as { items: Record<string, unknown>[] }
    expect(body.items[0]).toMatchObject({
      name: 'PANE PROTEICO',
      source: 'off',
      sourceId: '8003170101142',
      brand: 'Piacersi Conad',
      grams: 100,
      per100g: PANE_PER_100G,
    })
    expect((body.items[0]!.per100g as Record<string, unknown>).fiber).toBeNull()
  })

  it('re-runs the current search against the new source when the select changes', async () => {
    fetchStub().intercept(/\/api\/days\//, () => Response.json(EMPTY_DAY))
    fetchStub().intercept(/\/api\/foods$/, () => Response.json([]))
    fetchStub().intercept(/\/api\/foods\/search/, (request) =>
      new URL(request.url).searchParams.get('source') === 'off'
        ? Response.json(SEARCH_BODY)
        : Response.json({ off: [], usda: [MELA_USDA] }),
    )
    fetchStub().intercept(/\/api\/foods\/off\//, () => Response.json(PANE))

    const wrapper = await openFlow()

    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').setValue('pane')
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    expect(new URL(searchRequests()[0]!.url).searchParams.get('source')).toBe('usda')
    expect(wrapper.get('[data-testid="usda-group"]').text()).toContain('Alimenti semplici')
    expect(wrapper.get('[data-testid="usda-group"]').text()).toContain('Mela')

    await wrapper.get('[data-testid="source-select"]').setValue('off')
    await flushPromises()

    expect(searchRequests()).toHaveLength(2)
    expect(new URL(searchRequests()[1]!.url).searchParams.get('source')).toBe('off')
    expect(wrapper.get('[data-testid="off-group"]').text()).toContain('Prodotti confezionati')
    expect(wrapper.get('[data-testid="off-group"]').text()).toContain('PANE PROTEICO')
  })

  it('shows the missing USDA configuration message under the input', async () => {
    fetchStub().intercept(/\/api\/days\//, () => Response.json(EMPTY_DAY))
    fetchStub().intercept(/\/api\/foods$/, () => Response.json([]))
    fetchStub().intercept(/\/api\/foods\/search/, () =>
      Response.json(
        { error: 'Alimenti semplici non configurati.', code: 'usda_not_configured' },
        { status: 503 },
      ),
    )

    const wrapper = await openFlow()

    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').setValue('mela')
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    const error = wrapper.get('[data-testid="search-error"]')
    expect(error.text()).toContain('Alimenti semplici non configurati.')
    expect(error.text()).toContain('Prodotti confezionati')
  })

  it('adds a simple food to the draft without fetching a product', async () => {
    fetchStub().intercept(/\/api\/days\//, () => Response.json(EMPTY_DAY))
    fetchStub().intercept(/\/api\/foods$/, () => Response.json([]))
    fetchStub().intercept(/\/api\/meals$/, () => Response.json({ id: 'meal-1' }, { status: 201 }))
    fetchStub().intercept(/\/api\/foods\/search/, () => Response.json({ off: [], usda: [MELA_USDA] }))

    const wrapper = await openFlow()

    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').setValue('mela')
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    await wrapper.get('[data-testid="usda-result"]').trigger('click')
    await flushPromises()

    expect(fetchStub().requests.some((request) => request.url.includes('/api/foods/off/'))).toBe(false)
    expect(wrapper.text()).toContain('1 alimento')
    expect(wrapper.get('[data-testid="draft-total"]').text()).toContain('52')

    await wrapper.get('[data-testid="save-meal"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find((request) => request.method === 'POST')!
    const body = (await post.json()) as { items: Record<string, unknown>[] }
    expect(body.items[0]).toMatchObject({
      name: 'Mela',
      source: 'usda',
      sourceId: '1750340',
      brand: null,
      grams: 100,
    })
  })
})


