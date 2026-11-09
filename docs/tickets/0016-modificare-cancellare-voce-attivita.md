---
id: TICKET-0016
title: Modificare e cancellare una voce attività
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0014]
blocks: []
source: docs/spec/0002-attivita-fisica.md
github: 16
---

## Brief (AGENT-BRIEF)
L'utente deve poter correggere o rimuovere un'attività già registrata, come avviene per i pasti.

Comportamento richiesto:
- Dalla vista Oggi ogni riga attività ha un comando di modifica che apre lo stesso flusso con i valori salvati: attività, data, inizio, fine, nota.
- Salvare in modifica aggiorna la voce esistente e non ne crea una nuova; la vista Oggi riflette subito i nuovi valori e l'ordine cronologico viene ricalcolato.
- Il flusso di modifica offre la cancellazione con una conferma esplicita.
- La cancellazione è un soft delete: la voce sparisce dalla vista Oggi e non è più restituita dal payload del giorno; una seconda cancellazione della stessa voce non produce errori.
- Modificare una voce non crea una nuova voce di catalogo.
- Le operazioni sono legate all'utente: un identificativo di un altro utente restituisce 404.

Interfacce:
- `PUT /api/activity-entries/:id` accetta gli stessi campi della creazione: `activityId`, `localDate`, `startedAt`, `endedAt`, `note?`.
- `DELETE /api/activity-entries/:id` esegue il soft delete e restituisce una risposta di successo anche se già cancellata.

Fuori scope:
- rinomina e cancellazione delle voci di catalogo (TICKET-0017);
- modifiche in blocco o undo della cancellazione;
- export (TICKET-0018).

## Acceptance criteria
- [ ] Una riga attività nella vista Oggi è modificabile e il flusso si apre precompilato.
- [ ] Salvare una modifica aggiorna la voce esistente: il numero di voci del giorno resta invariato.
- [ ] Cambiare gli orari riordina correttamente la sequenza di pasti e attività.
- [ ] La cancellazione chiede conferma; confermando, la voce sparisce dalla vista Oggi.
- [ ] `DELETE` sulla stessa voce due volte non restituisce errore.
- [ ] `GET /api/days/:date` non restituisce voci cancellate.
- [ ] `PUT` o `DELETE` con identificativo di un altro utente restituisce 404.
- [ ] I totali kcal del giorno restano invariati dopo modifica e cancellazione.

## Choices

| decisione | rationale | alternatives_rejected | evidence |
| --- | --- | --- | --- |
| `POST` e `PUT` condividono la validazione `parseEntryFields` in `src/worker/activities.ts`; il `PUT` la riusa identica e poi cerca l'attività nel catalogo dell'utente | Un solo punto per le regole di forma (data reale, istanti ISO, fine > inizio, massimo 24 h, nota ≤ 500) evita che creazione e modifica divergano | Validazione duplicata nel secondo handler; un parser diverso per gli aggiornamenti | `src/worker/activities.ts` (`parseEntryFields`, `updateActivityEntry`); test "rejects an invalid payload and writes nothing" |
| Il `PUT` aggiorna solo `activity_entries` e non tocca `activities.last_used_at` | `last_used_at` descrive l'ultimo uso registrato nel diario; una correzione di orari o nota non è un nuovo utilizzo e non deve riordinare il catalogo | Aggiornare `last_used_at` a ogni modifica (come fa la creazione) | `updateActivityEntry` non contiene UPDATE su `activities`; test "does not create catalog activities" |
| `name_snapshot` viene conservato quando la voce resta sullo stesso `activity_id`, e sostituito col nome corrente solo quando la modifica cambia attività | Coerente con lo snapshot storico della spec: rinominare il catalogo non riscrive il passato, ma scegliere un'altra attività deve mostrare il nome di quella nuova | Rileggere sempre il nome dal catalogo (avrebbe riscritto la storia a ogni salvataggio); non aggiornare mai lo snapshot (avrebbe mostrato il vecchio nome dopo il cambio attività) | `updateActivityEntry` (`existing.activity_id === activity.id`); test "switches the activity..." e "keeps the stored name snapshot..." |
| Il `PUT` risponde 404 sia per una voce inesistente, cancellata o di un altro utente, sia per un `activityId` inesistente o di un altro utente | L'id non deve rivelare l'esistenza di dati altrui; la voce cancellata non è più modificabile | 403 per l'attività di un altro utente; upsert della voce | test "returns 404 for a missing entry or one of another user" (include il caso `activityId` altrui) |
| Il `DELETE` verifica prima la proprietà della voce (`id` + `user_id`); se la voce esiste risponde sempre 204, anche quando `deleted_at` è già valorizzato | Idempotenza richiesta dal ticket senza distinguere prima e seconda cancellazione; il 404 resta riservato a id inesistenti o altrui | Contare le righe modificate e rispondere 404 alla seconda cancellazione; distinguere 200/204 | `deleteActivityEntry`; test "soft deletes the entry... and is idempotent" e "returns 404..." |
| L'ordine della timeline non ha codice dedicato: `listDayActivities` continua a ordinare per `started_at ASC, id ASC` e la vista Oggi ricompone pasti e attività per istante | L'ordinamento è già un'invariante del payload del giorno; cambiare gli orari e ricaricare il giorno basta a riposizionare la voce | Ricalcolare l'ordine nel client senza ricaricare; mantenere un campo di posizione | `src/worker/activities.ts` (`listDayActivities`), `HomeView.vue` (`timeline`); test "recalculates the day timeline..." e test UI "saves the change with PUT and shows the new chronological order" |
| La stessa `AddActivityFlow` gestisce creazione e modifica tramite la prop opzionale `activity`: precompila `selectedId`, orari locali `HH:MM` ricavati dagli istanti e nota, e cambia titolo/bottone | Riusa integralmente il flusso esistente (catalogo, ricerca, creazione al volo, durata derivata, conferma oltre 12 h) come chiede il ticket; nessun secondo form da mantenere | Un componente separato per la modifica; un flag booleano senza i dati precompilati | `src/views/AddActivityFlow.vue`; test UI "opens the edit flow precompiled..." |
| La cancellazione dalla UI è un blocco inline con conferma esplicita dentro il flusso di modifica | Ripete il pattern già usato per i pasti e i preferiti, senza `window.confirm` e senza uscire dal flusso | Bottone che cancella subito; dialogo nativo | `AddActivityFlow.vue` (`confirmingDelete`, `remove`); test UI "deletes only after an explicit confirmation..." |
| Totali e target restano invariati perché modifica e cancellazione scrivono solo su `activity_entries` e `GET /api/days/:date` calcola `totals` dai soli pasti | Rispetta il vincolo "l'attività è un dato di contesto": nessuna formula kcal tocca il netto | Ricalcolare i totali includendo le attività | `src/worker/meals.ts` (`getDay`); test "recalculates the day timeline ... and leaves totals alone" |
