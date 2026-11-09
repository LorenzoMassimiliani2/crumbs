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
