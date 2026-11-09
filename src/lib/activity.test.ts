import { describe, expect, it } from 'vitest'

import { activityDurationMinutes, activityInstants, formatDuration } from './activity'

function localInstant(day: number, hours: number, minutes: number): string {
  return new Date(2026, 10, day, hours, minutes).toISOString()
}

describe('activityDurationMinutes', () => {
  it('measures whole minutes between two instants', () => {
    expect(
      activityDurationMinutes('2026-11-05T12:00:00.000Z', '2026-11-05T13:30:00.000Z'),
    ).toBe(90)
    expect(
      activityDurationMinutes('2026-11-05T18:00:00.000Z', '2026-11-05T18:45:00.000Z'),
    ).toBe(45)
  })

  it('is negative when the end precedes the start', () => {
    expect(
      activityDurationMinutes('2026-11-05T13:00:00.000Z', '2026-11-05T12:00:00.000Z'),
    ).toBe(-60)
  })
})

describe('activityInstants', () => {
  it('keeps an end after the start on the same day', () => {
    const instants = activityInstants('2026-11-05', '12:00', '13:30')!
    expect(instants).toEqual({
      startedAt: localInstant(5, 12, 0),
      endedAt: localInstant(5, 13, 30),
    })
    expect(activityDurationMinutes(instants.startedAt, instants.endedAt)).toBe(90)
  })

  it('rolls an end before the start to the following day', () => {
    const instants = activityInstants('2026-11-05', '23:00', '01:00')!
    expect(instants.endedAt).toBe(localInstant(6, 1, 0))
    expect(activityDurationMinutes(instants.startedAt, instants.endedAt)).toBe(120)

    const longNight = activityInstants('2026-11-05', '18:00', '08:00')!
    expect(activityDurationMinutes(longNight.startedAt, longNight.endedAt)).toBe(840)
  })

  it('keeps equal times on the same day with zero length', () => {
    const instants = activityInstants('2026-11-05', '12:00', '12:00')!
    expect(instants.endedAt).toBe(instants.startedAt)
  })

  it('returns null for invalid wall times', () => {
    expect(activityInstants('2026-11-05', '24:00', '01:00')).toBeNull()
    expect(activityInstants('2026-11-05', '12:00', 'mezzogiorno')).toBeNull()
  })
})

describe('formatDuration', () => {
  it('renders compact Italian durations', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(150)).toBe('2 h 30 min')
    expect(formatDuration(840)).toBe('14 h')
    expect(formatDuration(1439)).toBe('23 h 59 min')
  })

  it('renders a dash for invalid values', () => {
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
  })
})
