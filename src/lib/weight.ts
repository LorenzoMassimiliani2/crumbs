/** One dated weight measurement; the API returns entries sorted by ascending date. */
export interface WeightEntry {
  date: string
  weight: number
}

export const MIN_WEIGHT_KG = 30
export const MAX_WEIGHT_KG = 300

export interface WeightSummary {
  current: WeightEntry | null
  /** Difference from the previous measurement, null when there is no previous one. */
  change: number | null
}

/** Summarizes an ascending list: the last entry is the current weight. */
export function weightSummary(entries: WeightEntry[]): WeightSummary {
  const current = entries.at(-1) ?? null
  const previous = entries.at(-2) ?? null
  const change =
    current !== null && previous !== null
      ? Math.round((current.weight - previous.weight) * 10) / 10
      : null
  return { current, change }
}

/** Periods offered by the weight chart selector, in days or the whole history. */
export type WeightChartPeriod = 30 | 90 | 365 | 'all'

export const WEIGHT_CHART_PERIODS: ReadonlyArray<{ value: WeightChartPeriod; label: string }> = [
  { value: 30, label: '30 gg' },
  { value: 90, label: '90 gg' },
  { value: 365, label: '365 gg' },
  { value: 'all', label: 'Tutto' },
]

export interface WeightChartPoint extends WeightEntry {
  /** Horizontal position inside the plot, 0 = left edge, 1 = right edge. */
  x: number
  /** Vertical position inside the plot, 0 = top edge, 1 = bottom edge (SVG convention). */
  y: number
}

export interface WeightChartModel {
  points: WeightChartPoint[]
  /** Padded lower bound of the value axis, in kg. */
  yMin: number
  /** Padded upper bound of the value axis, in kg. */
  yMax: number
}

const DAY_MS = 86_400_000

/** Day index of a `YYYY-MM-DD` string, counted in UTC to ignore timezone shifts. */
function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(year, month - 1, day) / DAY_MS
}

/**
 * Filters the measurements of the selected period and normalizes them for drawing.
 *
 * A numeric period is the window from `today - (period - 1)` to `today`, both included;
 * future measurements stay out of it. `'all'` spans the first to the last measurement.
 * The value axis is padded by 15% of the range (at least 0.5 kg), so it never starts at zero;
 * with a single measurement the point sits in the centre.
 */
export function weightChartModel(
  entries: WeightEntry[],
  period: WeightChartPeriod,
  today: string,
): WeightChartModel {
  const todayDay = dayNumber(today)
  const valid = entries
    .map((entry) => ({ entry, day: dayNumber(entry.date) }))
    .filter(({ day }) => Number.isFinite(day))
  const selected =
    period === 'all'
      ? valid
      : valid.filter(
          ({ day }) => day >= todayDay - (period - 1) && day <= todayDay,
        )
  selected.sort((a, b) => a.day - b.day)

  if (selected.length === 0) return { points: [], yMin: 0, yMax: 0 }

  const firstDay = selected[0]!.day
  const lastDay = selected.at(-1)!.day
  const startDay = period === 'all' ? firstDay : todayDay - (period - 1)
  const endDay = period === 'all' ? lastDay : todayDay
  const span = endDay - startDay

  const weights = selected.map(({ entry }) => entry.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const padding = max > min ? Math.max((max - min) * 0.15, 0.5) : 0.5
  const yMin = min - padding
  const yMax = max + padding

  const points = selected.map(({ entry, day }) => ({
    ...entry,
    x: span === 0 || selected.length === 1 ? 0.5 : (day - startDay) / span,
    y: (yMax - entry.weight) / (yMax - yMin),
  }))

  return { points, yMin, yMax }
}

const weightFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatWeight(weight: number): string {
  return weightFormatter.format(weight)
}

/** Signed change in kg: "+0,5 kg", "-1,2 kg", "0,0 kg". */
export function formatWeightChange(change: number): string {
  const sign = change > 0 ? '+' : ''
  return `${sign}${formatWeight(change)} kg`
}

/** Long Italian date for a `YYYY-MM-DD` value, without timezone shifts. */
export function formatWeightDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

/** Short relative label for a measurement date: oggi, ieri, N giorni fa, else the full date. */
export function formatRelativeWeightDate(date: string, today: string): string {
  const day = dayNumber(date)
  const current = dayNumber(today)
  if (!Number.isFinite(day) || !Number.isFinite(current)) return formatWeightDate(date)
  const diff = current - day
  if (diff === 0) return 'oggi'
  if (diff === 1) return 'ieri'
  if (diff > 1 && diff < 7) return `${diff} giorni fa`
  return formatWeightDate(date)
}
