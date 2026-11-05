import { describe, expect, it } from 'vitest'

import { ageAt, bmi, mifflinStJeorBmr } from './health'

describe('health calculations', () => {
  it('computes the Mifflin-St Jeor BMR on a known case', () => {
    const age = ageAt('1990-04-12', new Date('2026-11-05T12:00:00Z'))

    expect(age).toBe(36)
    expect(mifflinStJeorBmr({ weightKg: 78, heightCm: 178, sex: 'm', ageYears: age! })).toBe(1718)
  })

  it('computes the BMR for women with the female constant', () => {
    expect(mifflinStJeorBmr({ weightKg: 60, heightCm: 165, sex: 'f', ageYears: 30 })).toBe(1320)
  })

  it('computes BMI rounded to one decimal', () => {
    expect(bmi(78, 178)).toBe(24.6)
  })

  it('returns null for an invalid birth date', () => {
    expect(ageAt('1990-02-30', new Date('2026-11-05T12:00:00Z'))).toBeNull()
    expect(ageAt('not-a-date', new Date('2026-11-05T12:00:00Z'))).toBeNull()
  })

  it('counts age before the birthday of the current year', () => {
    expect(ageAt('2000-12-31', new Date('2026-11-05T12:00:00Z'))).toBe(25)
    expect(ageAt('2000-11-05', new Date('2026-11-05T12:00:00Z'))).toBe(26)
  })
})
