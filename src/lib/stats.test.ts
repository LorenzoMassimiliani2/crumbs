import { describe, expect, it } from 'vitest'

import {
  addDays,
  axisLabelIndices,
  buildDayTrend,
  formatTrendDate,
  formatTrendDay,
  trendRange,
  type Stats,
} from './stats'

const today = '2026-11-09'

function stats(days: Stats['days'], targetKcal: number | null = 2000): Stats {
  return { targetKcal, days }
}

describe('date helpers', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-11-04', 3)).toBe('2026-11-07')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('covers both the current and the previous 14 days with one interval', () => {
    expect(trendRange(today)).toEqual({ from: '2026-10-13', to: '2026-11-09' })
  })

  it('formats dates without timezone shifts', () => {
    expect(formatTrendDay('2026-11-04')).toBe('4/11')
    expect(formatTrendDate('2026-11-04')).toBe('4 novembre 2026')
  })
})

describe('buildDayTrend', () => {
  it('uses the 14 days ending today and excludes future days', () => {
    const model = buildDayTrend(
      stats([
        { date: '2026-11-01', kcal: 1800, meals: 2 },
        { date: '2026-11-10', kcal: 500, meals: 1 },
      ]),
      today,
    )

    expect(model.days).toHaveLength(14)
    expect(model.days[0]).toBe('2026-10-27')
    expect(model.days.at(-1)).toBe('2026-11-09')
    expect(model.bars.map((bar) => bar.date)).toEqual(['2026-11-01'])
  })

  it('draws one bar per day with meals, positioned inside the window', () => {
    const model = buildDayTrend(
      stats([
        { date: '2026-11-01', kcal: 1800, meals: 2 },
        { date: '2026-11-05', kcal: 2200, meals: 3 },
      ]),
      today,
    )

    expect(model.bars.map((bar) => bar.date)).toEqual(['2026-11-01', '2026-11-05'])
    expect(model.bars.map((bar) => bar.slot)).toEqual([5, 9])
    expect(model.bars[0]!.x).toBeCloseTo(5 / 14, 6)
    expect(model.bars[1]!.x).toBeCloseTo(9 / 14, 6)
    expect(model.bars[0]!.width).toBeCloseTo(0.6 / 14, 6)
  })

  it('averages only the days with meals and counts them over the 14 days elapsed', () => {
    const model = buildDayTrend(
      stats([
        { date: '2026-11-01', kcal: 1800, meals: 2 },
        { date: '2026-11-05', kcal: 2200, meals: 3 },
      ]),
      today,
    )

    expect(model.averageKcal).toBe(2000)
    expect(model.recordedDays).toBe(2)
    expect(model.totalDays).toBe(14)
  })

  it('compares with the previous 14 days only when both periods have meals', () => {
    const withPrevious = buildDayTrend(
      stats([
        { date: '2026-10-20', kcal: 1600, meals: 1 },
        { date: '2026-10-21', kcal: 2000, meals: 1 },
        { date: '2026-11-05', kcal: 2200, meals: 1 },
      ]),
      today,
    )
    expect(withPrevious.previousAverageKcal).toBe(1800)
    expect(withPrevious.changePercent).toBe(22)

    const withoutPrevious = buildDayTrend(
      stats([{ date: '2026-11-05', kcal: 2200, meals: 1 }]),
      today,
    )
    expect(withoutPrevious.previousAverageKcal).toBeNull()
    expect(withoutPrevious.changePercent).toBeNull()
  })

  it('has no averages or bars when the window has no days with meals', () => {
    const model = buildDayTrend(
      stats([{ date: '2026-10-20', kcal: 1600, meals: 1 }]),
      today,
    )

    expect(model.bars).toEqual([])
    expect(model.averageKcal).toBeNull()
    expect(model.recordedDays).toBe(0)
    expect(model.changePercent).toBeNull()
  })

  it('scales bars and the target line on a readable axis', () => {
    const model = buildDayTrend(
      stats([
        { date: '2026-11-01', kcal: 1800, meals: 1 },
        { date: '2026-11-05', kcal: 2200, meals: 1 },
      ]),
      today,
    )

    expect(model.yMax).toBe(2500)
    expect(model.bars[0]!.height).toBeCloseTo(1800 / 2500, 6)
    expect(model.bars[1]!.height).toBeCloseTo(2200 / 2500, 6)
    expect(model.targetY).toBeCloseTo(2000 / 2500, 6)
  })

  it('keeps the target line above the tallest bar even when kcal exceeds it', () => {
    const model = buildDayTrend(
      stats([{ date: '2026-11-05', kcal: 3000, meals: 1 }], 2000),
      today,
    )

    expect(model.yMax).toBe(3300)
    expect(model.targetY).toBeCloseTo(2000 / 3300, 6)
  })

  it('has no target line when the profile has no target', () => {
    const model = buildDayTrend(
      stats([{ date: '2026-11-05', kcal: 2200, meals: 1 }], null),
      today,
    )

    expect(model.targetKcal).toBeNull()
    expect(model.targetY).toBeNull()
    expect(model.yMax).toBe(2500)
  })
})

describe('axisLabelIndices', () => {
  it('labels every slot when they fit', () => {
    expect(axisLabelIndices(3)).toEqual([0, 1, 2])
  })

  it('spaces the labels of a 14-day window so they cannot overlap', () => {
    const indices = axisLabelIndices(14)

    expect(indices.at(-1)).toBe(13)
    expect(indices.length).toBeLessThanOrEqual(5)
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]! - indices[i - 1]!).toBeGreaterThanOrEqual(3)
    }
  })

  it('has no labels for an empty axis', () => {
    expect(axisLabelIndices(0)).toEqual([])
  })
})
