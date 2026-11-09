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
  activities: [],
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

const EMPTY_DAY = {
  date: '2026-11-06',
  targetKcal: 2200,
  totals: { ...TOTALS, kcal: 0 },
  meals: [],
  activities: [],
}

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

async function openMealFlow(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get('[data-testid="add-entry"]').trigger('click')
  await wrapper.get('[data-testid="choose-meal"]').trigger('click')
  await flushPromises()
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

  it('shows the readable source of every item', async () => {
    const item = DAY.meals[0]!.items[0]!
    const day = {
      ...DAY,
      meals: [
        {
          ...DAY.meals[0],
          items: [
            { ...item, id: 'item-off', name: 'Pane', source: 'off', brand: null },
            { ...item, id: 'item-usda', name: 'Riso', source: 'usda', brand: null },
            { ...item, id: 'item-manual', name: 'Torta', source: 'manual', brand: null },
          ],
        },
      ],
    }
    stubDay(day)

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.text()).toContain('Open Food Facts')
    expect(wrapper.text()).toContain('USDA')
    expect(wrapper.text()).toContain('Manuale')
  })

  it('drops the previous day content when the new day fails to load', async () => {
    fetchStub().intercept(/\/api\/days\//, (request) =>
      request.url.endsWith('/2026-11-06')
        ? Response.json({ error: 'Errore' }, { status: 500 })
        : Response.json(DAY),
    )
    fetchStub().intercept(/\/api\/foods$/, () => Response.json(FAVORITES))

    const wrapper = mount(HomeView)
    await flushPromises()
    expect(wrapper.text()).toContain('Pane integrale')

    await wrapper.get('[aria-label="Giorno successivo"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Pane integrale')
    expect(wrapper.get('[role="alert"]').text()).toContain('Impossibile caricare il giorno')
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

    await openMealFlow(wrapper)

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

    await openMealFlow(wrapper)
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

  it('keeps unknown macros as null in the draft and shows a dash', async () => {
    const mistero = {
      ...FAVORITES[0]!,
      id: 'food-mistero',
      name: 'Mistero',
      per100g: { kcal: 100, protein: null, carbs: null, fat: null, fiber: null, sugar: null, salt: null },
    }
    fetchStub().intercept(/\/api\/days\//, () => Response.json(DAY))
    fetchStub().intercept(/\/api\/foods$/, () => Response.json([mistero]))
    fetchStub().intercept(/\/api\/meals$/, () => Response.json(DAY.meals[0], { status: 201 }))

    const wrapper = mount(HomeView)
    await flushPromises()

    await openMealFlow(wrapper)
    const button = wrapper.findAll('button').find((item) => item.text().includes('Mistero'))!
    await button.trigger('click')

    expect(wrapper.text()).toContain('—')

    await wrapper.get('[data-testid="save-meal"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find((request) => request.method === 'POST')!
    const body = (await post.json()) as { items: { per100g: Record<string, unknown> }[] }
    expect(body.items[0]!.per100g).toEqual({
      kcal: 100,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      salt: null,
    })
  })

  it('keeps the draft and shows an error when the save fails', async () => {
    stubDay()
    fetchStub().intercept(/\/api\/meals$/, () =>
      Response.json({ error: 'Errore del server' }, { status: 500 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()

    await openMealFlow(wrapper)
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

    await openMealFlow(wrapper)

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

    await openMealFlow(wrapper)

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

    await openMealFlow(wrapper)
    await wrapper.get('[aria-label="Modifica preferito Mela"]').trigger('click')
    await wrapper.get('[data-testid="save-food-edit"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Valori non validi')
    expect(wrapper.find('#edit-food-name').exists()).toBe(true)
  })

  it('renders the meal type as a labelled grid with an icon per option', async () => {
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openMealFlow(wrapper)

    const picker = wrapper.get('[data-testid="meal-type-picker"]')
    expect(picker.classes()).toContain('grid-cols-6')
    const options = picker.findAll('[data-testid^="meal-type-"]')
    expect(options).toHaveLength(6)
    expect(options.map((option) => option.text())).toEqual([
      'Colazione',
      'Mattina',
      'Pranzo',
      'Pomeriggio',
      'Cena',
      'Dopo cena',
    ])
    expect(options.map((option) => option.attributes('aria-label'))).toEqual([
      'Colazione',
      'Merenda mattina',
      'Pranzo',
      'Merenda pomeriggio',
      'Cena',
      'Post-cena',
    ])
    expect(options.every((option) => option.find('svg').exists())).toBe(true)
    expect(wrapper.get('[data-testid="meal-type-pranzo"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="meal-type-post_cena"]').trigger('click')
    expect(wrapper.get('[data-testid="meal-type-post_cena"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="meal-type-pranzo"]').attributes('aria-pressed')).toBe('false')
  })

  it('shows kcal and macros per item and adjusts grams with the stepper', async () => {
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openMealFlow(wrapper)

    const mela = wrapper.findAll('button').find((button) => button.text().includes('Mela'))!
    await mela.trigger('click')

    const macroRow = wrapper.get('[data-testid="item-macros-Mela"]')
    expect(macroRow.find('[data-testid="item-kcal-Mela"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="item-kcal-Mela"]').text()).toContain('52')
    const macros = macroRow.text()
    expect(macros).toContain('P')
    expect(macros).toContain('0,3 g')
    expect(macros).toContain('C')
    expect(macros).toContain('14 g')
    expect(macros).toContain('G')
    expect(macros).toContain('0,2 g')

    const gramsInput = wrapper.get('[aria-label="Grammi Mela"]')
    expect(gramsInput.attributes('type')).toBe('text')
    expect(gramsInput.attributes('step')).toBeUndefined()

    const grams = () => (wrapper.get('[aria-label="Grammi Mela"]').element as HTMLInputElement).value
    expect(grams()).toBe('100')

    await wrapper.get('[aria-label="Aumenta grammi Mela"]').trigger('click')
    expect(grams()).toBe('110')

    await wrapper.get('[aria-label="Diminuisci grammi Mela"]').trigger('click')
    await wrapper.get('[aria-label="Diminuisci grammi Mela"]').trigger('click')
    await wrapper.get('[aria-label="Diminuisci grammi Mela"]').trigger('click')
    expect(grams()).toBe('80')
    expect(wrapper.get('[data-testid="item-kcal-Mela"]').text()).toContain('42')
    expect(draftTotal(wrapper)).toContain('42')
  })

  it('shows favorites highlighted inside the active food group, without a separate favorites list', async () => {
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openMealFlow(wrapper)

    expect(wrapper.text()).not.toContain('Nessun preferito trovato')
    expect(wrapper.text()).not.toContain('Preferiti')

    const group = wrapper.get('[data-testid="usda-group"]')
    const favorite = group.get('[data-testid="favorite-row"]')
    expect(favorite.text()).toContain('Mela')
    expect(favorite.text()).toContain('Preferito')
    expect(favorite.classes()).toContain('border-primary/50')

    await wrapper.get('[data-testid="source-select"]').setValue('off')
    expect(wrapper.find('[data-testid="favorite-row"]').exists()).toBe(false)
  })

  it('lists matching favorites before the online results', async () => {
    stubDay()
    fetchStub().intercept(/\/api\/foods\/search/, () =>
      Response.json({
        off: [],
        usda: [
          {
            id: '1750340',
            name: 'Mela Golden',
            brand: null,
            barcode: null,
            source: 'usda',
            sourceId: '1750340',
            per100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, salt: 0 },
            serving: null,
          },
        ],
      }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openMealFlow(wrapper)

    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').setValue('mel')
    await wrapper.get('input[aria-label="Cerca alimenti e prodotti"]').trigger('keydown.enter')
    await flushPromises()

    const rows = wrapper
      .get('[data-testid="usda-group"]')
      .element.querySelectorAll('[data-testid="favorite-row"], [data-testid="usda-result"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('Preferito')
    expect(rows[1]!.textContent).toContain('Mela Golden')
  })
})

const ACTIVITIES = [
  { id: 'act-corsa', name: 'Corsa', lastUsedAt: null },
  { id: 'act-yoga', name: 'Yoga', lastUsedAt: null },
]

function isoAt(hours: number, minutes: number): string {
  return new Date(2026, 10, 5, hours, minutes).toISOString()
}

function stubActivities(activities: unknown = ACTIVITIES): void {
  fetchStub().intercept(
    (request) => request.method === 'GET' && request.url.endsWith('/api/activities'),
    () => Response.json(activities),
  )
}

async function openActivityFlow(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get('[data-testid="add-entry"]').trigger('click')
  await wrapper.get('[data-testid="choose-activity"]').trigger('click')
  await flushPromises()
}

describe('activity diary', () => {
  it('opens a chooser with + Pasto and + Attività, and + Pasto keeps the meal flow', async () => {
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="add-entry"]').trigger('click')
    const chooser = wrapper.get('[data-testid="add-chooser"]')
    expect(chooser.text()).toContain('+ Pasto')
    expect(chooser.text()).toContain('+ Attività')
    expect(wrapper.find('[data-testid="add-meal-flow"]').exists()).toBe(false)

    await wrapper.get('[data-testid="choose-meal"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="add-chooser"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-meal-flow"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(false)
  })

  it('opens the activity flow with catalog, times and the derived duration', async () => {
    stubDay()
    stubActivities()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="activity-date"]').text()).toContain('5')
    expect(
      (wrapper.get('[aria-label="Ora di inizio"]').element as HTMLInputElement).value,
    ).toBe('12:00')
    expect((wrapper.get('[aria-label="Ora di fine"]').element as HTMLInputElement).value).toBe(
      '13:00',
    )
    expect(wrapper.get('[data-testid="activity-duration"]').text()).toBe('1 h')

    const options = wrapper.findAll('[data-testid="activity-option"]')
    expect(options.map((option) => option.text())).toEqual(['Corsa', 'Yoga'])

    await wrapper.get('[aria-label="Ora di inizio"]').setValue('11:00')
    expect(wrapper.get('[data-testid="activity-duration"]').text()).toBe('2 h')

    await wrapper.get('[aria-label="Ora di fine"]').setValue('13:30')
    expect(wrapper.get('[data-testid="activity-duration"]').text()).toBe('2 h 30 min')

    await wrapper.get('[aria-label="Cerca attività"]').setValue('yo')
    expect(wrapper.findAll('[data-testid="activity-option"]').map((option) => option.text())).toEqual([
      'Yoga',
    ])
  })

  it('blocks the save with a clear message when the end equals the start', async () => {
    stubDay()
    stubActivities()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[data-testid="activity-option"]').trigger('click')
    await wrapper.get('[aria-label="Ora di fine"]').setValue('12:00')

    expect(wrapper.text()).toContain("L'ora di fine deve essere successiva all'ora di inizio.")
    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    expect(
      fetchStub().requests.filter((request) => request.method === 'POST'),
    ).toHaveLength(0)
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(true)
  })

  it('reads times past midnight as the following day and saves the night interval', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
      () =>
        Response.json(
          {
            id: 'entry-night',
            activityId: 'act-corsa',
            name: 'Corsa',
            startedAt: isoAt(23, 0),
            endedAt: new Date(2026, 10, 6, 1, 0).toISOString(),
            durationMinutes: 120,
            note: null,
          },
          { status: 201 },
        ),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[data-testid="activity-option"]').trigger('click')
    await wrapper.get('[aria-label="Ora di inizio"]').setValue('23:00')
    await wrapper.get('[aria-label="Ora di fine"]').setValue('01:00')

    expect(wrapper.get('[data-testid="activity-duration"]').text()).toBe('2 h')

    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
    )!
    expect(await post.json()).toMatchObject({
      startedAt: isoAt(23, 0),
      endedAt: new Date(2026, 10, 6, 1, 0).toISOString(),
    })
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(false)
  })

  it('asks for confirmation over 12 hours and saves only when confirmed', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
      () => Response.json({ id: 'entry-long' }, { status: 201 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[data-testid="activity-option"]').trigger('click')
    await wrapper.get('[aria-label="Ora di inizio"]').setValue('18:00')
    await wrapper.get('[aria-label="Ora di fine"]').setValue('08:00')
    expect(wrapper.get('[data-testid="activity-duration"]').text()).toBe('14 h')

    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()
    expect(
      fetchStub().requests.filter((request) => request.method === 'POST'),
    ).toHaveLength(0)
    expect(wrapper.get('[data-testid="long-activity-confirm"]').text()).toContain('14 h')

    await wrapper.get('[data-testid="cancel-long-activity"]').trigger('click')
    expect(wrapper.find('[data-testid="long-activity-confirm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(true)
    expect(
      (wrapper.get('[aria-label="Ora di inizio"]').element as HTMLInputElement).value,
    ).toBe('18:00')
    expect((wrapper.get('[aria-label="Ora di fine"]').element as HTMLInputElement).value).toBe(
      '08:00',
    )
    expect(
      fetchStub().requests.filter((request) => request.method === 'POST'),
    ).toHaveLength(0)

    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await wrapper.get('[data-testid="confirm-long-activity"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
    )!
    expect(await post.json()).toMatchObject({ startedAt: isoAt(18, 0) })
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(false)
  })

  it('shows the server message and keeps the flow when the duration exceeds 24 hours', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
      () =>
        Response.json(
          { error: "La durata dell'attività non può superare le 24 ore." },
          { status: 400 },
        ),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[data-testid="activity-option"]').trigger('click')
    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('non può superare le 24 ore')
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(true)
  })

  it('saves a catalog activity with its note and reloads the day', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
      () =>
        Response.json(
          {
            id: 'entry-1',
            activityId: 'act-corsa',
            name: 'Corsa',
            startedAt: isoAt(12, 0),
            endedAt: isoAt(13, 30),
            durationMinutes: 90,
            note: 'Parco',
          },
          { status: 201 },
        ),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper
      .findAll('[data-testid="activity-option"]')
      .find((option) => option.text() === 'Corsa')!
      .trigger('click')
    await wrapper.get('[aria-label="Ora di fine"]').setValue('13:30')
    await wrapper.get('[aria-label="Nota attività"]').setValue('Parco')
    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
    )!
    expect(await post.json()).toEqual({
      activityId: 'act-corsa',
      localDate: '2026-11-05',
      startedAt: isoAt(12, 0),
      endedAt: isoAt(13, 30),
      note: 'Parco',
    })

    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(false)
    const dayRequests = fetchStub().requests.filter(
      (request) => request.method === 'GET' && request.url.includes('/api/days/'),
    )
    expect(dayRequests).toHaveLength(2)
  })

  it('creates a new catalog activity from the flow and selects it', async () => {
    const created = { id: 'act-nuova', name: 'Arrampicata', lastUsedAt: null }
    let lists = 0
    fetchStub().intercept(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activities'),
      () => Response.json(created, { status: 201 }),
    )
    fetchStub().intercept(
      (request) => request.method === 'GET' && request.url.endsWith('/api/activities'),
      () => Response.json(lists++ === 0 ? ACTIVITIES : [...ACTIVITIES, created]),
    )
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[aria-label="Nome nuova attività"]').setValue('Arrampicata')
    await wrapper.get('[data-testid="create-activity"]').trigger('click')
    await flushPromises()

    const post = fetchStub().requests.find(
      (request) => request.method === 'POST' && request.url.endsWith('/api/activities'),
    )!
    expect(await post.json()).toEqual({ name: 'Arrampicata' })

    const added = wrapper
      .findAll('[data-testid="activity-option"]')
      .find((option) => option.text() === 'Arrampicata')!
    expect(added.attributes('aria-pressed')).toBe('true')
  })

  it('shows meals and activities in one chronological sequence, with notes only when present', async () => {
    const day = {
      ...DAY,
      meals: [{ ...DAY.meals[0]!, occurredAt: isoAt(13, 0) }],
      activities: [
        {
          id: 'entry-yoga',
          activityId: 'act-yoga',
          name: 'Yoga',
          startedAt: isoAt(7, 0),
          endedAt: isoAt(8, 0),
          durationMinutes: 60,
          note: null,
        },
        {
          id: 'entry-camminata',
          activityId: 'act-camminata',
          name: 'Camminata',
          startedAt: isoAt(12, 0),
          endedAt: isoAt(13, 30),
          durationMinutes: 90,
          note: 'Con il cane',
        },
      ],
    }
    stubDay(day)

    const wrapper = mount(HomeView)
    await flushPromises()

    const articles = wrapper.findAll('article')
    expect(articles).toHaveLength(3)
    expect(articles[0]!.text()).toContain('Yoga')
    expect(articles[0]!.text()).not.toContain('Con il cane')
    expect(articles[1]!.text()).toContain('Camminata')
    expect(articles[1]!.text()).toContain('12:00–13:30')
    expect(articles[1]!.text()).toContain('1 h 30 min')
    expect(articles[1]!.text()).toContain('Con il cane')
    expect(articles[2]!.text()).toContain('Pranzo')

    expect(wrapper.get('[data-testid="day-consumed"]').text()).toContain('534')
    expect(wrapper.get('[data-testid="day-target"]').text()).toContain('2200')
  })

  it('shows long and night durations in readable hours and minutes', async () => {
    const day = {
      ...EMPTY_DAY,
      activities: [
        {
          id: 'entry-night',
          activityId: 'act-corsa',
          name: 'Corsa',
          startedAt: isoAt(23, 0),
          endedAt: new Date(2026, 10, 6, 1, 0).toISOString(),
          durationMinutes: 120,
          note: null,
        },
        {
          id: 'entry-long',
          activityId: 'act-camminata',
          name: 'Camminata',
          startedAt: isoAt(18, 0),
          endedAt: new Date(2026, 10, 6, 8, 0).toISOString(),
          durationMinutes: 840,
          note: null,
        },
      ],
    }
    stubDay(day)

    const wrapper = mount(HomeView)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="activity-row"]')
    expect(rows[0]!.text()).toContain('14 h')
    expect(rows[1]!.text()).toContain('2 h')
    expect(rows.map((row) => row.text()).join(' ')).not.toContain('-')
  })
})

const ACTIVITY_CATALOG = [
  { id: 'act-camminata', name: 'Camminata', lastUsedAt: '2026-11-04T00:00:00.000Z' },
  { id: 'act-corsa', name: 'Corsa', lastUsedAt: null },
  { id: 'act-yoga', name: 'Yoga', lastUsedAt: null },
]

const DAY_WITH_ACTIVITY = {
  ...DAY,
  meals: [{ ...DAY.meals[0]!, occurredAt: isoAt(13, 0) }],
  activities: [
    {
      id: 'entry-camminata',
      activityId: 'act-camminata',
      name: 'Camminata',
      startedAt: isoAt(12, 0),
      endedAt: isoAt(13, 30),
      durationMinutes: 90,
      note: 'Con il cane',
    },
  ],
}

function stubActivityEditDay(day: unknown = DAY_WITH_ACTIVITY): void {
  fetchStub().intercept(/\/api\/days\//, () => Response.json(day))
  fetchStub().intercept(
    (request) => request.method === 'GET' && request.url.endsWith('/api/activities'),
    () => Response.json(ACTIVITY_CATALOG),
  )
}

async function openActivityEdit(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get('[aria-label="Modifica attività Camminata"]').trigger('click')
  await flushPromises()
}

describe('activity entry editing and deletion', () => {
  it('opens the edit flow precompiled from the saved activity', async () => {
    stubActivityEditDay()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityEdit(wrapper)

    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="add-activity-flow"]').attributes('aria-label')).toBe(
      'Modifica attività',
    )
    const selected = wrapper.findAll('[data-testid="activity-option"]').find(
      (option) => option.attributes('aria-pressed') === 'true',
    )!
    expect(selected.text()).toBe('Camminata')
    expect((wrapper.get('[aria-label="Ora di inizio"]').element as HTMLInputElement).value).toBe(
      '12:00',
    )
    expect((wrapper.get('[aria-label="Ora di fine"]').element as HTMLInputElement).value).toBe(
      '13:30',
    )
    expect((wrapper.get('[aria-label="Nota attività"]').element as HTMLInputElement).value).toBe(
      'Con il cane',
    )
    expect(wrapper.get('[data-testid="activity-duration"]').text()).toBe('1 h 30 min')
  })

  it('saves the change with PUT and shows the new chronological order', async () => {
    let dayRequests = 0
    fetchStub().intercept(/\/api\/days\//, () =>
      Response.json(
        dayRequests++ === 0
          ? DAY_WITH_ACTIVITY
          : {
              ...DAY_WITH_ACTIVITY,
              activities: [
                {
                  ...DAY_WITH_ACTIVITY.activities[0]!,
                  startedAt: isoAt(14, 30),
                  endedAt: isoAt(15, 0),
                  durationMinutes: 30,
                  note: 'Pomeriggio',
                },
              ],
            },
      ),
    )
    fetchStub().intercept(
      (request) => request.method === 'GET' && request.url.endsWith('/api/activities'),
      () => Response.json(ACTIVITY_CATALOG),
    )
    fetchStub().intercept(
      (request) =>
        request.method === 'PUT' && request.url.endsWith('/api/activity-entries/entry-camminata'),
      () => Response.json({ id: 'entry-camminata' }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityEdit(wrapper)

    await wrapper.get('[aria-label="Ora di inizio"]').setValue('14:30')
    await wrapper.get('[aria-label="Ora di fine"]').setValue('15:00')
    await wrapper.get('[aria-label="Nota attività"]').setValue('Pomeriggio')
    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    const put = fetchStub().requests.find((request) => request.method === 'PUT')!
    expect(put.url).toMatch(/\/api\/activity-entries\/entry-camminata$/)
    expect(await put.json()).toEqual({
      activityId: 'act-camminata',
      localDate: '2026-11-05',
      startedAt: isoAt(14, 30),
      endedAt: isoAt(15, 0),
      note: 'Pomeriggio',
    })
    expect(
      fetchStub().requests.filter(
        (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
      ),
    ).toHaveLength(0)

    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(false)
    const articles = wrapper.findAll('article')
    expect(articles[0]!.text()).toContain('Pranzo')
    expect(articles[1]!.text()).toContain('Camminata')
    expect(articles[1]!.text()).toContain('14:30–15:00')
    expect(wrapper.get('[data-testid="day-consumed"]').text()).toContain('534')
  })

  it('deletes only after an explicit confirmation and reloads the day', async () => {
    let dayRequests = 0
    fetchStub().intercept(/\/api\/days\//, () =>
      Response.json(dayRequests++ === 0 ? DAY_WITH_ACTIVITY : { ...DAY_WITH_ACTIVITY, activities: [] }),
    )
    fetchStub().intercept(
      (request) => request.method === 'GET' && request.url.endsWith('/api/activities'),
      () => Response.json(ACTIVITY_CATALOG),
    )
    fetchStub().intercept(
      (request) =>
        request.method === 'DELETE' &&
        request.url.endsWith('/api/activity-entries/entry-camminata'),
      () => new Response(null, { status: 204 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityEdit(wrapper)

    await wrapper.get('[data-testid="delete-activity"]').trigger('click')
    expect(fetchStub().requests.some((request) => request.method === 'DELETE')).toBe(false)
    expect(wrapper.get('[data-testid="confirm-delete-activity"]').text()).toContain(
      'Vuoi davvero eliminare questa attività?',
    )

    await wrapper.get('[data-testid="cancel-delete-activity"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-delete-activity"]').exists()).toBe(false)

    await wrapper.get('[data-testid="delete-activity"]').trigger('click')
    await wrapper.get('[data-testid="confirm-delete-activity-button"]').trigger('click')
    await flushPromises()

    const remove = fetchStub().requests.find((request) => request.method === 'DELETE')!
    expect(remove.url).toMatch(/\/api\/activity-entries\/entry-camminata$/)
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="activity-row"]')).toHaveLength(0)
  })

  it('keeps the edit flow open and shows the server error when the update fails', async () => {
    stubActivityEditDay()
    fetchStub().intercept(
      (request) => request.method === 'PUT',
      () => Response.json({ error: 'La data locale non è valida.' }, { status: 400 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityEdit(wrapper)

    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('La data locale non è valida.')
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(true)
  })
})

describe('activity catalog management', () => {
  it('renames a catalog activity from the flow and shows the new name', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'PATCH' && request.url.endsWith('/api/activities/act-corsa'),
      () => Response.json({ id: 'act-corsa', name: 'Corsa su strada', lastUsedAt: null }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[aria-label="Rinomina Corsa"]').trigger('click')
    expect(
      (wrapper.get('#catalog-activity-name').element as HTMLInputElement).value,
    ).toBe('Corsa')

    await wrapper.get('#catalog-activity-name').setValue('  Corsa su strada ')
    await wrapper.get('[data-testid="save-rename-activity"]').trigger('click')
    await flushPromises()

    const patch = fetchStub().requests.find((request) => request.method === 'PATCH')!
    expect(patch.url).toMatch(/\/api\/activities\/act-corsa$/)
    expect(await patch.json()).toEqual({ name: 'Corsa su strada' })

    expect(
      wrapper.findAll('[data-testid="activity-option"]').map((option) => option.text()),
    ).toEqual(['Corsa su strada', 'Yoga'])
    expect(wrapper.find('[data-testid="rename-activity"]').exists()).toBe(false)
  })

  it('blocks an empty name without calling the server', async () => {
    stubDay()
    stubActivities()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[aria-label="Rinomina Corsa"]').trigger('click')
    await wrapper.get('#catalog-activity-name').setValue('   ')
    await wrapper.get('[data-testid="save-rename-activity"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("Il nome dell'attività è obbligatorio.")
    expect(fetchStub().requests.some((request) => request.method === 'PATCH')).toBe(false)
    expect(wrapper.find('[data-testid="rename-activity"]').exists()).toBe(true)
  })

  it('keeps the rename panel open and shows the server message when the rename fails', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'PATCH',
      () => Response.json({ error: 'Il nome può essere lungo al massimo 80 caratteri.' }, { status: 400 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[aria-label="Rinomina Corsa"]').trigger('click')
    await wrapper.get('[data-testid="save-rename-activity"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Il nome può essere lungo al massimo 80 caratteri.')
    expect(wrapper.find('[data-testid="rename-activity"]').exists()).toBe(true)
  })

  it('deletes a catalog activity only after confirmation and explains the saved entries', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'DELETE' && request.url.endsWith('/api/activities/act-yoga'),
      () => new Response(null, { status: 204 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[aria-label="Elimina Yoga"]').trigger('click')
    expect(fetchStub().requests.some((request) => request.method === 'DELETE')).toBe(false)
    expect(wrapper.get('[data-testid="confirm-delete-catalog"]').text()).toContain(
      'Le voci già registrate non cambiano',
    )

    await wrapper.get('[data-testid="cancel-delete-catalog"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-delete-catalog"]').exists()).toBe(false)
    expect(fetchStub().requests.some((request) => request.method === 'DELETE')).toBe(false)

    await wrapper.get('[aria-label="Elimina Yoga"]').trigger('click')
    await wrapper.get('[data-testid="confirm-delete-catalog-button"]').trigger('click')
    await flushPromises()

    const remove = fetchStub().requests.find((request) => request.method === 'DELETE')!
    expect(remove.url).toMatch(/\/api\/activities\/act-yoga$/)
    expect(
      wrapper.findAll('[data-testid="activity-option"]').map((option) => option.text()),
    ).toEqual(['Corsa'])
  })

  it('clears the selection when the selected catalog activity is deleted', async () => {
    stubDay()
    stubActivities()
    fetchStub().intercept(
      (request) => request.method === 'DELETE' && request.url.endsWith('/api/activities/act-corsa'),
      () => new Response(null, { status: 204 }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityFlow(wrapper)

    await wrapper.get('[data-testid="activity-option"]').trigger('click')
    await wrapper.get('[aria-label="Elimina Corsa"]').trigger('click')
    await wrapper.get('[data-testid="confirm-delete-catalog-button"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("Scegli un'attività.")
    expect(
      fetchStub().requests.filter(
        (request) => request.method === 'POST' && request.url.endsWith('/api/activity-entries'),
      ),
    ).toHaveLength(0)
  })

  it('requires an existing activity to save an entry whose catalog entry was deleted', async () => {
    fetchStub().intercept(/\/api\/days\//, () => Response.json(DAY_WITH_ACTIVITY))
    fetchStub().intercept(
      (request) => request.method === 'GET' && request.url.endsWith('/api/activities'),
      () => Response.json([{ id: 'act-yoga', name: 'Yoga', lastUsedAt: null }]),
    )
    fetchStub().intercept(
      (request) => request.method === 'PUT' && request.url.endsWith('/api/activity-entries/entry-camminata'),
      () => Response.json({ id: 'entry-camminata' }),
    )

    const wrapper = mount(HomeView)
    await flushPromises()
    await openActivityEdit(wrapper)

    expect(
      wrapper
        .findAll('[data-testid="activity-option"]')
        .every((option) => option.attributes('aria-pressed') === 'false'),
    ).toBe(true)

    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain("Scegli un'attività.")
    expect(fetchStub().requests.some((request) => request.method === 'PUT')).toBe(false)

    await wrapper
      .findAll('[data-testid="activity-option"]')
      .find((option) => option.text() === 'Yoga')!
      .trigger('click')
    await wrapper.get('[data-testid="save-activity"]').trigger('click')
    await flushPromises()

    const put = fetchStub().requests.find((request) => request.method === 'PUT')!
    expect(await put.json()).toMatchObject({ activityId: 'act-yoga' })
    expect(wrapper.find('[data-testid="add-activity-flow"]').exists()).toBe(false)
  })
  it('offers add actions on an empty day', async () => {
    stubDay(EMPTY_DAY)

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nessun pasto o attività')
    await wrapper.get('[data-testid="empty-add-meal"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="add-meal-flow"]').exists()).toBe(true)
  })

  it('returns to today and changes day with a horizontal swipe', async () => {
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('[data-testid="back-to-today"]').exists()).toBe(false)

    const root = wrapper.get('[data-testid="home-view"]')
    await root.trigger('touchstart', { changedTouches: [{ clientX: 240, clientY: 120 }] })
    await root.trigger('touchend', { changedTouches: [{ clientX: 120, clientY: 125 }] })
    await flushPromises()

    const lastDayUrl = () =>
      new URL(fetchStub().requests.filter((request) => request.url.includes('/api/days/')).at(-1)!.url)
    expect(lastDayUrl().pathname.endsWith('/2026-11-06')).toBe(true)

    await wrapper.get('[data-testid="back-to-today"]').trigger('click')
    await flushPromises()
    expect(lastDayUrl().pathname.endsWith('/2026-11-05')).toBe(true)
  })

  it('closes the meal flow with Escape', async () => {
    stubDay()

    const wrapper = mount(HomeView)
    await flushPromises()
    await openMealFlow(wrapper)

    expect(wrapper.find('[data-testid="add-meal-flow"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(wrapper.find('[data-testid="add-meal-flow"]').exists()).toBe(false)
  })

})

const STATS = {
  targetKcal: 2200,
  days: [
    { date: '2026-10-28', kcal: 1900, meals: 2 },
    { date: '2026-11-01', kcal: 2100, meals: 3 },
    { date: '2026-11-03', kcal: 1800, meals: 1 },
  ],
}

function stubStats(stats: unknown = STATS): void {
  fetchStub().intercept(/\/api\/stats/, () => Response.json(stats))
}

describe('calorie trend section', () => {
  it('loads the 28-day interval with one request and renders the day view', async () => {
    stubDay()
    stubStats()

    const wrapper = mount(HomeView)
    await flushPromises()

    const statsRequests = fetchStub().requests.filter((request) => request.url.includes('/api/stats'))
    expect(statsRequests).toHaveLength(1)
    const url = new URL(statsRequests[0]!.url)
    expect(url.searchParams.get('from')).toBe('2026-10-09')
    expect(url.searchParams.get('to')).toBe('2026-11-05')

    expect(wrapper.find('[data-testid="trend-section"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="trend-bar"]')).toHaveLength(3)
    expect(wrapper.get('[data-testid="trend-recorded"]').text()).toBe('3 su 14')
  })

  it('selects the day of a tapped bar and reloads the diary', async () => {
    fetchStub().intercept(/\/api\/days\//, (request) =>
      Response.json({ ...EMPTY_DAY, date: request.url.split('/').pop() }),
    )
    fetchStub().intercept(/\/api\/foods$/, () => Response.json(FAVORITES))
    stubStats()

    const wrapper = mount(HomeView)
    await flushPromises()

    const bar = wrapper
      .findAll('[data-testid="trend-bar"]')
      .find((item) => item.attributes('aria-label')!.startsWith('3 novembre'))!
    await bar.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="day-label"]').text()).toContain('3')
    const dayRequests = fetchStub().requests.filter(
      (request) => request.method === 'GET' && request.url.includes('/api/days/'),
    )
    expect(new URL(dayRequests.at(-1)!.url).pathname).toBe('/api/days/2026-11-03')
  })

  it('switches view with one request per period and remembers the choice', async () => {
    stubDay()
    stubStats()

    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.get('[data-testid="trend-view-week"]').trigger('click')
    await flushPromises()

    let statsRequests = fetchStub().requests.filter((request) => request.url.includes('/api/stats'))
    expect(statsRequests).toHaveLength(2)
    let url = new URL(statsRequests.at(-1)!.url)
    expect(url.searchParams.get('from')).toBe('2026-07-20')
    expect(url.searchParams.get('to')).toBe('2026-11-05')
    expect(wrapper.get('[data-testid="trend-view-week"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="trend-view-month"]').trigger('click')
    await flushPromises()

    statsRequests = fetchStub().requests.filter((request) => request.url.includes('/api/stats'))
    expect(statsRequests).toHaveLength(3)
    url = new URL(statsRequests.at(-1)!.url)
    expect(url.searchParams.get('from')).toBe('2024-12-01')
    expect(url.searchParams.get('to')).toBe('2026-11-05')
    expect(wrapper.get('[data-testid="trend-view-month"]').attributes('aria-pressed')).toBe('true')
  })

  it('shows the empty state when the last 14 days have no meals', async () => {
    stubDay()
    stubStats({ targetKcal: null, days: [{ date: '2026-09-01', kcal: 1500, meals: 1 }] })

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.get('[data-testid="trend-empty"]').text()).toContain('Nessun giorno con pasti')
  })
})
