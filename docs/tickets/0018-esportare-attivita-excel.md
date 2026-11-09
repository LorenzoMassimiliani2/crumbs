---
id: TICKET-0018
title: Esportare le attività in Excel
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0014]
blocks: []
source: docs/spec/0002-attivita-fisica.md
github: 18
---

## Brief (AGENT-BRIEF)
Il file `.xlsx` deve includere le attività dell'intervallo scelto, senza modificare i fogli e i totali esistenti.

Comportamento richiesto:
- `GET /api/export` include le attività non cancellate dell'intervallo, ordinate per data e ora di inizio, con data, nome salvato, inizio, fine, durata in minuti e nota.
- Il file `.xlsx` contiene un foglio **Attività** con intestazioni: Data, Attività, Inizio, Fine, Durata (min), Nota.
- Gli orari sono mostrati nel fuso locale del dispositivo nel formato `HH:MM`.
- I fogli **pasti** e **giorni**, le loro intestazioni e i loro valori restano identici a prima della feature.
- Le attività cancellate non compaiono nell'export.
- Un intervallo senza attività produce il foglio con la sola riga di intestazione.

Interfacce:
- Il payload di export include `activities` con `date`, `name`, `startedAt`, `endedAt`, `durationMinutes`, `note`.
- I fogli vengono costruiti dalla funzione pura già usata dai test di export, estesa con la chiave `attivita`.

Fuori scope:
- modifiche ai fogli pasti e giorni;
- riepiloghi o totali delle attività;
- qualunque colonna di calorie per le attività.

## Acceptance criteria
- [ ] `GET /api/export` restituisce le attività dell'intervallo, ordinate per data e inizio.
- [ ] Il file `.xlsx` contiene il foglio **Attività** con le sei intestazioni previste.
- [ ] Una voce con inizio 23:00 e fine 01:00 esporta durata 120.
- [ ] Gli orari esportati sono nel formato `HH:MM` locale.
- [ ] I fogli pasti e giorni e i loro valori restano identici a prima.
- [ ] Le attività cancellate non compaiono.
- [ ] Un intervallo senza attività produce solo l'intestazione del foglio Attività.

## Choices

| decisione | rationale | alternatives_rejected | evidence |
| --- | --- | --- | --- |
| `GET /api/export` legge `activity_entries` filtrando `user_id`, `deleted_at IS NULL` e `local_date` nell'intervallo, ordinando per `local_date, started_at, id` | La `local_date` è il criterio con cui la voce appartiene al giorno (indipendente dal fuso dell'istante) e replica l'ordine del diario | Filtrare su `started_at`; ordinare solo per `started_at` senza la data | `src/worker/export.ts` (`ActivityRow`, query attività); test "returns the non-deleted activities of the range ordered by date and start" |
| Il payload espone `date`, `name`, `startedAt`, `endedAt`, `durationMinutes`, `note`; gli istanti restano ISO UTC e la durata usa `activityDurationMinutes` | Un solo calcolo della durata condiviso con le rotte attività; il fuso resta una responsabilità di presentazione | Calcolare la durata nel client; convertire gli istanti nel Worker | `src/worker/export.ts`; test "exports an activity that crosses midnight with its full duration" (23:00→01:00 = 120) |
| `src/lib/export.ts` formatta inizio e fine con `Date#getHours/getMinutes`, quindi nel fuso locale del dispositivo, in `HH:MM`; `buildExportSheets` restituisce anche `attivita` | Il file è costruito nel browser: usare i getter locali garantisce il fuso del dispositivo richiesto dal ticket e mantiene la funzione pura testabile | Formattare lato Worker con un fuso fisso; usare `toLocaleTimeString` (dipende dal locale) | `src/lib/export.ts` (`formatLocalTime`, `ATTIVITA_HEADERS`); test "maps the activities to one row per activity with local times" |
| `buildExportWorkbook` aggiunge il foglio `Attività` dopo `pasti` e `giorni`, con le sei intestazioni Data, Attività, Inizio, Fine, Durata (min), Nota | I fogli esistenti restano identici (ordine, intestazioni e valori) e il nuovo foglio si aggiunge in coda | Inserire Attività in testa; rinominare o riordinare i fogli esistenti | test "creates the three named sheets with the expected headers" e "round-trips through an xlsx file reader" |
| `DiaryExport.activities` è un campo obbligatorio del contratto; un intervallo senza attività produce solo la riga di intestazione | Il Worker restituisce sempre l'array (eventualmente vuoto) e il tipo riflette il contratto reale | Renderlo opzionale e gestire `undefined` nel builder | `src/lib/export.ts` (`DiaryExport`); test "keeps only the headers for an empty range" e "produces a readable file with only the headers for an empty range" |
