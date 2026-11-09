import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CalorieTrend from './CalorieTrend.vue'
import type { Stats } from '@/lib/stats'

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

function mountTrend(stats: Stats = STATS) {
  return mount(CalorieTrend, { props: { stats, today } })
}

describe('CalorieTrend', () => {
  it('starts expanded and can be collapsed', async () => {
    const wrapper = mountTrend()

    expect(wrapper.get('[data-testid="trend-toggle"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('svg[role="group"]').exists()).toBe(true)

    await wrapper.get('[data-testid="trend-toggle"]').trigger('click')

    expect(wrapper.get('[data-testid="trend-toggle"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('svg[role="group"]').exists()).toBe(false)
  })

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
