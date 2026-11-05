import { describe, expect, it } from 'vitest'

import { isMealType, MEAL_TYPES, suggestMealType } from './meal-types'

function at(hours: number, minutes = 0): Date {
  return new Date(2026, 10, 5, hours, minutes, 0)
}

describe('meal type windows', () => {
  it('exposes the six meal types', () => {
    expect(MEAL_TYPES).toEqual([
      'colazione',
      'merenda_mattina',
      'pranzo',
      'merenda_pomeriggio',
      'cena',
      'post_cena',
    ])
    expect(isMealType('pranzo')).toBe(true)
    expect(isMealType('spuntino')).toBe(false)
  })

  it.each([
    [5, 0, 'colazione'],
    [10, 29, 'colazione'],
    [10, 30, 'merenda_mattina'],
    [11, 59, 'merenda_mattina'],
    [12, 0, 'pranzo'],
    [14, 59, 'pranzo'],
    [15, 0, 'merenda_pomeriggio'],
    [17, 59, 'merenda_pomeriggio'],
    [18, 0, 'cena'],
    [21, 59, 'cena'],
    [22, 0, 'post_cena'],
    [4, 59, 'post_cena'],
  ] as const)('suggests %i:%i as %s', (hours, minutes, expected) => {
    expect(suggestMealType(at(hours, minutes))).toBe(expected)
  })
})
