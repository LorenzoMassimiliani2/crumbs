export type Sex = 'm' | 'f'

export interface ProfileValues {
  weight: number
  height: number
  sex: Sex
  birthDate: string
  targetKcal: number
}

export type ParsedProfile =
  | { ok: true; value: ProfileValues }
  | { ok: false; error: string }

export const EMPTY_PROFILE = {
  weight: null,
  height: null,
  sex: null,
  birthDate: null,
  targetKcal: null,
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isPastDate(value: unknown, now: Date): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  if (!isRealDate) return false

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return date.getTime() < today.getTime()
}

export function parseProfile(body: unknown, now = new Date()): ParsedProfile {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Dati del profilo non validi.' }
  }

  const input = body as Record<string, unknown>

  const weight = toNumber(input.weight)
  if (weight === null || weight < 30 || weight > 300) {
    return { ok: false, error: 'Il peso deve essere compreso tra 30 e 300 kg.' }
  }

  const height = toNumber(input.height)
  if (height === null || height < 100 || height > 250) {
    return { ok: false, error: "L'altezza deve essere compresa tra 100 e 250 cm." }
  }

  const sex = input.sex
  if (sex !== 'm' && sex !== 'f') {
    return { ok: false, error: "Il sesso deve essere 'm' oppure 'f'." }
  }

  if (!isPastDate(input.birthDate, now)) {
    return { ok: false, error: 'La data di nascita deve essere una data valida nel passato.' }
  }

  const targetKcal = toNumber(input.targetKcal)
  if (targetKcal === null || !Number.isInteger(targetKcal) || targetKcal < 800 || targetKcal > 6000) {
    return { ok: false, error: 'Il target deve essere compreso tra 800 e 6000 kcal.' }
  }

  return {
    ok: true,
    value: {
      weight,
      height,
      sex,
      birthDate: input.birthDate as string,
      targetKcal,
    },
  }
}

export function profileFromRow(row: Record<string, unknown> | null): ProfileValues | typeof EMPTY_PROFILE {
  if (!row) return EMPTY_PROFILE
  return {
    weight: row.weight as number,
    height: row.height as number,
    sex: row.sex as Sex,
    birthDate: row.birthDate as string,
    targetKcal: row.targetKcal as number,
  }
}
