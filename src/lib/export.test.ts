import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import type { DiaryExport } from './export'
import {
  ATTIVITA_HEADERS,
  buildExportFile,
  buildExportSheets,
  buildExportWorkbook,
  currentMonthRange,
  exportFileName,
  GIORNI_HEADERS,
  PASTI_HEADERS,
} from './export'

const DATA: DiaryExport = {
  from: '2026-11-01',
  to: '2026-11-30',
  targetKcal: 2200,
  items: [
    {
      date: '2026-11-05',
      type: 'pranzo',
      name: 'Pane',
      grams: 150,
      kcal: 534,
      protein: 18,
      carbs: 105,
      fat: 2.25,
      fiber: 4.5,
      sugar: 3,
      salt: 1.5,
      source: 'off',
    },
    {
      date: '2026-11-05',
      type: 'cena',
      name: 'Mela',
      grams: 200,
      kcal: 104,
      protein: 0.6,
      carbs: 28,
      fat: 0.4,
      fiber: 4.8,
      sugar: 20,
      salt: 0,
      source: 'manual',
    },
  ],
  days: [
    {
      date: '2026-11-05',
      kcal: 638,
      targetKcal: 2200,
      delta: 1562,
      protein: 18.6,
      carbs: 133,
      fat: 2.65,
    },
  ],
  activities: [
    {
      date: '2026-11-05',
      name: 'Corsa',
      startedAt: new Date(2026, 10, 5, 7, 5).toISOString(),
      endedAt: new Date(2026, 10, 5, 7, 35).toISOString(),
      durationMinutes: 30,
      note: null,
    },
    {
      date: '2026-11-05',
      name: 'Camminata',
      startedAt: new Date(2026, 10, 5, 18, 0).toISOString(),
      endedAt: new Date(2026, 10, 5, 19, 15).toISOString(),
      durationMinutes: 75,
      note: 'Con il cane',
    },
  ],
}

const EMPTY: DiaryExport = {
  from: '2025-01-01',
  to: '2025-01-31',
  targetKcal: 2200,
  items: [],
  days: [],
  activities: [],
}

describe('buildExportSheets', () => {
  it('maps the items to one row per item with the agreed columns', () => {
    const sheets = buildExportSheets(DATA)

    expect(sheets.pasti).toEqual([
      PASTI_HEADERS,
      ['2026-11-05', 'Pranzo', 'Pane', 150, 534, 18, 105, 2.25, 4.5, 3, 1.5, 'Open Food Facts'],
      ['2026-11-05', 'Cena', 'Mela', 200, 104, 0.6, 28, 0.4, 4.8, 20, 0, 'Manuale'],
    ])
  })

  it('maps the days to one row per day with target and delta', () => {
    const sheets = buildExportSheets(DATA)

    expect(sheets.giorni).toEqual([
      GIORNI_HEADERS,
      ['2026-11-05', 638, 2200, 1562, 18.6, 133, 2.65],
    ])
  })

  it('leaves a missing target empty instead of inventing a delta', () => {
    const sheets = buildExportSheets({
      ...DATA,
      targetKcal: null,
      days: [{ ...DATA.days[0]!, targetKcal: null, delta: null }],
    })

    expect(sheets.giorni[1]).toEqual(['2026-11-05', 638, null, null, 18.6, 133, 2.65])
  })

  it('leaves an unknown nutrient empty instead of writing zero', () => {
    const sheets = buildExportSheets({
      ...DATA,
      items: [
        {
          ...DATA.items[0]!,
          protein: null,
          fiber: null,
          sugar: null,
          salt: null,
        },
      ],
    })

    expect(sheets.pasti[1]).toEqual([
      '2026-11-05',
      'Pranzo',
      'Pane',
      150,
      534,
      null,
      105,
      2.25,
      null,
      null,
      null,
      'Open Food Facts',
    ])
  })

  it('maps the activities to one row per activity with local times', () => {
    const sheets = buildExportSheets(DATA)

    expect(sheets.attivita).toEqual([
      ATTIVITA_HEADERS,
      ['2026-11-05', 'Corsa', '07:05', '07:35', 30, null],
      ['2026-11-05', 'Camminata', '18:00', '19:15', 75, 'Con il cane'],
    ])
  })

  it('keeps only the headers for an empty range', () => {
    const sheets = buildExportSheets(EMPTY)

    expect(sheets.pasti).toEqual([PASTI_HEADERS])
    expect(sheets.giorni).toEqual([GIORNI_HEADERS])
    expect(sheets.attivita).toEqual([ATTIVITA_HEADERS])
  })
})

describe('buildExportWorkbook', () => {
  it('creates the three named sheets with the expected headers', async () => {
    const workbook = await buildExportWorkbook(DATA)

    expect(workbook.SheetNames).toEqual(['pasti', 'giorni', 'Attività'])

    const pasti = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.pasti!, { header: 1 })
    expect(pasti[0]).toEqual(PASTI_HEADERS)
    expect(pasti).toHaveLength(3)

    const giorni = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.giorni!, { header: 1 })
    expect(giorni[0]).toEqual(GIORNI_HEADERS)
    expect(giorni).toHaveLength(2)

    const attivita = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['Attività']!, {
      header: 1,
    })
    expect(attivita[0]).toEqual(ATTIVITA_HEADERS)
    expect(attivita).toHaveLength(3)
  })

  it('round-trips through an xlsx file reader', async () => {
    const bytes = await buildExportFile(DATA)
    expect(bytes.byteLength).toBeGreaterThan(0)

    const workbook = XLSX.read(bytes, { type: 'array' })
    expect(workbook.SheetNames).toEqual(['pasti', 'giorni', 'Attività'])

    const row = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.pasti!)
    expect(row).toEqual([
      {
        Data: '2026-11-05',
        'Tipo pasto': 'Pranzo',
        Alimento: 'Pane',
        Grammi: 150,
        kcal: 534,
        'Proteine (g)': 18,
        'Carboidrati (g)': 105,
        'Grassi (g)': 2.25,
        'Fibre (g)': 4.5,
        'Zuccheri (g)': 3,
        'Sale (g)': 1.5,
        Fonte: 'Open Food Facts',
      },
      {
        Data: '2026-11-05',
        'Tipo pasto': 'Cena',
        Alimento: 'Mela',
        Grammi: 200,
        kcal: 104,
        'Proteine (g)': 0.6,
        'Carboidrati (g)': 28,
        'Grassi (g)': 0.4,
        'Fibre (g)': 4.8,
        'Zuccheri (g)': 20,
        'Sale (g)': 0,
        Fonte: 'Manuale',
      },
    ])
  })

  it('produces a readable file with only the headers for an empty range', async () => {
    const workbook = XLSX.read(await buildExportFile(EMPTY), { type: 'array' })

    expect(workbook.SheetNames).toEqual(['pasti', 'giorni', 'Attività'])
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.pasti!, { header: 1 })).toEqual([PASTI_HEADERS])
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.giorni!, { header: 1 })).toEqual([
      GIORNI_HEADERS,
    ])
    expect(XLSX.utils.sheet_to_json(workbook.Sheets['Attività']!, { header: 1 })).toEqual([
      ATTIVITA_HEADERS,
    ])
  })
})

describe('range helpers', () => {
  it('names the file after the range', () => {
    expect(exportFileName('2026-11-01', '2026-11-30')).toBe('crumbs-2026-11-01_2026-11-30.xlsx')
  })

  it('defaults to the whole current month', () => {
    expect(currentMonthRange(new Date(2026, 10, 5, 12, 0, 0))).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(currentMonthRange(new Date(2026, 1, 1, 0, 0, 0))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })
})
