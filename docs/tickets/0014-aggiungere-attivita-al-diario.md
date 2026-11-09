---
id: TICKET-0014
title: Aggiungere un'attività al diario
status: ready-for-agent
category: enhancement
blocked_by: []
blocks: [TICKET-0015, TICKET-0016, TICKET-0017, TICKET-0018]
source: docs/spec/0002-attivita-fisica.md
github: 14
---

## Brief (AGENT-BRIEF)
L'utente deve poter registrare un'attività fisica nel giorno selezionato nella vista Oggi e vederla nel diario insieme ai pasti. L'attività è solo informativa: nessuna calorie, nessun effetto su `totals` o `targetKcal`.

Comportamento richiesto:
- Il FAB in basso a destra apre un chooser con due azioni: **+ Pasto** e **+ Attività**. **+ Pasto** apre il flusso esistente senza cambi di comportamento.
- **+ Attività** apre un flusso con: scelta dell'attività dal catalogo (ricerca tra le voci, ordinate per ultimo utilizzo), creazione di una nuova attività al volo (nome obbligatorio, massimo 80 caratteri), data uguale al giorno selezionato, ora di inizio (default: ora corrente), ora di fine (default: inizio + 1 ora), nota opzionale (massimo 500 caratteri). Se l'ora di fine non è successiva all'inizio, il salvataggio è bloccato con un messaggio chiaro.
- La durata è derivata da inizio e fine ed è mostrata in sola lettura mentre si compila.
- Il catalogo parte con un set predefinito quando l'utente non ha ancora voci: Camminata, Corsa, Bicicletta, Palestra, Nuoto, Yoga, Pilates, Calcetto, Tennis, Escursione. Le voci mai usate vengono dopo quelle usate, in ordine alfabetico.
- Una voce attività salvata conserva una copia del nome dell'attività del catalogo.
- La vista Oggi mostra pasti e attività in un'unica sequenza ordinata per orario; la riga attività è compatta: nome, intervallo inizio–fine, durata; la nota appare solo se presente.
- Salvataggio atomico della voce: se i dati non sono validi non viene scritto nulla. Se il flusso crea prima una nuova attività di catalogo e poi la voce fallisce, l'attività resta nel catalogo, senza voce nel diario.

Interfacce:
- `Activity`: `id`, `name`, `lastUsedAt` (ISO o null).
- `DayActivity`: `id`, `activityId`, `name`, `startedAt`, `endedAt` (istanti ISO), `durationMinutes`, `note`.
- Il payload del giorno include `activities: DayActivity[]`.
- Rotte: `GET /api/activities`, `POST /api/activities` con `{name}`, `POST /api/activity-entries` con `{activityId, localDate, startedAt, endedAt, note?}`.
- `GET /api/days/:date` include le attività non cancellate della data, ordinate per inizio.
- Tutte le rotte usano la credenziale esistente e filtrano per utente autenticato.

Fuori scope:
- modifica e cancellazione delle voci (TICKET-0016);
- rinomina e cancellazione delle voci di catalogo (TICKET-0017);
- orari che scavalcano la mezzanotte e conferma oltre 12 ore (TICKET-0015);
- export (TICKET-0018);
- calorie bruciate, MET, target o netto giornaliero.

## Acceptance criteria
- [ ] Il FAB apre il chooser con **+ Pasto** e **+ Attività**; il flusso pasto resta invariato.
- [ ] **+ Attività** mostra catalogo, campo per una nuova attività, data, inizio, fine e nota.
- [ ] Inizio default ora corrente, fine default inizio + 1 ora; durata aggiornata mentre si modificano gli orari.
- [ ] Salvare crea la voce e la vista Oggi la mostra senza ricaricare la pagina.
- [ ] Pasti e attività sono in un'unica sequenza cronologica: un'attività 12:00–13:30 compare prima di un pasto delle 13:00.
- [ ] La riga attività mostra nome, inizio–fine e durata in forma compatta; la nota compare solo se non vuota.
- [ ] `GET /api/activities` su un utente senza voci restituisce le 10 voci predefinite; una voce usata sale sopra quelle mai usate.
- [ ] `POST /api/activities` con nome vuoto o oltre 80 caratteri restituisce 400.
- [ ] `POST /api/activity-entries` salva il nome del catalogo come copia e restituisce la voce con `durationMinutes` corretto.
- [ ] Un `activityId` inesistente o di un altro utente restituisce 404; `localDate` non valida restituisce 400.
- [ ] Il totale kcal e il target del giorno non cambiano aggiungendo un'attività.
- [ ] Tutte le nuove rotte richiedono la credenziale e non espongono dati di altri utenti.

## Choices
| decisione | rationale | alternatives_rejected | evidence |
| --- | --- | --- | --- |
| Il catalogo predefinito viene creato alla prima `GET /api/activities` di un utente senza righe in `activities` | Rispetta la spec ("al primo accesso al catalogo") senza toccare la creazione utente né le migrazioni esistenti | Seed alla creazione dell'utente; seed in migrazione per tutti gli utenti | `src/worker/activities.ts` (`seedDefaults`); test "seeds the ten default activities on first access" |
| L'ordinamento del catalogo è `last_used_at DESC, lower(name) ASC` | Le voci usate salgono per ultimo utilizzo; le mai usate restano alfabetiche. Stessa convenzione dei preferiti alimentari | Ordinamento solo alfabetico; colonna `use_count` | `src/worker/activities.ts`; test "puts used activities above unused ones..." |
| `last_used_at` viene aggiornato quando si crea una voce del diario | "Una voce usata sale sopra quelle mai usate" richiede un segnale di utilizzo; il salvataggio della voce è il momento naturale | Aggiornare al click sulla voce in UI; contare le voci | `createActivityEntry` batch; test "marks the catalog activity as used" |
| In 0014 `endedAt <= startedAt` restituisce 400 e blocca il salvataggio | Comportamento richiesto dal ticket; la UI mostra lo stesso messaggio e non invia la richiesta | Correggere implicitamente la fine al giorno successivo | `createActivityEntry`; test "rejects an end that is not after the start"; test UI "blocks the save..." |
| Nessun limite di 12/24 ore in 0014 | Il ticket assegna conferma oltre 12 ore e gestione mezzanotte a TICKET-0015; aggiungerli ora duplicherebbe il lavoro | Implementare subito il solo limite 24 h lato server | `docs/tickets/0015-attivita-mezzanotte-durate-lunghe.md`; nessun codice 12/24 h in `activities.ts` |
| La nuova attività di catalogo si crea con il bottone "Crea attività", non al salvataggio della voce | Se la voce fallisce l'attività resta comunque nel catalogo, come richiesto; l'utente la vede e la può selezionare subito | Creare l'attività dentro il POST della voce (nasconderebbe il fallimento parziale) | `src/views/AddActivityFlow.vue` (`createActivity`); test "creates a new catalog activity from the flow" |
| La sequenza unica pasti+attività è calcolata nel client ordinando gli istanti di `occurredAt` e `startedAt` | Il server mantiene `meals` e `activities` separati (contratto API), la UI li unisce solo per la lettura cronologica | Unire lato server in un array `entries` eterogeneo | `src/views/HomeView.vue` (`timeline`); test "shows meals and activities in one chronological sequence" |
| `activityDurationMinutes` e `formatDuration` vivono in `src/lib/activity.ts` e sono usati da UI e test | Un solo punto per derivare e formattare la durata, senza duplicare aritmetica tra client e worker | Calcolare la durata solo lato server o solo in componente | `src/lib/activity.ts`; `src/lib/activity.test.ts`; `src/worker/activities.ts` |
| La copia del nome è `name_snapshot` e `activity_id` ammette `NULL` | La storia del diario non dipende dal catalogo: prepara TICKET-0017 senza implementarlo | Copiare solo `activity_id` e fare join sul catalogo | Migrazione `0003_activities.sql`; test "saves the name snapshot..." |
| Il FAB ora apre un chooser (`data-testid="add-entry"`) con `choose-meal` e `choose-activity` | Richiesto dal ticket; il flusso pasto resta identico dietro `choose-meal` | Due FAB separati; long-press | `src/views/HomeView.vue`; test "opens a chooser with + Pasto e + Attività" |
