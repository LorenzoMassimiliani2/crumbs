export type Sex = 'm' | 'f'

export interface BmrInput {
  weightKg: number
  heightCm: number
  sex: Sex
  ageYears: number
}

export function ageAt(birthDate: string, at: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const birth = new Date(Date.UTC(year, month - 1, day))
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day
  ) {
    return null
  }

  let age = at.getUTCFullYear() - year
  const monthBefore = at.getUTCMonth() < month - 1
  const sameMonthBeforeDay = at.getUTCMonth() === month - 1 && at.getUTCDate() < day
  if (monthBefore || sameMonthBeforeDay) age -= 1

  return age >= 0 ? age : null
}

export function mifflinStJeorBmr({ weightKg, heightCm, sex, ageYears }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return Math.round(base + (sex === 'm' ? 5 : -161))
}

export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}
