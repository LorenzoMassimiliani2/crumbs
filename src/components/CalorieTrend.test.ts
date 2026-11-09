import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CalorieTrend from './CalorieTrend.vue'
import type { Stats, TrendView } from '@/lib/stats'

const today = '2026-11-09'

const STATS: Stats = {
  targetKcal: 2000,
  days: [
    { date: '2026-10-20', kcal: 1600, meals: 1 },
    { date: '2026-10-21', kcal: 2000, meals: 1 },
    { date: '2026-11-01', kcal: 1800, meals: 2 },
    { date: '2026-11-05', kcal: 2200, meals: 3 },
  ],
}

function mountTrend(stats: Stats = STATS, view: TrendView = 'day') {
  return mount(CalorieTrend, { props: { stats, today, view } })
}

describe('CalorieTrend', () => {
  it('renders one bar per day with meals and an accessible tooltip for each', () => {
    const wrapper = mountTrend()
    const bars = wrapper.findAll('[data-testid="trend-bar"]')

    expect(bars).toHaveLength(2)
    expect(bars[0]!.attributes('aria-label')).toBe('1 novembre 2026: 1800 kcal, 2 pasti')
    expect(bars[1]!.attributes('aria-label')).toBe('5 novembre 2026: 2200 kcal, 3 pasti')
    expect(bars.map((bar) => bar.get('title').text())).toEqual([
      '1 novembre 2026: 1800 kcal, 2 pasti',
      '5 novembre 2026: 2200 kcal, 3 pasti',
    ])
  })

  it('summarizes average, recorded days and the change against the previous period', () => {
    const wrapper = mountTrend()

    expect(wrapper.get('[data-testid="trend-average"]').text()).toBe('2000')
    expect(wrapper.get('[data-testid="trend-recorded"]').text()).toBe('2 su 14')
    expect(wrapper.get('[data-testid="trend-change"]').text()).toBe(
      '+11% rispetto ai 14 giorni precedenti',
    )
  })

  it('hides the change when the previous period has no meals', () => {
    const wrapper = mountTrend({
      targetKcal: 2000,
      days: [{ date: '2026-11-05', kcal: 2200, meals: 1 }],
    })

    expect(wrapper.find('[data-testid="trend-change"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="trend-average"]').exists()).toBe(true)
  })

  it('draws the current target line with its label', () => {
    const wrapper = mountTrend()

    expect(wrapper.find('[data-testid="trend-target-line"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="trend-target-label"]').text()).toBe('Target attuale 2000 kcal')
  })

  it('does not draw the target line without a target', () => {
    const wrapper = mountTrend({ ...STATS, targetKcal: null })

    expect(wrapper.find('[data-testid="trend-target-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="trend-target-label"]').exists()).toBe(false)
  })

  it('shows an empty state when the window has no days with meals', () => {
    const wrapper = mountTrend({ targetKcal: 2000, days: [] })

    expect(wrapper.get('[data-testid="trend-empty"]').text()).toContain('Nessun giorno con pasti')
    expect(wrapper.find('svg[role="group"]').exists()).toBe(false)
  })

  it('labels a few well-spaced days on the X axis', () => {
    const wrapper = mountTrend()
    const labels = wrapper.findAll('svg text').map((label) => label.text())

    expect(labels).toContain('28/10')
    expect(labels).toContain('1/11')
    expect(labels).toContain('5/11')
    expect(labels).toContain('9/11')
  })

  it('emits the day when a bar is clicked or activated from the keyboard', async () => {
    const wrapper = mountTrend()
    const bars = wrapper.findAll('[data-testid="trend-bar"]')

    await bars[0]!.trigger('click')
    await bars[1]!.trigger('keydown.enter')

    expect(wrapper.emitted('select')).toEqual([['2026-11-01'], ['2026-11-05']])
  })
})

describe('CalorieTrend views', () => {
  it('offers the day, week and month views with day as the default', async () => {
    const wrapper = mountTrend()

    const options = wrapper.findAll('[data-testid^="trend-view-"]')
    expect(options.map((option) => option.text())).toEqual(['Giorno', 'Settimana', 'Mese'])
    expect(wrapper.get('[data-testid="trend-view-day"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="trend-view-week"]').attributes('aria-pressed')).toBe('false')

    await wrapper.get('[data-testid="trend-view-month"]').trigger('click')
    expect(wrapper.emitted('update:view')).toEqual([['month']])
  })

  it('renders one bar per week with the average of its days with meals', () => {
    const wrapper = mountTrend(
      {
        targetKcal: 2000,
        days: [
          { date: '2026-09-10', kcal: 1600, meals: 1 },
          { date: '2026-11-03', kcal: 1800, meals: 1 },
          { date: '2026-11-05', kcal: 2200, meals: 1 },
        ],
      },
      'week',
    )

    const bars = wrapper.findAll('[data-testid="trend-bar"]')
    expect(bars).toHaveLength(1)
    expect(bars[0]!.attributes('aria-label')).toBe(
      'Settimana 2–8 novembre 2026: 2000 kcal di media, 2 giorni registrati',
    )
    expect(wrapper.get('[data-testid="trend-average"]').text()).toBe('2000')
    expect(wrapper.get('[data-testid="trend-recorded"]').text()).toBe('2 su 50')
    expect(wrapper.get('[data-testid="trend-change"]').text()).toBe(
      '+25% rispetto alle 8 settimane precedenti',
    )
  })

  it('does not select a day when a week or month bar is tapped', async () => {
    const week = mountTrend(STATS, 'week')
    await week.findAll('[data-testid="trend-bar"]')[0]!.trigger('click')
    expect(week.emitted('select')).toBeUndefined()

    const month = mountTrend(STATS, 'month')
    await month.findAll('[data-testid="trend-bar"]')[0]!.trigger('click')
    expect(month.emitted('select')).toBeUndefined()
  })

  it('renders month bars with an accessible tooltip', () => {
    const wrapper = mountTrend(
      {
        targetKcal: 2000,
        days: [
          { date: '2026-10-20', kcal: 1600, meals: 1 },
          { date: '2026-11-05', kcal: 2200, meals: 1 },
        ],
      },
      'month',
    )

    const bars = wrapper.findAll('[data-testid="trend-bar"]')
    expect(bars).toHaveLength(2)
    expect(bars[1]!.attributes('aria-label')).toBe(
      'Novembre 2026: 2200 kcal di media, 1 giorno registrato',
    )
    expect(bars[1]!.get('title').text()).toBe(bars[1]!.attributes('aria-label'))
  })

  it('shows the empty state of the selected view', () => {
    const wrapper = mountTrend({ targetKcal: 2000, days: [] }, 'month')

    expect(wrapper.get('[data-testid="trend-empty"]').text()).toBe(
      'Nessun giorno con pasti negli ultimi 12 mesi.',
    )
  })
})
