import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchStub } from '@/test/fetch'
import HomeView from './HomeView.vue'

const PER_100G = { kcal: 356, protein: 12, carbs: 70, fat: 1.5, fiber: 3, sugar: 2, salt: 1 }
const TOTALS = { kcal: 534, protein: 18, carbs: 105, fat: 2.25, fiber: 4.5, sugar: 3, salt: 1.5 }

const DAY = {
  date: '2026-11-05',
  targetKcal: 2200,
  totals: TOTALS,
  meals: [
    {
      id: 'meal-1',
      type: 'pranzo',
      occurredAt: new Date(2026, 10, 5, 12, 30, 0).toISOString(),
      localDate: '2026-11-05',
      note: 'Pranzo veloce',
      totals: TOTALS,
      items: [
        {
          id: 'item-1',
          name: 'Pane integrale',
          source: 'off',
          sourceId: '123',
          brand: 'Forno',
          grams: 150,
          per100g: PER_100G,
          totals: TOTALS,
        },
      ],
    },
  ],
}

const EMPTY_DAY = { date: '2026-11-06', targetKcal: 2200, totals: { ...TOTALS, kcal: 0 }, meals: [] }

const FAVORITES = [
  {
    id: 'food-mela',
    name: 'Mela',
    brand: null,
    source: 'manual',
    sourceId: null,
    per100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, salt: 0 },
    lastUsedAt: '2026-11-04T00:00:00.000Z',
  },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 5, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

function stubDay(day: unknown = DAY): void {
  fetchStub().intercept(/\/api\/days\//, () => Response.json(day))
  fetchStub().intercept(/\/api\/foods$/, () => Response.json(FAVORITES))
}

function draftTotal(wrapper: ReturnType<typeof mount>): string {
  return wrapper.get('[data-testid="draft-total"]').text()
}

describe('HomeView', () => {
  it('renders the day summary and the meals of the mocked day', async () => {
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.get('[data-testid="day-consumed"]').text()).toContain('534')
    expect(wrapper.get('[data-testid="day-target"]').text()).toContain('2200')
    expect(wrapper.get('[data-testid="day-delta"]').text()).toContain('1666')

    expect(wrapper.text()).toContain('Pane integrale')
    expect(wrapper.text()).toContain('150 g')
    expect(wrapper.text()).toContain('12:30')
    expect(wrapper.text()).toContain('Pranzo veloce')
    expect(wrapper.text()).toContain('Pranzo')
    expect(wrapper.text()).toContain('Proteine')
    expect(wrapper.text()).toContain('18 g')
    expect(wrapper.text()).toContain('105 g')
  })

  it('shows an empty state for a day without meals', async () => {
    stubDay(EMPTY_DAY)

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nessun pasto')
  })

  it('navigates days with the arrows and the date picker', async () => {
    fetchStub().intercept(/\/api\/days\//, (request) => {
      const date = request.url.split('/').pop()!
      return Response.json({ ...EMPTY_DAY, date })
    })

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[aria-label="Giorno successivo"]').trigger('click')
    await flushPromises()
    expect(fetchStub().requests.at(-1)!.url).toMatch(/\/api\/days\/2026-11-06$/)
    expect(wrapper.get('[data-testid="day-label"]').text()).toContain('6')

    await wrapper.get('[aria-label="Giorno precedente"]').trigger('click')
    await wrapper.get('[aria-label="Giorno precedente"]').trigger('click')
    await flushPromises()
    expect(fetchStub().requests.at(-1)!.url).toMatch(/\/api\/days\/2026-11-04$/)

    await wrapper.get('[data-testid="day-picker"]').setValue('2026-10-20')
    await flushPromises()
    expect(fetchStub().requests.at(-1)!.url).toMatch(/\/api\/days\/2026-10-20$/)
  })

  it('adds favorites to the draft, edits grams and saves with a single request', async () => {
    stubDay()
    fetchStub().intercept(/\/api\/meals$/, () => Response.json(DAY.meals[0], { status: 201 }))

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="add-meal"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="meal-type-pranzo"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-testid="meal-type-cena"]').trigger('click')
    expect(wrapper.get('[data-testid="meal-type-cena"]').attributes('aria-pressed')).toBe('true')

    const mela = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Mela'))!
    await mela.trigger('click')

    expect(wrapper.text()).toContain('1 alimento')
    await wrapper.get('[aria-label="Grammi Mela"]').setValue('250')
    expect(draftTotal(wrapper)).toContain('130')

    await wrapper.get('[data-testid="save-meal"]').trigger('click')
    await flushPromises()

    const posts = fetchStub().requests.filter((request) => request.method === 'POST')
    expect(posts).toHaveLength(1)
    const body = (await posts[0]!.json()) as Record<string, unknown>
    expect(body).toMatchObject({ type: 'cena', localDate: '2026-11-05', note: null })
    expect(body.occurredAt).toEqual(expect.any(String))
    expect(body).not.toHaveProperty('totals')

    const items = body.items as Record<string, unknown>[]
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      name: 'Mela',
      source: 'manual',
      sourceId: null,
      grams: 250,
      per100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, salt: 0 },
    })
    expect(items[0]).not.toHaveProperty('totals')

    expect(wrapper.find('[data-testid="add-meal-flow"]').exists()).toBe(false)
    const dayRequests = fetchStub().requests.filter(
      (request) => request.method === 'GET' && request.url.includes('/api/days/'),
    )
    expect(dayRequests).toHaveLength(2)
  })

  it('creates a manual food and saves it as a manual item', async () => {
    stubDay()
    fetchStub().intercept(/\/api\/meals$/, () => Response.json(DAY.meals[0], { status: 201 }))

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="add-meal"]').trigger('click')
    await wrapper.get('[data-testid="create-food"]').trigger('click')

    await wrapper.get('#food-name').setValue('Torta della nonna')
    await wrapper.get('#food-kcal').setValue('400')
    await wrapper.get('#food-protein').setValue('5')
    await wrapper.get('#food-carbs').setValue('50')
    await wrapper.get('#food-fat').setValue('20')
    await wrapper.get('#food-fiber').setValue('2')
    await wrapper.get('#food-sugar').setValue('30')
    await wrapper.get('#food-salt').setValue('0.5')
    await wrapper.get('[data-testid="add-manual-food"]').trigger('click')

    expect(wrapper.text()).toContain('Torta della nonna')
    expect(draftTotal(wrapper)).toContain('400')

    await wrapper.get('[data-testid="save-meal"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find((request) => request.method === 'POST')!
    const body = (await post.json()) as { items: Record<string, unknown>[] }
    expect(body.items[0]).toMatchObject({
      name: 'Torta della nonna',
      source: 'manual',
      sourceId: null,
      grams: 100,
      per100g: { kcal: 400, protein: 5, carbs: 50, fat: 20, fiber: 2, sugar: 30, salt: 0.5 },
    })
  })

  it('keeps the draft and shows an error when the save fails', async () => {
    stubDay()
    fetchStub().intercept(/\/api\/meals$/, () =>
      Response.json({ error: 'Errore del server' }, { status: 500 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="add-meal"]').trigger('click')
    const mela = wrapper.findAll('button').find((button) => button.text().includes('Mela'))!
    await mela.trigger('click')
    await wrapper.get('[data-testid="save-meal"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="add-meal-flow"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Errore del server')
    expect(wrapper.text()).toContain('Mela')
  })
})

describe('favorite management', () => {
  it('edits a favorite from the add-meal flow and shows the outcome', async () => {
    stubDay()
    fetchStub().intercept(
      (request) => request.method === 'PATCH' && request.url.endsWith('/api/foods/food-mela'),
      () => Response.json({ ...FAVORITES[0], name: 'Mela Golden' }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="add-meal"]').trigger('click')
    await flushPromises()

    await wrapper.get('[aria-label="Modifica preferito Mela"]').trigger('click')
    expect((wrapper.get('#edit-food-name').element as HTMLInputElement).value).toBe('Mela')
    expect((wrapper.get('#edit-food-kcal').element as HTMLInputElement).value).toBe('52')

    await wrapper.get('#edit-food-name').setValue('Mela Golden')
    await wrapper.get('#edit-food-kcal').setValue('60')
    await wrapper.get('[data-testid="save-food-edit"]').trigger('click')
    await flushPromises()

    const patch = fetchStub().requests.find((request) => request.method === 'PATCH')!
    expect(patch.url).toMatch(/\/api\/foods\/food-mela$/)
    expect(await patch.json()).toEqual({
      name: 'Mela Golden',
      per100g: { ...FAVORITES[0]!.per100g, kcal: 60 },
    })

    expect(wrapper.text()).toContain('Preferito aggiornato')
    const listRequests = fetchStub().requests.filter(
      (request) => request.method === 'GET' && /\/api\/foods$/.test(request.url),
    )
    expect(listRequests).toHaveLength(2)
  })

  it('asks for confirmation before deleting a favorite and explains the past meals', async () => {
    stubDay()
    fetchStub().intercept(
      (request) => request.method === 'DELETE' && request.url.endsWith('/api/foods/food-mela'),
      () => new Response(null, { status: 204 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="add-meal"]').trigger('click')
    await flushPromises()

    await wrapper.get('[aria-label="Elimina preferito Mela"]').trigger('click')
    expect(fetchStub().requests.some((request) => request.method === 'DELETE')).toBe(false)
    expect(wrapper.get('[data-testid="confirm-delete-food"]').text()).toContain(
      'I pasti già registrati non cambiano',
    )

    await wrapper.get('[data-testid="confirm-delete-food-button"]').trigger('click')
    await flushPromises()

    const remove = fetchStub().requests.find((request) => request.method === 'DELETE')!
    expect(remove.url).toMatch(/\/api\/foods\/food-mela$/)
    expect(wrapper.text()).toContain('Preferito eliminato')
  })

  it('keeps the edit form open and shows the server error when saving fails', async () => {
    stubDay()
    fetchStub().intercept(
      (request) => request.method === 'PATCH',
      () => Response.json({ error: 'Valori non validi' }, { status: 400 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="add-meal"]').trigger('click')
    await flushPromises()
    await wrapper.get('[aria-label="Modifica preferito Mela"]').trigger('click')
    await wrapper.get('[data-testid="save-food-edit"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Valori non validi')
    expect(wrapper.find('#edit-food-name').exists()).toBe(true)
  })
})
