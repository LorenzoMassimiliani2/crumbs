import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WeightChart from './WeightChart.vue'

const today = '2026-11-09'

describe('WeightChart', () => {
  it('defaults to 90 days and renders one accessible point per measurement', () => {
    const wrapper = mount(WeightChart, {
      props: {
        today,
        entries: [
          { date: '2025-01-01', weight: 90 },
          { date: '2026-11-08', weight: 78 },
          { date: '2026-11-09', weight: 80 },
        ],
      },
    })

    expect(wrapper.get('[data-testid="chart-period-90"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('circle')).toHaveLength(2)

    const titles = wrapper.findAll('circle title').map((title) => title.text())
    expect(titles).toEqual(['8 novembre 2026: 78,0 kg', '9 novembre 2026: 80,0 kg'])
  })

  it('filters the measurements when the period changes', async () => {
    const wrapper = mount(WeightChart, {
      props: {
        today,
        entries: [
          { date: '2025-01-01', weight: 90 },
          { date: '2026-11-08', weight: 78 },
          { date: '2026-11-09', weight: 80 },
        ],
      },
    })

    await wrapper.get('[data-testid="chart-period-all"]').trigger('click')

    expect(wrapper.get('[data-testid="chart-period-all"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('circle')).toHaveLength(3)
  })

  it('shows an empty state when the selected period has no measurements', () => {
    const wrapper = mount(WeightChart, {
      props: { today, entries: [{ date: '2025-01-01', weight: 90 }] },
    })

    expect(wrapper.text()).toContain('Nessuna misura nel periodo')
    expect(wrapper.findAll('circle')).toHaveLength(0)
  })

  it('keeps the chart readable with a single measurement', async () => {
    const wrapper = mount(WeightChart, {
      props: { today, entries: [{ date: '2026-11-09', weight: 78 }] },
    })

    expect(wrapper.findAll('circle')).toHaveLength(1)
    expect(wrapper.get('svg').attributes('aria-label')).toContain('1 misura')
  })
})
