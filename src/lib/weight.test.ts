import { describe, expect, it } from 'vitest'

import { formatWeightChange, weightSummary } from './weight'

describe('weightSummary', () => {
  it('uses the last ascending entry as current and the previous one for the change', () => {
    const summary = weightSummary([
      { date: '2026-10-01', weight: 80 },
      { date: '2026-11-01', weight: 79.5 },
      { date: '2026-11-05', weight: 78 },
    ])

    expect(summary.current).toEqual({ date: '2026-11-05', weight: 78 })
    expect(summary.previous).toEqual({ date: '2026-11-01', weight: 79.5 })
    expect(summary.change).toBe(-1.5)
  })

  it('has no change with fewer than two entries and handles a float-safe difference', () => {
    expect(weightSummary([])).toEqual({ current: null, previous: null, change: null })

    const single = weightSummary([{ date: '2026-11-05', weight: 78 }])
    expect(single.current?.weight).toBe(78)
    expect(single.change).toBeNull()

    const two = weightSummary([
      { date: '2026-11-04', weight: 78.1 },
      { date: '2026-11-05', weight: 78.3 },
    ])
    expect(two.change).toBe(0.2)
  })
})

describe('formatWeightChange', () => {
  it('adds a sign only to positive changes', () => {
    expect(formatWeightChange(0.5)).toBe('+0,5 kg')
    expect(formatWeightChange(-1.2)).toBe('-1,2 kg')
    expect(formatWeightChange(0)).toBe('0,0 kg')
  })
})
