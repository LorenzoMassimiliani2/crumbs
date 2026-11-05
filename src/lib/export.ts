import * as XLSX from 'xlsx'

import { toLocalDateString, type FoodSource } from './diary'
import { MEAL_TYPE_LABELS, type MealType } from './meal-types'

export interface ExportItem {
  date: string
  type: MealType
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  salt: number
  source: FoodSource
}

export interface ExportDay {
  date: string
  kcal: number
  targetKcal: number | null
  delta: number | null
  protein: number
  carbs: number
  fat: number
}

export interface DiaryExport {
  from: string
  to: string
  targetKcal: number | null
  items: ExportItem[]
  days: ExportDay[]
}

type Cell = string | number | null

export const SOURCE_LABELS: Record<FoodSource, string> = {
  off: 'Open Food Facts',
  usda: 'USDA FoodData Central',
  manual: 'Manuale',
}

export const PASTI_HEADERS = [
  'Data',
  'Tipo pasto',
  'Alimento',
  'Grammi',
  'kcal',
  'Proteine (g)',
  'Carboidrati (g)',
  'Grassi (g)',
  'Fibre (g)',
  'Zuccheri (g)',
  'Sale (g)',
  'Fonte',
]

export const GIORNI_HEADERS = [
  'Data',
  'kcal totali',
  'Target kcal',
  'Scostamento kcal',
  'Proteine (g)',
  'Carboidrati (g)',
  'Grassi (g)',
]

export function buildExportSheets(data: DiaryExport): { pasti: Cell[][]; giorni: Cell[][] } {
  const pasti: Cell[][] = [
    PASTI_HEADERS,
    ...data.items.map((item) => [
      item.date,
      MEAL_TYPE_LABELS[item.type],
      item.name,
      item.grams,
      item.kcal,
      item.protein,
      item.carbs,
      item.fat,
      item.fiber,
      item.sugar,
      item.salt,
      SOURCE_LABELS[item.source],
    ]),
  ]

  const giorni: Cell[][] = [
    GIORNI_HEADERS,
    ...data.days.map((day) => [
      day.date,
      day.kcal,
      day.targetKcal,
      day.delta,
      day.protein,
      day.carbs,
      day.fat,
    ]),
  ]

  return { pasti, giorni }
}

export function buildExportWorkbook(data: DiaryExport): XLSX.WorkBook {
  const sheets = buildExportSheets(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.pasti), 'pasti')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.giorni), 'giorni')
  return workbook
}

export function buildExportFile(data: DiaryExport): ArrayBuffer {
  return XLSX.write(buildExportWorkbook(data), { bookType: 'xlsx', type: 'array' })
}

export function exportFileName(from: string, to: string): string {
  return `crumbs-${from}_${to}.xlsx`
}

export function currentMonthRange(now: Date = new Date()): { from: string; to: string } {
  const year = now.getFullYear()
  const month = now.getMonth()
  return {
    from: toLocalDateString(new Date(year, month, 1)),
    to: toLocalDateString(new Date(year, month + 1, 0)),
  }
}

export function downloadExport(data: DiaryExport): void {
  const bytes = buildExportFile(data)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = exportFileName(data.from, data.to)
  anchor.click()
  URL.revokeObjectURL(url)
}
