---
id: FEAT-0001
title: Attività fisica nel diario
status: merged
branch: feat/0001-attivita-fisica
worktree: .worktrees/0001
batch: 1
depends_on: []
touches:
  - migrations/
  - src/worker/index.ts
  - src/worker/activities.ts
  - src/worker/export.ts
  - src/lib/diary.ts
  - src/lib/export.ts
  - src/views/HomeView.vue
  - src/views/AddActivityFlow.vue
  - src/components/BottomTabs.vue
  - src/components/ActivityCatalog.vue
created_by: 01a1bf54-6f3a-7575-ba0d-9e4237b8cbce
created: 2026-11-09
---

## Brief

### Obiettivo

Registrare l'attività fisica giornaliera nel diario di Crumbs, accanto ai pasti. L'attività è **solo informativa**: si annota cosa si è fatto, quando e per quanto tempo, e la voce compare nel diario del giorno. Non produce calorie, non modifica il target né il netto giornaliero.

La feature comprende:

- un **catalogo personale di attività** riutilizzabile, con voci predefinite (camminata, corsa, bici, palestra, nuoto, yoga, ecc.) più le voci create dall'utente, ordinato per ultimo utilizzo;
- un **flusso di aggiunta** che parte dal FAB unico, diventato un chooser **+ Pasto / + Attività**;
- l'inserimento di **ora di inizio e ora di fine**, entrambe modificabili, con durata derivata e mostrata;
- visualizzazione **compatta e intercalata cronologicamente** ai pasti nella vista Oggi;
- modifica e cancellazione delle voci con soft delete;
- esportazione in un foglio **Attività** del file `.xlsx`.

### Comportamento richiesto

- Il FAB in basso a destra apre un chooser con due azioni: **+ Pasto** (flusso attuale, invariato) e **+ Attività**.
- Il flusso **+ Attività** permette di scegliere un'attività dal catalogo (ricerca tra le voci, ordinate per ultimo utilizzo) oppure crearne una nuova al volo.
- I campi sono: attività, data (il giorno selezionato in Oggi), ora di inizio (default: adesso), ora di fine (default: inizio + 1 ora), nota opzionale.
- La durata è derivata da inizio e fine e mostrata in sola lettura mentre si compila.
- Se l'ora di fine è precedente all'ora di inizio, l'attività si intende conclusa il giorno successivo; oltre 12 ore di durata la UI chiede conferma prima di salvare.
- Il salvataggio è atomico: o la voce è valida e viene scritta, o non viene scritto nulla.
- Le voci di attività compaiono nella vista Oggi in ordine cronologico insieme ai pasti, in forma compatta: nome, inizio–fine, durata; la nota appare solo se presente.
- La voce salvata conserva uno **snapshot del nome** dell'attività: rinominare o cancellare la voce di catalogo non altera le voci già registrate.
- Eliminare una voce del diario è un soft delete: sparisce dal diario e dall'export, non dallo storico del database.
- L'export `.xlsx` contiene un foglio **Attività** con data, nome, inizio, fine, durata in minuti e nota. I fogli e i totali kcal esistenti restano invariati.
- Ogni tabella e ogni query sono legati a `user_id`, come il resto dell'app.

### Fuori scope

- calorie bruciate, MET, peso usato per il calcolo, qualunque forma di bilancio energetico;
- modifica del target kcal, del netto giornaliero o dei macro;
- attività ricorrenti, pianificazione, promemoria e notifiche;
- integrazione con Google Fit, Apple Health o altre API esterne;
- scritture offline e sincronizzazione;
- modifica in blocco o import di attività;
- nuovi metodi di autenticazione o modifica delle regole di accesso.

### Criteri di accettazione (alto livello)

- [ ] La vista Oggi mostra pasti e attività in un'unica sequenza cronologica; le attività hanno resa compatta con nome, inizio–fine e durata.
- [ ] Il FAB apre il chooser con **+ Pasto** e **+ Attività**; il flusso pasto esistente non cambia.
- [ ] Il flusso attività propone il catalogo ordinato per ultimo utilizzo e permette di creare una nuova attività.
- [ ] Inizio default adesso, fine default inizio + 1 ora; durata derivata e aggiornata mentre si modificano gli orari.
- [ ] Un'attività con fine precedente all'inizio viene salvata come conclusa il giorno successivo; oltre 12 ore si chiede conferma.
- [ ] Una voce di attività è modificabile e cancellabile; la cancellazione è soft delete e la rimuove dal diario e dall'export.
- [ ] Rinominare o cancellare un'attività del catalogo non cambia il nome nelle voci già registrate.
- [ ] L'export contiene il foglio Attività; i totali kcal giornalieri sono identici a prima.
- [ ] Nessuna calorie di attività è calcolata o mostrata in nessun punto dell'app.
- [ ] Tutte le nuove rotte `/api/*` richiedono la credenziale esistente e filtrano per `user_id`.

### Dati e API (proposta, da confermare in spec)

- Nuova tabella `activities` (catalogo personale): `id`, `user_id`, `name`, `last_used_at`, `created_at`, `updated_at`.
- Nuova tabella `activity_entries` (diario): `id`, `user_id`, `activity_id` nullable, `name_snapshot`, `local_date`, `started_at`, `ended_at`, `note`, `created_at`, `updated_at`, `deleted_at`.
- `GET /api/activities` — catalogo ordinato per ultimo utilizzo.
- `POST /api/activities`, `PUT /api/activities/:id`, `DELETE /api/activities/:id` — gestione catalogo.
- `POST /api/activity-entries`, `PUT /api/activity-entries/:id`, `DELETE /api/activity-entries/:id` — voci del diario.
- `GET /api/days/:date` esteso con `activities` ordinate per `started_at`.

### Strategia di esecuzione

- Seriale, un solo batch, un branch `feat/0001-attivita-fisica`.
- Esecuzione manuale salvo passaggio esplicito a `orchestrator`.

## Sub-spec / tickets

Spec e ticket generati da questo brief. Prossimo passo: `implement-spec` (manuale) oppure passaggio a `orchestrator`.

- spec: docs/spec/0002-attivita-fisica.md
- tickets:
  - TICKET-0014 — Aggiungere un'attività al diario (`docs/tickets/0014-aggiungere-attivita-al-diario.md`, #14)
  - TICKET-0015 — Attività oltre la mezzanotte e durate lunghe (`docs/tickets/0015-attivita-mezzanotte-durate-lunghe.md`, #15)
  - TICKET-0016 — Modificare e cancellare una voce attività (`docs/tickets/0016-modificare-cancellare-voce-attivita.md`, #16)
  - TICKET-0017 — Gestire il catalogo delle attività (`docs/tickets/0017-gestire-catalogo-attivita.md`, #17)
  - TICKET-0018 — Esportare le attività in Excel (`docs/tickets/0018-esportare-attivita-excel.md`, #18)

## Note di merge (compilate da orchestrator)

- risultato merge su `orchestrator/integrate`: non-eseguito
- note conflitto (se stop umano): —

## Implementazione

- Ticket 0014–0018 implementati e verificati sul branch `feat/attivita`.
- Review standards + spec eseguita; finding corretti in `748f9b1`.
- Merge su `main`: completato (c7226a2).
