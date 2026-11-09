import { formatKcal } from './diary'

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

export type TrendView = 'day' | 'week' | 'month'

/** Days shown by the day view; the comparison uses the same span right before it. */
export const TREND_DAYS = 14
/** Calendar weeks shown by the week view, the current one included. */
export const TREND_WEEKS = 8
/** Calendar months shown by the month view, the current one included. */
export const TREND_MONTHS = 12

const DAY_MS = 86_400_000
const BAR_SHARE = 0.6
const MAX_LABELS = 5
const Y_STEP = 100

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

/** Monday of the week that contains `date`. */
export function startOfWeek(date: string): string {
  const weekday = new Date(dayNumber(date) * DAY_MS).getUTCDay()
  const offset = (weekday + 6) % 7
  return addDays(date, -offset)
}

/** First day of the month that contains `date`. */
export function startOfMonth(date: string): string {
  const [year, month] = date.split('-').map(Number) as [number, number]
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
}

/** Calendar arithmetic on months, always returning the first day of the month. */
export function addMonths(date: string, offset: number): string {
  const [year, month] = date.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10)
}

/** The interval that covers the current day view and the 14 days before it. */
export function trendRange(today: string): { from: string; to: string } {
  return trendRangeFor('day', today)
}

/**
 * The single interval that covers the current period of a view and the period
 * right before it, so the chart and its variation arrive with one request.
 */
export function trendRangeFor(view: TrendView, today: string): { from: string; to: string } {
  if (view === 'week') {
    const current = startOfWeek(today)
    return { from: addDays(current, -7 * (TREND_WEEKS * 2 - 1)), to: today }
  }
  if (view === 'month') {
    const current = startOfMonth(today)
    return { from: addMonths(current, -(TREND_MONTHS * 2 - 1)), to: today }
  }
  return { from: addDays(today, -(TREND_DAYS * 2 - 1)), to: today }
}

export interface TrendBar {
  /** Stable bucket key: the day date, the week start or the month start. */
  key: string
  /** Day date of the bar or first day of its period. */
  date: string
  /** Full period label used by the accessible tooltip. */
  label: string
  /** Value drawn by the bar: day kcal or average daily kcal of the period. */
  kcal: number
  /** Meals recorded in the bucket. */
  meals: number
  /** Days with meals inside the bucket. */
  recordedDays: number
  /** Position of the bucket inside the view window, 0 = first slot. */
  slot: number
  /** Left edge inside the plot, 0 = left, 1 = right. */
  x: number
  /** Bar width as a share of the plot width. */
  width: number
  /** Bar height as a share of the plot height. */
  height: number
}

export interface TrendModel {
  view: TrendView
  /** Window slots: day dates, week starts or month starts, ascending. */
  days: string[]
  /** X axis label of every slot. */
  slotLabels: string[]
  /** One bar per bucket with meals; empty periods produce none. */
  bars: TrendBar[]
  /** Slots that deserve an X label, spaced enough not to overlap. */
  labelIndices: number[]
  /** Upper bound of the value axis, rounded to a readable step. */
  yMax: number
  targetKcal: number | null
  /** Target line position as a share of the plot height from the bottom. */
  targetY: number | null
  /** Average kcal over the days with meals, null when the period has none. */
  averageKcal: number | null
  /** Average kcal of the previous period, null when it has no days with meals. */
  previousAverageKcal: number | null
  /** Days with meals in the current period. */
  recordedDays: number
  /** Days elapsed in the current period, today included. */
  totalDays: number
  /** Percentage change against the previous period, null without both periods. */
  changePercent: number | null
  /** Text of the comparison, null when the change is not shown. */
  changeLabel: string | null
  /** Message of the empty state. */
  emptyLabel: string
  /** Accessible description of the whole chart. */
  chartLabel: string
}

interface Bucket {
  key: string
  date: string
  slot: number
  label: string
  kcal: number
  meals: number
  recordedDays: number
}

interface BucketTotals {
  kcal: number
  meals: number
  recordedDays: number
}

const CHANGE_LABELS: Record<TrendView, string> = {
  day: 'rispetto ai 14 giorni precedenti',
  week: 'rispetto alle 8 settimane precedenti',
  month: 'rispetto ai 12 mesi precedenti',
}

const EMPTY_LABELS: Record<TrendView, string> = {
  day: 'Nessun giorno con pasti negli ultimi 14 giorni.',
  week: 'Nessun giorno con pasti nelle ultime 8 settimane.',
  month: 'Nessun giorno con pasti negli ultimi 12 mesi.',
}

/** Builds the model of the view requested by the selector. */
export function buildTrend(stats: Stats, view: TrendView, today: string): TrendModel {
  if (view === 'week') return buildWeekTrend(stats, today)
  if (view === 'month') return buildMonthTrend(stats, today)
  return buildDayTrend(stats, today)
}

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

  const buckets = days.flatMap((date, slot): Bucket[] => {
    const day = byDate.get(date)
    if (!day) return []
    const meals = day.meals === 1 ? '1 pasto' : `${day.meals} pasti`
    return [
      {
        key: day.date,
        date: day.date,
        slot,
        label: `${formatTrendDate(day.date)}: ${formatKcal(day.kcal)} kcal, ${meals}`,
        kcal: day.kcal,
        meals: day.meals,
        recordedDays: 1,
      },
    ]
  })

  return assembleTrend(
    'day',
    days,
    days.map(formatTrendDay),
    buckets,
    stats.targetKcal,
    summarize(previousDays, byDate),
    TREND_DAYS,
  )
}

/** Buckets the aggregated days into the 8 calendar weeks ending with the current one. */
function buildWeekTrend(stats: Stats, today: string): TrendModel {
  const currentStart = startOfWeek(today)
  const starts = Array.from({ length: TREND_WEEKS }, (_, index) =>
    addDays(currentStart, -7 * (TREND_WEEKS - 1 - index)),
  )
  const previousStarts = Array.from({ length: TREND_WEEKS }, (_, index) =>
    addDays(currentStart, -7 * (TREND_WEEKS + index)),
  )
  const byDate = new Map(stats.days.map((day) => [day.date, day]))

  const buckets = starts.flatMap((start, slot): Bucket[] => {
    const summary = summarize(weekDays(start, today), byDate)
    if (summary.recordedDays === 0) return []
    const kcal = Math.round(summary.kcal / summary.recordedDays)
    const daysLabel =
      summary.recordedDays === 1 ? '1 giorno registrato' : `${summary.recordedDays} giorni registrati`
    return [
      {
        key: start,
        date: start,
        slot,
        label: `Settimana ${formatWeekRange(start)}: ${formatKcal(kcal)} kcal di media, ${daysLabel}`,
        kcal,
        meals: summary.meals,
        recordedDays: summary.recordedDays,
      },
    ]
  })

  const previousDays = previousStarts.flatMap((start) => weekDays(start, today))

  return assembleTrend(
    'week',
    starts,
    starts.map(formatTrendDay),
    buckets,
    stats.targetKcal,
    summarize(previousDays, byDate),
    dayNumber(today) - dayNumber(starts[0]!) + 1,
  )
}

/** Buckets the aggregated days into the 12 calendar months ending with the current one. */
function buildMonthTrend(stats: Stats, today: string): TrendModel {
  const currentStart = startOfMonth(today)
  const starts = Array.from({ length: TREND_MONTHS }, (_, index) =>
    addMonths(currentStart, index - (TREND_MONTHS - 1)),
  )
  const previousStarts = Array.from({ length: TREND_MONTHS }, (_, index) =>
    addMonths(currentStart, index - (TREND_MONTHS * 2 - 1)),
  )
  const byDate = new Map(stats.days.map((day) => [day.date, day]))

  const buckets = starts.flatMap((start, slot): Bucket[] => {
    const summary = summarize(monthDays(start, today), byDate)
    if (summary.recordedDays === 0) return []
    const kcal = Math.round(summary.kcal / summary.recordedDays)
    const daysLabel =
      summary.recordedDays === 1 ? '1 giorno registrato' : `${summary.recordedDays} giorni registrati`
    return [
      {
        key: start.slice(0, 7),
        date: start,
        slot,
        label: `${formatMonthLabel(start)}: ${formatKcal(kcal)} kcal di media, ${daysLabel}`,
        kcal,
        meals: summary.meals,
        recordedDays: summary.recordedDays,
      },
    ]
  })

  const previousDays = previousStarts.flatMap((start) => monthDays(start, today))

  return assembleTrend(
    'month',
    starts,
    starts.map(formatMonthShort),
    buckets,
    stats.targetKcal,
    summarize(previousDays, byDate),
    dayNumber(today) - dayNumber(starts[0]!) + 1,
  )
}

/** Days of the week starting at `start`, stopping at today. */
function weekDays(start: string, today: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index)).filter(
    (date) => date <= today,
  )
}

/** Days of the month starting at `start`, stopping at today. */
function monthDays(start: string, today: string): string[] {
  const next = addMonths(start, 1)
  const days: string[] = []
  for (let date = start; date < next && date <= today; date = addDays(date, 1)) {
    days.push(date)
  }
  return days
}

function summarize(days: string[], byDate: Map<string, StatsDay>): BucketTotals {
  let kcal = 0
  let meals = 0
  let recordedDays = 0
  for (const date of days) {
    const day = byDate.get(date)
    if (!day) continue
    kcal += day.kcal
    meals += day.meals
    recordedDays += 1
  }
  return { kcal, meals, recordedDays }
}

function assembleTrend(
  view: TrendView,
  days: string[],
  slotLabels: string[],
  buckets: Bucket[],
  targetKcal: number | null,
  previous: BucketTotals,
  totalDays: number,
): TrendModel {
  const recordedDays = buckets.reduce((sum, bucket) => sum + bucket.recordedDays, 0)
  const currentKcal = buckets.reduce((sum, bucket) => sum + bucket.kcal * bucket.recordedDays, 0)
  const averageKcal = recordedDays === 0 ? null : Math.round(currentKcal / recordedDays)
  const previousAverageKcal =
    previous.recordedDays === 0 ? null : Math.round(previous.kcal / previous.recordedDays)

  const changePercent =
    averageKcal !== null && previousAverageKcal !== null && previousAverageKcal > 0
      ? Math.round(((averageKcal - previousAverageKcal) / previousAverageKcal) * 100)
      : null

  const peak = Math.max(targetKcal ?? 0, ...buckets.map((bucket) => bucket.kcal), 1)
  const yMax = Math.ceil((peak * 11) / (10 * Y_STEP)) * Y_STEP

  const slots = days.length
  const bars: TrendBar[] = buckets.map((bucket) => ({
    key: bucket.key,
    date: bucket.date,
    label: bucket.label,
    kcal: bucket.kcal,
    meals: bucket.meals,
    recordedDays: bucket.recordedDays,
    slot: bucket.slot,
    x: bucket.slot / slots,
    width: BAR_SHARE / slots,
    height: bucket.kcal / yMax,
  }))

  return {
    view,
    days,
    slotLabels,
    bars,
    labelIndices: axisLabelIndices(slots),
    yMax,
    targetKcal,
    targetY: targetKcal === null ? null : Math.min(1, targetKcal / yMax),
    averageKcal,
    previousAverageKcal,
    recordedDays,
    totalDays,
    changePercent,
    changeLabel: changePercent === null ? null : CHANGE_LABELS[view],
    emptyLabel: EMPTY_LABELS[view],
    chartLabel: chartLabel(view, bars.length),
  }
}

function chartLabel(view: TrendView, count: number): string {
  if (view === 'week') {
    return `Andamento della media giornaliera delle ultime 8 settimane, ${count} ${
      count === 1 ? 'settimana con pasti' : 'settimane con pasti'
    }`
  }
  if (view === 'month') {
    return `Andamento della media giornaliera degli ultimi 12 mesi, ${count} ${
      count === 1 ? 'mese con pasti' : 'mesi con pasti'
    }`
  }
  return `Andamento delle kcal degli ultimi 14 giorni, ${count} ${
    count === 1 ? 'giorno con pasti' : 'giorni con pasti'
  }`
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
const monthFormatter = new Intl.DateTimeFormat('it-IT', { month: 'long' })
const monthYearFormatter = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
const shortMonthFormatter = new Intl.DateTimeFormat('it-IT', { month: 'short' })

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

/** Readable range of the week starting at `start`, for the tooltip. */
export function formatWeekRange(start: string): string {
  const end = addDays(start, 6)
  const [startYear, startMonth, startDay] = start.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const [endYear, endMonth, endDay] = end.split('-').map(Number) as [number, number, number]
  const startMonthLabel = monthFormatter.format(toDate(start))
  const endMonthLabel = monthFormatter.format(toDate(end))

  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay}–${endDay} ${startMonthLabel} ${startYear}`
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonthLabel} – ${endDay} ${endMonthLabel} ${startYear}`
  }
  return `${startDay} ${startMonthLabel} ${startYear} – ${endDay} ${endMonthLabel} ${endYear}`
}

/** Long month label used by the tooltip, with a capital letter. */
export function formatMonthLabel(start: string): string {
  const label = monthYearFormatter.format(toDate(start))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Short month label of the X axis. */
export function formatMonthShort(start: string): string {
  return shortMonthFormatter.format(toDate(start)).replace('.', '')
}
