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
