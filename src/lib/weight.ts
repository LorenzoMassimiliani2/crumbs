/** One dated weight measurement; the API returns entries sorted by ascending date. */
export interface WeightEntry {
  date: string
  weight: number
}

export const MIN_WEIGHT_KG = 30
export const MAX_WEIGHT_KG = 300

export interface WeightSummary {
  current: WeightEntry | null
  previous: WeightEntry | null
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
  return { current, previous, change }
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
