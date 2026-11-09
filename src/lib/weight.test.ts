import { describe, expect, it } from 'vitest'

import { formatWeightChange, weightChartModel, weightSummary } from './weight'

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

describe('weightChartModel', () => {
  const today = '2026-11-09'

  it('keeps only measurements of the last N days, sorted and excluding the future', () => {
    const model = weightChartModel(
      [
        { date: '2026-11-10', weight: 70 },
        { date: '2026-11-09', weight: 78 },
        { date: '2026-09-12', weight: 79 },
        { date: '2026-08-11', weight: 100 },
        { date: '2026-08-12', weight: 80 },
      ],
      90,
      today,
    )

    expect(model.points.map((point) => point.date)).toEqual([
      '2026-08-12',
      '2026-09-12',
      '2026-11-09',
    ])
  })

  it('positions points on the period window from the first day to today', () => {
    const model = weightChartModel(
      [
        { date: '2026-08-12', weight: 80 },
        { date: '2026-09-12', weight: 79 },
        { date: '2026-11-09', weight: 78 },
      ],
      90,
      today,
    )

    expect(model.points[0]!.x).toBeCloseTo(0, 6)
    expect(model.points[1]!.x).toBeCloseTo(31 / 89, 6)
    expect(model.points[2]!.x).toBeCloseTo(1, 6)
  })

  it('adds a margin around the values instead of starting from zero', () => {
    const model = weightChartModel(
      [
        { date: '2026-11-08', weight: 78 },
        { date: '2026-11-09', weight: 80 },
      ],
      90,
      today,
    )

    expect(model.yMin).toBeCloseTo(77.7, 6)
    expect(model.yMax).toBeCloseTo(80.3, 6)
    // The lowest and highest values sit one padding step inside the plot, not on its edges.
    expect(model.points[0]!.y).toBeCloseTo(1 - 0.3 / 2.6, 6)
    expect(model.points[1]!.y).toBeCloseTo(0.3 / 2.6, 6)
  })

  it('centres a single measurement with a readable scale', () => {
    const model = weightChartModel([{ date: '2026-11-09', weight: 78 }], 90, today)

    expect(model.points).toHaveLength(1)
    expect(model.points[0]!.x).toBeCloseTo(0.5, 6)
    expect(model.points[0]!.y).toBeCloseTo(0.5, 6)
    expect(model.yMin).toBeCloseTo(77.5, 6)
    expect(model.yMax).toBeCloseTo(78.5, 6)
  })

  it('uses all measurements for the "all" period, spanning the first to the last date', () => {
    const model = weightChartModel(
      [
        { date: '2025-01-01', weight: 90 },
        { date: '2025-07-02', weight: 85 },
        { date: '2026-11-09', weight: 80 },
      ],
      'all',
      today,
    )

    expect(model.points).toHaveLength(3)
    expect(model.points[0]!.x).toBeCloseTo(0, 6)
    expect(model.points[1]!.x).toBeCloseTo(182 / 677, 6)
    expect(model.points[2]!.x).toBeCloseTo(1, 6)
  })

  it('centres a single measurement in the "all" period too', () => {
    const model = weightChartModel([{ date: '2025-01-01', weight: 90 }], 'all', today)

    expect(model.points[0]!.x).toBeCloseTo(0.5, 6)
    expect(model.points[0]!.y).toBeCloseTo(0.5, 6)
  })

  it('returns no points and no scale when the period has no measurements', () => {
    const model = weightChartModel([{ date: '2026-08-11', weight: 100 }], 30, today)

    expect(model.points).toEqual([])
    expect(model.yMin).toBe(0)
    expect(model.yMax).toBe(0)
  })
})
