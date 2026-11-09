/** A catalog activity owned by one user. `lastUsedAt` is null until it is used. */
export interface Activity {
  id: string
  name: string
  lastUsedAt: string | null
}

/** One diary entry; `name` is the catalog name snapshot taken when it was saved. */
export interface DayActivity {
  id: string
  activityId: string | null
  name: string
  startedAt: string
  endedAt: string
  durationMinutes: number
  note: string | null
}

/** Whole minutes between two instants; negative when the end is before the start. */
export function activityDurationMinutes(startedAt: string, endedAt: string): number {
  return Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60000)
}

/** Compact Italian duration: "45 min", "2 h", "1 h 30 min". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
