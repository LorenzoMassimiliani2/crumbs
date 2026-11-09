/** Aggregated calories of one day with at least one non-deleted meal. */
export interface StatsDay {
  date: string
  kcal: number
  meals: number
}

export interface Stats {
  targetKcal: number | null
  days: StatsDay[]
}

/** Days shown by the day view; the comparison uses the same span right before it. */
export const TREND_DAYS = 14

const DAY_MS = 86_400_000

/** Day index of a `YYYY-MM-DD` string, counted in UTC to ignore timezone shifts. */
export function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(year, month - 1, day) / DAY_MS
}

/** Calendar arithmetic on a `YYYY-MM-DD` string, keeping the UTC day. */
export function addDays(date: string, offset: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
}

/**
 * The single interval that covers the current 14 days and the previous 14,
 * so the day view and its variation arrive with one request.
 */
export function trendRange(today: string): { from: string; to: string } {
  return { from: addDays(today, -(TREND_DAYS * 2 - 1)), to: today }
}

export interface TrendBar extends StatsDay {
  /** Position of the day inside the 14-day window, 0 = first day. */
  slot: number
  /** Left edge inside the plot, 0 = left, 1 = right. */
  x: number
  /** Bar width as a share of the plot width. */
  width: number
  /** Bar height as a share of the plot height. */
  height: number
}

export interface TrendModel {
  /** The 14 dates of the window, ascending and ending today. */
  days: string[]
  /** One bar per day with meals; empty days and future days produce none. */
  bars: TrendBar[]
  /** Slots that deserve an X label, spaced enough not to overlap. */
  labelIndices: number[]
  /** Upper bound of the value axis, rounded to a readable step. */
  yMax: number
  targetKcal: number | null
  /** Target line position as a share of the plot height from the bottom. */
  targetY: number | null
  /** Average kcal over the days with meals, null when the window has none. */
  averageKcal: number | null
  /** Average kcal of the previous 14 days, null when it has no days with meals. */
  previousAverageKcal: number | null
  recordedDays: number
  totalDays: number
  /** Percentage change against the previous period, null without both periods. */
  changePercent: number | null
}

const BAR_SHARE = 0.6
const MAX_LABELS = 5
const Y_STEP = 100

/**
 * Buckets the aggregated days into the day view: the 14 days ending today, one bar
 * per day with meals, the target line and the summary against the previous 14 days.
 */
export function buildDayTrend(stats: Stats, today: string): TrendModel {
  const days = Array.from({ length: TREND_DAYS }, (_, index) =>
    addDays(today, index - (TREND_DAYS - 1)),
  )
  const previousDays = Array.from({ length: TREND_DAYS }, (_, index) =>
    addDays(today, index - (TREND_DAYS * 2 - 1)),
  )
  const byDate = new Map(stats.days.map((day) => [day.date, day]))

  const currentDays = days.flatMap((date, slot) => {
    const day = byDate.get(date)
    return day ? [{ ...day, slot }] : []
  })
  const previous = previousDays.flatMap((date) => {
    const day = byDate.get(date)
    return day ? [day] : []
  })

  const peak = Math.max(
    stats.targetKcal ?? 0,
    ...currentDays.map((day) => day.kcal),
    1,
  )
  const yMax = Math.ceil((peak * 11) / (10 * Y_STEP)) * Y_STEP

  const bars: TrendBar[] = currentDays.map((day) => ({
    ...day,
    x: day.slot / TREND_DAYS,
    width: BAR_SHARE / TREND_DAYS,
    height: day.kcal / yMax,
  }))

  const averageKcal =
    currentDays.length === 0
      ? null
      : Math.round(currentDays.reduce((sum, day) => sum + day.kcal, 0) / currentDays.length)
  const previousAverageKcal =
    previous.length === 0
      ? null
      : Math.round(previous.reduce((sum, day) => sum + day.kcal, 0) / previous.length)

  const changePercent =
    averageKcal !== null && previousAverageKcal !== null && previousAverageKcal > 0
      ? Math.round(((averageKcal - previousAverageKcal) / previousAverageKcal) * 100)
      : null

  const targetKcal = stats.targetKcal
  return {
    days,
    bars,
    labelIndices: axisLabelIndices(TREND_DAYS),
    yMax,
    targetKcal,
    targetY: targetKcal === null ? null : Math.min(1, targetKcal / yMax),
    averageKcal,
    previousAverageKcal,
    recordedDays: currentDays.length,
    totalDays: TREND_DAYS,
    changePercent,
  }
}

/**
 * Picks at most `maxLabels` slots, spreading them from the last one backwards so the
 * gaps are never smaller than one step: the X labels cannot overlap.
 */
export function axisLabelIndices(slots: number, maxLabels = MAX_LABELS): number[] {
  if (slots <= 0) return []
  if (slots <= maxLabels) return Array.from({ length: slots }, (_, index) => index)

  const step = Math.ceil((slots - 1) / (maxLabels - 1))
  const indices: number[] = []
  for (let index = slots - 1; index >= 0; index -= step) indices.unshift(index)
  return indices
}

const longFormatter = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function toDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
}

/** Short axis label for a `YYYY-MM-DD` value, without timezone shifts. */
export function formatTrendDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  if (!year || !month || !day) return date
  return `${day}/${month}`
}

/** Long label used by the accessible tooltip of a bar. */
export function formatTrendDate(date: string): string {
  return longFormatter.format(toDate(date))
}
