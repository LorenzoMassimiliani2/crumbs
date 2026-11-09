---
id: TICKET-0021
title: Modificare ed eliminare una misura di peso
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0019]
blocks: []
source: docs/spec/0003-peso-andamento.md
github: 21
---

## Brief (AGENT-BRIEF)
L'utente deve poter correggere o rimuovere una misura già registrata dalla lista della tab Peso.

Comportamento richiesto:
- Ogni riga della lista ha un comando di modifica che apre il form con data e peso salvati; salvare aggiorna quella misura, non ne crea una nuova.
- Se la modifica sposta la misura su una data già occupata, la UI chiede conferma prima di sovrascrivere.
- Ogni riga ha un comando di eliminazione con conferma esplicita.
- L'eliminazione è definitiva: la misura sparisce subito da lista, valori correnti e grafico; niente soft delete.
- Dopo eliminazione o modifica, il peso corrente mostrato e la cache del profilo seguono l'ultima misura disponibile; senza misure resta l'ultimo valore noto.
- Le operazioni sono legate all'utente: una data di un altro utente non è modificabile né cancellabile.

Interfacce:
- `DELETE /api/weights/:date` elimina la misura e risponde 204; se la data non ha misura risponde 404.
- `PUT /api/weights/:date` resta l'unico punto di scrittura e copre anche la modifica.
- Il client ricarica o aggiorna localmente lista, peso corrente e grafico dopo ogni operazione.

Fuori scope:
- modifica in blocco, undo della cancellazione, storico delle modifiche;
- export;
- modifiche al contratto del profilo.

## Acceptance criteria
- [ ] Ogni riga della lista è modificabile e il form si apre con data e peso precompilati.
- [ ] Salvare una modifica aggiorna la misura esistente senza aumentare il numero di righe.
- [ ] Spostare una misura su una data già occupata richiede conferma; annullando non si scrive nulla.
- [ ] L'eliminazione richiede conferma ed è definitiva.
- [ ] Dopo l'eliminazione la misura sparisce da lista, peso corrente e grafico.
- [ ] `DELETE /api/weights/:date` risponde 204 se esiste e 404 se non esiste.
- [ ] Dopo una modifica o eliminazione la cache `profiles.weight_kg` segue l'ultima misura disponibile.
- [ ] Modifica ed eliminazione di dati di altri utenti non sono possibili.

## Choices
- **`DELETE /api/weights/:date` eseguito con `DELETE ... RETURNING id` nello stesso `DB.batch` che ricalcola la cache del profilo**: il 404 nasce dall'assenza di righe restituite; la cache si aggiorna nella stessa transazione della cancellazione.
  - rationale: un solo round-trip transazionale, nessuna finestra tra controllo di esistenza e cancellazione, e il segnale di esistenza è la riga effettivamente eliminata.
  - alternatives_rejected: `SELECT` preventivo seguito da `DELETE` (race e due statement fuori transazione); `meta.changes` del batch (non popolato dall'adapter D1 dei test, quindi non verificabile al seam HTTP).
  - evidence: `src/worker/weights.ts` (`deleteWeight`); test "deletes the measurement of the date and returns 204", "returns 404 when the date has no measurement", "does not delete or reveal another user measurement".

- **Eliminazione fisica, nessun soft delete**: la riga sparisce da `weight_entries`.
  - rationale: richiesto dal ticket; il registro non ha storia da conservare e la semina una-tantum impedisce il ripopolamento.
  - alternatives_rejected: colonna `deleted_at` con filtri su tutte le letture (complessità non richiesta).
  - evidence: assenza di `deleted_at` in `migrations/0005_weight_entries.sql`; test dopo `DELETE` la lista è vuota.

- **Aggiornamento della cache estratto in `refreshProfileWeightStatement`, condiviso da `PUT` e `DELETE`**: subquery sull'ultima `measured_on` e guardia `EXISTS`.
  - rationale: creazione, modifica ed eliminazione usano la stessa regola in un unico punto; senza misure l'`UPDATE` non tocca `weight_kg` e resta l'ultimo valore noto.
  - alternatives_rejected: due statement duplicati per upsert e delete (divergenza); azzerare il peso quando il registro si svuota (viola il requisito "resta l'ultimo valore noto").
  - evidence: test "moves the profile weight cache to the latest remaining measurement", "keeps the last known profile weight after deleting the only measurement".

- **La modifica scrive prima la data di destinazione (`PUT`) e poi cancella quella originale (`DELETE`), solo quando la data è cambiata**: su stesso giorno un solo `PUT`.
  - rationale: se la seconda chiamata fallisce resta un duplicato recuperabile e visibile, invece di una misura persa; il contratto server resta quello del ticket (`PUT` unico punto di scrittura, `DELETE` per rimuovere la vecchia data).
  - alternatives_rejected: cancellare prima e poi scrivere (perdita di dati su errore); endpoint atomico di spostamento (fuori dal contratto delle interfacce).
  - evidence: `src/views/WeightView.vue` (`commitEdit`); test "moves a measurement to a free date by writing the new date and deleting the old one".

- **Conferma di sovrascrittura lato client, basata sulle misure già caricate**: se la data di destinazione è diversa dall'originale ed esiste nell'elenco, compare un blocco inline con "Sovrascrivi"/"Annulla"; annullando il form resta aperto e non parte nessuna richiesta.
  - rationale: il `PUT` è un upsert per contratto e non può distinguere una modifica voluta da una collisione; la conferma è una decisione di UI e i dati necessari sono già nella lista.
  - alternatives_rejected: parametro `confirm` sul server (amplia il contratto senza necessità); `window.confirm` (non testabile e fuori dal pattern dell'app).
  - evidence: test "asks for confirmation before moving a measurement onto an occupied date and writes nothing if cancelled", "overwrites the occupied date only after confirmation and refreshes the view".

- **Conferma di eliminazione inline sulla riga, con "Conferma eliminazione"/"Annulla"**: nessun `window.confirm`, stesso pattern di pasti e attività.
  - rationale: coerenza con le altre viste e possibilità di verificare nel DOM che nulla parta prima della conferma.
  - alternatives_rejected: cancellazione immediata al primo tocco (troppo distruttiva); dialogo nativo (non testabile).
  - evidence: test "deletes only after explicit confirmation and refreshes list, summary and chart".

- **Dopo modifica ed eliminazione la vista ricarica `GET /api/weights` invece di aggiornare lo stato locale**: lista, peso corrente, variazione e grafico derivano dalla stessa risposta.
  - rationale: la cache del profilo e l'ordinamento sono ricalcolati dal server; un aggiornamento ottimistico locale potrebbe divergere, soprattutto nello spostamento su data occupata.
  - alternatives_rejected: patch locale dell'array (duplicazione della logica server, rischio di stato incoerente).
  - evidence: `load()` in `WeightView.vue` dopo `commitEdit` e `removeEntry`; test su riepilogo, variazione e numero di punti del grafico.

- **Il test di TICKET-0019 "lista in sola lettura" è stato riscritto**: ora ogni riga espone i comandi Modifica ed Elimina, come richiede questo ticket.
  - rationale: il comportamento precedente era esplicitamente provvisorio ("la modifica e la cancellazione arrivano in TICKET-0021").
  - alternatives_rejected: lasciare l'asserzione (fallirebbe) o rimuovere il test (perdita della copertura sulla lista).
  - evidence: `src/views/WeightView.test.ts`, test "lists the ten most recent measurements from the newest".

| Durante la conferma di sovrascrittura i campi della modifica sono disabilitati | Corregge il finding della review: la conferma inviava lo snapshot `pendingEdit`, che poteva divergere dai valori visibili | Rileggere i campi al click su Sovrascrivi; chiudere il dialogo a ogni modifica | `WeightView.vue` (`:disabled="confirmingOverwrite"` sui campi data e peso) |
