import { describe, expect, it } from 'vitest'

import { activityDurationMinutes, formatDuration } from './activity'

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

describe('formatDuration', () => {
  it('renders compact Italian durations', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(150)).toBe('2 h 30 min')
  })

  it('renders a dash for invalid values', () => {
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
  })
})
