---
id: TICKET-0017
title: Gestire il catalogo delle attività
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0014]
blocks: []
source: docs/spec/0002-attivita-fisica.md
github: 17
---

## Brief (AGENT-BRIEF)
L'utente deve poter rinominare e cancellare le voci del catalogo attività senza alterare le voci già registrate nel diario.

Comportamento richiesto:
- Nel flusso **+ Attività** è possibile rinominare una voce di catalogo (nome obbligatorio, massimo 80 caratteri) e cancellarla con conferma.
- Rinominare una voce non cambia il nome delle voci di diario che la usavano: il diario mostra la copia salvata al momento della registrazione.
- Cancellare una voce di catalogo la rimuove dalla lista di scelta e scollega le voci di diario che la usavano; quelle voci restano visibili nel diario con il nome salvato.
- Una voce di diario il cui catalogo è stato cancellato resta modificabile: per salvarla bisogna scegliere un'attività esistente dal catalogo, che sostituisce il nome salvato.
- Le voci predefinite sono modificabili e cancellabili come quelle create dall'utente.
- Usare un'attività aggiorna il suo ultimo utilizzo, così la lista resta ordinata per uso recente.

Interfacce:
- `PATCH /api/activities/:id` con `{name}` rinomina una voce dell'utente.
- `DELETE /api/activities/:id` cancella la voce del catalogo; le voci di diario collegate restano con il nome salvato.
- Un `id` inesistente o di un altro utente restituisce 404.
- Un nome vuoto o oltre 80 caratteri restituisce 400.

Fuori scope:
- modifica delle voci di diario (TICKET-0016);
- import/export del catalogo;
- categorie, icone o metadati delle attività.

## Acceptance criteria
- [ ] Si può rinominare una voce di catalogo; la lista mostra subito il nuovo nome.
- [ ] Rinominare non cambia il nome delle voci di diario già salvate.
- [ ] Si può cancellare una voce di catalogo con conferma; sparisce dalla lista di scelta.
- [ ] Le voci di diario dell'attività cancellata restano nel diario con il nome salvato.
- [ ] Modificare una voce il cui catalogo è stato cancellato richiede la scelta di un'attività e salva il nuovo nome.
- [ ] `PATCH` con nome vuoto o oltre 80 caratteri restituisce 400.
- [ ] `PATCH` e `DELETE` con identificativo di un altro utente restituiscono 404.

## Choices

| decisione | rationale | alternatives_rejected | evidence |
| --- | --- | --- | --- |
| `PATCH /api/activities/:id` riusa `parseName` e valida il corpo prima di cercare la voce; risponde 400 per nome assente/vuoto/oltre 80 e 404 per id inesistente o altrui | Un solo punto per la regola del nome condivisa con `POST`, e la forma della richiesta è indipendente dal possesso della riga | Un parser separato per la rinomina; cercare prima la voce e validare dopo | `src/worker/activities.ts` (`updateActivity`, `parseName`); test "rejects an empty name or one longer than 80 characters" e "returns 404..." |
| La rinomina scrive solo su `activities` e restituisce `{ id, name, lastUsedAt }` letto dalla riga, senza toccare `activity_entries` | `name_snapshot` è la copia storica del diario: rinominare il catalogo non deve riscrivere il passato | Aggiornare `name_snapshot` delle voci col nuovo nome | `updateActivity`; test "does not rewrite the names saved in the diary"; test UI "renames a catalog activity..." |
| `DELETE /api/activities/:id` esegue in un solo `batch` (transazione) prima l'`UPDATE activity_entries SET activity_id = NULL` e poi il `DELETE` della voce; risponde 204 | Il batch D1 è atomico: nessuno stato intermedio con voci scollegate e catalogo ancora presente o viceversa | Affidarsi a `ON DELETE SET NULL`; due chiamate separate | `deleteActivity`; test "removes the activity from the catalog and unlinks its diary entries"; `src/test/d1.ts` (batch = transazione) |
| Lo scollegamento esplicito copre tutte le voci dell'utente con quell'`activity_id`, anche quelle soft-deleted | La migrazione dichiara `ON DELETE SET NULL` ma D1 non abilita le foreign key per default: l'`UPDATE` esplicito rende il comportamento indipendente dal pragma e non lascia riferimenti orfani | Solo `DELETE` sulla tabella catalogo; `UPDATE` filtrato su `deleted_at IS NULL` | `deleteActivity`; migrazione `0003_activities.sql` (`activity_id ... ON DELETE SET NULL`); test "removes the activity... unlinks its diary entries" |
| Nel flusso `+ Attività` ogni riga del catalogo ha due bottoni icona (`Rinomina <nome>`, `Elimina <nome>`) che aprono pannelli inline con Salva/Annulla o conferma esplicita | Riusa il pattern già usato per i preferiti alimentari, senza `window.confirm` e senza uscire dal flusso; il testo della conferma spiega che le voci già registrate non cambiano | Modifica in-place della pill; menu contestuale; dialogo nativo | `src/views/AddActivityFlow.vue`; test UI "deletes a catalog activity only after confirmation..." |
| Dopo la `PATCH` il catalogo locale viene aggiornato con la voce restituita dal server, senza una seconda `GET`; dopo la `DELETE` la voce viene rimossa localmente | Evita un round-trip e un lampo di lista non aggiornata, mantenendo il flusso aperto sull'attività selezionata | Ricaricare sempre il catalogo; aggiornare solo alla chiusura del flusso | `saveRename`, `confirmDelete` in `AddActivityFlow.vue`; test UI "renames a catalog activity..." |
| Il salvataggio della voce richiede `selected` (la voce esiste nel catalogo caricato), non solo un `selectedId` valorizzato; cancellare la voce selezionata azzera `selectedId` | Se il catalogo della voce è stato cancellato, `activityId` punta a un id assente: la voce resta modificabile ma va scelta un'attività esistente | Fidarsi del solo id ricevuto dalla voce; salvare comunque l'id orfano | `requestSave`/`save` in `AddActivityFlow.vue`; test UI "requires an existing activity to save an entry whose catalog entry was deleted" e "clears the selection..." |
| Le voci predefinite non hanno un flag di sistema: rinomina e cancellazione le trattano come quelle create dall'utente | La spec chiede esplicitamente che siano modificabili e cancellabili; nessuna colonna o distinzione aggiuntiva necessaria | Marcare le predefinite come protette o copiarle per utente alla prima modifica | test "renames the default catalog entries too" e "deletes the default catalog entries too" |

| Il catalogo viene seminato una sola volta per utente tramite `users.activities_seeded`; cancellare tutte le voci non fa ricomparire le predefinite | La review ha rilevato una risemina dopo la cancellazione dell'ultima voce: il flag separa "mai seminato" da "catalogo vuoto per scelta" | Seminare a ogni `COUNT(*) = 0`; seminare alla creazione utente senza flag | migrazione `0004_activity_catalog_seed.sql`; `listActivities`; test "does not reseed after the user deletes every catalog activity" |
| `PATCH /api/activities/:id` cerca prima la voce e solo dopo valida il nome: un id inesistente o altrui risponde 404 anche con nome non valido | Allinea l'ordine a SPEC-0002 §Catalogo AC 4; evita di rivelare la validità del nome per righe che non appartengono all'utente | Validare il corpo prima del possesso (scelta precedente, ora superata) | `updateActivity`; test PATCH 404 con nome vuoto su id mancante e altrui |
