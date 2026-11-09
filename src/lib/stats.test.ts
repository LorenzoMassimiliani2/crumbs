import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  axisLabelIndices,
  buildDayTrend,
  buildTrend,
  formatMonthLabel,
  formatMonthShort,
  formatTrendDate,
  formatTrendDay,
  formatWeekRange,
  startOfMonth,
  startOfWeek,
  trendRange,
  trendRangeFor,
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

describe('period helpers', () => {
  it('finds the Monday of the week and the first day of the month', () => {
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09')
    expect(startOfWeek('2026-11-05')).toBe('2026-11-02')
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02')
    expect(startOfMonth('2026-11-05')).toBe('2026-11-01')
  })

  it('moves across month and year boundaries', () => {
    expect(addMonths('2026-11-01', -11)).toBe('2025-12-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
  })

  it('covers the current and previous period of every view with one interval', () => {
    expect(trendRangeFor('day', today)).toEqual({ from: '2026-10-13', to: '2026-11-09' })
    expect(trendRangeFor('week', today)).toEqual({ from: '2026-07-27', to: '2026-11-09' })
    expect(trendRangeFor('month', today)).toEqual({ from: '2024-12-01', to: '2026-11-09' })
  })

  it('formats week and month periods', () => {
    expect(formatWeekRange('2026-11-02')).toBe('2–8 novembre 2026')
    expect(formatWeekRange('2026-10-26')).toBe('26 ottobre – 1 novembre 2026')
    expect(formatMonthLabel('2026-11-01')).toBe('Novembre 2026')
    expect(formatMonthShort('2026-11-01')).toBe('nov')
  })
})

describe('buildTrend view dispatch', () => {
  it('returns the day model by default', () => {
    const model = buildTrend(stats([{ date: '2026-11-05', kcal: 2200, meals: 1 }]), 'day', today)
    expect(model.view).toBe('day')
    expect(model.days).toHaveLength(14)
  })
})

describe('buildWeekTrend', () => {
  it('uses 8 calendar weeks ending with the current one and excludes future days', () => {
    const model = buildTrend(
      stats([
        { date: '2026-08-01', kcal: 1000, meals: 1 },
        { date: '2026-09-21', kcal: 1400, meals: 1 },
        { date: '2026-11-09', kcal: 2100, meals: 2 },
        { date: '2026-11-10', kcal: 9999, meals: 1 },
      ]),
      'week',
      today,
    )

    expect(model.view).toBe('week')
    expect(model.days).toHaveLength(8)
    expect(model.days[0]).toBe('2026-09-21')
    expect(model.days.at(-1)).toBe('2026-11-09')
    expect(model.bars.map((bar) => bar.date)).toEqual(['2026-09-21', '2026-11-09'])
    expect(model.bars.map((bar) => bar.slot)).toEqual([0, 7])
    expect(model.recordedDays).toBe(2)
    expect(model.totalDays).toBe(50)
    expect(model.averageKcal).toBe(1750)
  })

  it('averages the days with meals inside each week and counts them', () => {
    const model = buildTrend(
      stats([
        { date: '2026-11-03', kcal: 1800, meals: 2 },
        { date: '2026-11-05', kcal: 2200, meals: 3 },
      ]),
      'week',
      today,
    )

    expect(model.bars).toHaveLength(1)
    const bar = model.bars[0]!
    expect(bar.date).toBe('2026-11-02')
    expect(bar.kcal).toBe(2000)
    expect(bar.recordedDays).toBe(2)
    expect(bar.meals).toBe(5)
    expect(bar.x).toBeCloseTo(6 / 8, 6)
    expect(bar.width).toBeCloseTo(0.6 / 8, 6)
  })

  it('compares with the 8 previous weeks only when both periods have meals', () => {
    const withPrevious = buildTrend(
      stats([
        { date: '2026-09-10', kcal: 1500, meals: 1 },
        { date: '2026-11-03', kcal: 1800, meals: 1 },
        { date: '2026-11-05', kcal: 2200, meals: 1 },
      ]),
      'week',
      today,
    )
    expect(withPrevious.previousAverageKcal).toBe(1500)
    expect(withPrevious.changePercent).toBe(33)
    expect(withPrevious.changeLabel).toBe('rispetto alle 8 settimane precedenti')

    const withoutPrevious = buildTrend(
      stats([{ date: '2026-11-05', kcal: 2200, meals: 1 }]),
      'week',
      today,
    )
    expect(withoutPrevious.changePercent).toBeNull()
    expect(withoutPrevious.changeLabel).toBeNull()
  })

  it('shows an empty state when the 8 weeks have no meals', () => {
    const model = buildTrend(stats([{ date: '2026-01-01', kcal: 1500, meals: 1 }]), 'week', today)

    expect(model.bars).toEqual([])
    expect(model.averageKcal).toBeNull()
    expect(model.emptyLabel).toBe('Nessun giorno con pasti nelle ultime 8 settimane.')
  })

  it('labels every bar with period, average and recorded days', () => {
    const model = buildTrend(
      stats([
        { date: '2026-11-03', kcal: 1800, meals: 1 },
        { date: '2026-11-05', kcal: 2200, meals: 1 },
      ]),
      'week',
      today,
    )

    expect(model.bars[0]!.label).toBe(
      'Settimana 2–8 novembre 2026: 2000 kcal di media, 2 giorni registrati',
    )
  })
})

describe('buildMonthTrend', () => {
  it('uses 12 calendar months ending with the current one', () => {
    const model = buildTrend(
      stats([
        { date: '2025-12-25', kcal: 1500, meals: 1 },
        { date: '2026-11-05', kcal: 2200, meals: 1 },
        { date: '2026-11-10', kcal: 9999, meals: 1 },
      ]),
      'month',
      today,
    )

    expect(model.view).toBe('month')
    expect(model.days).toHaveLength(12)
    expect(model.days[0]).toBe('2025-12-01')
    expect(model.days.at(-1)).toBe('2026-11-01')
    expect(model.bars.map((bar) => bar.key)).toEqual(['2025-12', '2026-11'])
    expect(model.bars.map((bar) => bar.slot)).toEqual([0, 11])
    expect(model.recordedDays).toBe(2)
  })

  it('averages the days with meals inside each month and counts the elapsed days', () => {
    const model = buildTrend(
      stats([
        { date: '2026-11-02', kcal: 1800, meals: 1 },
        { date: '2026-11-05', kcal: 2200, meals: 2 },
      ]),
      'month',
      today,
    )

    const bar = model.bars[0]!
    expect(bar.date).toBe('2026-11-01')
    expect(bar.kcal).toBe(2000)
    expect(bar.recordedDays).toBe(2)
    expect(model.totalDays).toBe(
      // Days from 1 December 2025 to today, both included.
      Math.floor((Date.UTC(2026, 10, 9) - Date.UTC(2025, 11, 1)) / 86_400_000) + 1,
    )
    expect(bar.label).toBe('Novembre 2026: 2000 kcal di media, 2 giorni registrati')
  })

  it('compares with the 12 previous months only when both periods have meals', () => {
    const withPrevious = buildTrend(
      stats([
        { date: '2025-06-01', kcal: 1000, meals: 1 },
        { date: '2026-11-05', kcal: 2000, meals: 1 },
      ]),
      'month',
      today,
    )
    expect(withPrevious.previousAverageKcal).toBe(1000)
    expect(withPrevious.changePercent).toBe(100)
    expect(withPrevious.changeLabel).toBe('rispetto ai 12 mesi precedenti')
  })

  it('shows an empty state when the 12 months have no meals', () => {
    const model = buildTrend(stats([]), 'month', today)

    expect(model.bars).toEqual([])
    expect(model.emptyLabel).toBe('Nessun giorno con pasti negli ultimi 12 mesi.')
  })
})
