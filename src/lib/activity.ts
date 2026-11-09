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

/** Durations above this many minutes need an explicit confirmation in the UI. */
export const LONG_ACTIVITY_MINUTES = 12 * 60

/** Durations above this many minutes are rejected by the server. */
export const MAX_ACTIVITY_MINUTES = 24 * 60

interface WallTime {
  hours: number
  minutes: number
}

/** Parses a 24-hour `HH:MM` value; anything else, including out-of-range parts, is invalid. */
function parseWallTime(value: string): WallTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

function isEarlier(a: WallTime, b: WallTime): boolean {
  return a.hours < b.hours || (a.hours === b.hours && a.minutes < b.minutes)
}

/**
 * Turns the wall times of an activity into ISO instants on `localDate`.
 * When the end is earlier than the start it falls on the following day, so a
 * night activity keeps a positive duration.
 */
export function activityInstants(
  localDate: string,
  startTime: string,
  endTime: string,
): { startedAt: string; endedAt: string } | null {
  const start = parseWallTime(startTime)
  const end = parseWallTime(endTime)
  if (!start || !end) return null

  const [year, month, day] = localDate.split('-').map(Number) as [number, number, number]
  if (!year || !month || !day) return null

  const endOffset = isEarlier(end, start) ? 1 : 0
  return {
    startedAt: new Date(year, month - 1, day, start.hours, start.minutes).toISOString(),
    endedAt: new Date(year, month - 1, day + endOffset, end.hours, end.minutes).toISOString(),
  }
}

/** Compact Italian duration: "45 min", "2 h", "1 h 30 min". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
