import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { pendingTrendDate, trendView } from '@/composables/trendState'
import { fetchStub } from '@/test/fetch'
import TrendView from './TrendView.vue'

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

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Diario</div>' } },
      { path: '/trend', component: TrendView },
    ],
  })
  await router.push('/trend')
  await router.isReady()

  const wrapper = mount(TrendView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 5, 12, 0, 0))
  trendView.value = 'day'
  pendingTrendDate.value = null
})

describe('TrendView', () => {
  it('loads the 28-day interval with one request and renders the day view', async () => {
    stubStats()

    const { wrapper } = await mountView()

    const statsRequests = fetchStub().requests.filter((request) => request.url.includes('/api/stats'))
    expect(statsRequests).toHaveLength(1)
    const url = new URL(statsRequests[0]!.url)
    expect(url.searchParams.get('from')).toBe('2026-10-09')
    expect(url.searchParams.get('to')).toBe('2026-11-05')

    expect(wrapper.findAll('[data-testid="trend-bar"]')).toHaveLength(3)
    expect(wrapper.get('[data-testid="trend-recorded"]').text()).toBe('3 su 14')
  })

  it('switches view and requests the period with its comparison window', async () => {
    stubStats()

    const { wrapper } = await mountView()

    await wrapper.get('[data-testid="trend-view-week"]').trigger('click')
    await flushPromises()

    let statsRequests = fetchStub().requests.filter((request) => request.url.includes('/api/stats'))
    let url = new URL(statsRequests.at(-1)!.url)
    expect(url.searchParams.get('from')).toBe('2026-07-20')
    expect(url.searchParams.get('to')).toBe('2026-11-05')
    expect(wrapper.get('[data-testid="trend-view-week"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="trend-view-month"]').trigger('click')
    await flushPromises()

    statsRequests = fetchStub().requests.filter((request) => request.url.includes('/api/stats'))
    url = new URL(statsRequests.at(-1)!.url)
    expect(url.searchParams.get('from')).toBe('2024-12-01')
    expect(wrapper.get('[data-testid="trend-view-month"]').attributes('aria-pressed')).toBe('true')
  })

  it('returns to the diary on the day of a tapped bar', async () => {
    stubStats()

    const { wrapper, router } = await mountView()

    const bar = wrapper
      .findAll('[data-testid="trend-bar"]')
      .find((item) => item.attributes('aria-label')!.startsWith('3 novembre'))!
    await bar.trigger('click')
    await flushPromises()

    expect(pendingTrendDate.value).toBe('2026-11-03')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('shows the empty state when the period has no data', async () => {
    stubStats({ targetKcal: 2200, days: [] })

    const { wrapper } = await mountView()

    expect(wrapper.get('[data-testid="trend-empty"]').text()).toContain('Nessun giorno con pasti')
  })
})
