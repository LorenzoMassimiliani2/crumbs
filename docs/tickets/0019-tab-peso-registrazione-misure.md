---
id: TICKET-0019
title: Tab Peso e registrazione delle misure
status: ready-for-agent
category: enhancement
blocked_by: []
blocks: [TICKET-0020, TICKET-0021]
source: docs/spec/0003-peso-andamento.md
github: 19
---

## Brief (AGENT-BRIEF)
Il peso deve uscire dal Profilo e diventare una sezione dedicata, con storico datato. L'utente deve poter registrare una misura e rivederla nella lista.

Comportamento richiesto:
- La barra in basso ha tre tab, in ordine **Peso**, **Oggi**, **Profilo**; la route del peso è `/weight`, Oggi resta `/` ed è la tab attiva all'apertura.
- La tab Peso mostra: peso corrente (ultima misura), data dell'ultima misura, variazione rispetto alla misura precedente; se non ci sono misure, uno stato vuoto con il form pronto.
- Form rapido: data (default oggi) e peso in kg con un decimale, tra 30 e 300. Salvare crea la misura o aggiorna quella della stessa data e aggiorna subito i valori mostrati.
- Lista compatta delle ultime 10 misure, dalla più recente, con data e peso (la modifica e la cancellazione arrivano in TICKET-0021).
- Al primo accesso, se il registro è vuoto e il profilo ha un peso, viene creata la misura di oggi con quel peso. La semina avviene una sola volta per utente: dopo aver cancellato tutte le misure non si ripopola.
- La cache del peso nel profilo segue l'ultima misura disponibile dopo creazione e aggiornamento; inserire una misura più vecchia della corrente non cambia il peso corrente. Se non restano misure, la cache mantiene l'ultimo valore noto.
- Gestione esclusiva per utente autenticato, come le altre rotte.

Interfacce:
- `WeightEntry`: `date` (`YYYY-MM-DD`), `weight` (numero).
- `GET /api/weights?today=YYYY-MM-DD` restituisce le misure in ordine di data crescente. `today` è la data locale del client; se manca o non è una data reale si usa la data UTC corrente. La semina usa `today`.
- `PUT /api/weights/:date` con `{weight}` crea o aggiorna la misura e restituisce la voce salvata.
- Validazioni: data non reale, peso non numerico, minore di 30 o maggiore di 300 rispondono 400.
- `GET /api/profile` continua a restituire `weight` (peso corrente); `PUT /api/profile` non cambia in questo ticket.

Fuori scope:
- grafico e selettore del periodo (TICKET-0020);
- modifica ed eliminazione delle misure (TICKET-0021);
- rimozione del campo peso dal form Profilo e cambio del contratto `PUT /api/profile` (TICKET-0022);
- export, obiettivo peso, altre misure corporee.

## Acceptance criteria
- [ ] La barra in basso mostra Peso, Oggi e Profilo in quest'ordine; si atterra su Oggi.
- [ ] `/weight` apre la tab Peso e mostra peso corrente, data dell'ultima misura e variazione.
- [ ] Con registro vuoto la tab mostra uno stato vuoto e il form utilizzabile.
- [ ] Salvare una misura nuova la aggiunge; salvare la stessa data aggiorna il valore senza creare duplicati.
- [ ] La lista mostra le ultime 10 misure dalla più recente con data e peso.
- [ ] Al primo accesso con profilo compilato e registro vuoto viene creata la misura di `today` con il peso del profilo.
- [ ] Dopo aver cancellato tutte le misure, `GET /api/weights` non ricrea le misure.
- [ ] `GET /api/weights` restituisce le misure in ordine crescente di data e usa la data UTC se `today` è assente o non valida.
- [ ] `PUT /api/weights/:date` rifiuta con 400 date non reali e pesi fuori da 30–300.
- [ ] `profiles.weight_kg` segue l'ultima misura; una misura retroattiva non cambia il peso corrente.
- [ ] Senza misure, `profiles.weight_kg` mantiene l'ultimo valore noto.
- [ ] Le rotte del peso richiedono la credenziale e filtrano per utente; dati di altri utenti non sono visibili né modificabili.

## Choices
- **Migrazione additiva `0005_weight_entries.sql`**: nuova tabella `weight_entries` con `UNIQUE (user_id, measured_on)` e colonna `users.weights_seeded INTEGER NOT NULL DEFAULT 0`.
  - rationale: una sola riga per data è garantita dal database; il flag replica il pattern già usato per il catalogo attività ed è l'unico modo per distinguere "registro mai inizializzato" da "registro svuotato".
  - alternatives_rejected: deduplica applicativa senza vincolo (rischio di doppioni da richieste concorrenti); flag in `profiles` (il profilo può non esistere).
  - evidence: `migrations/0005_weight_entries.sql`, test "updates the measurement of the same date without duplicating it".

- **Semina su `GET /api/weights` con claim atomico del flag**: `UPDATE users SET weights_seeded = 1 WHERE id = ? AND weights_seeded = 0` precede il conteggio e l'insert; l'insert usa `INSERT OR IGNORE`.
  - rationale: stesso schema di `listActivities`; il flag viene reclamato anche senza peso nel profilo, così un profilo compilato in seguito non fa ripartire la semina.
  - alternatives_rejected: seminare quando il profilo viene salvato (accoppia Profilo e registro, fuori scope TICKET-0022); contare le righe senza flag (risemina dopo cancellazione).
  - evidence: test "seeds the profile weight on today only once", "does not reseed after every measurement is deleted".

- **Cache `profiles.weight_kg` aggiornata nello stesso `DB.batch` dell'upsert**, con subquery `ORDER BY measured_on DESC LIMIT 1` e `EXISTS` sulle misure.
  - rationale: scrittura misura e cache restano atomiche; una misura retroattiva non sposta il peso corrente perché vince sempre la data massima; senza misure l'`UPDATE` non tocca la cache e resta l'ultimo valore noto.
  - alternatives_rejected: calcolo in applicazione con due statement separati (finestra non atomica); trigger SQLite (più difficile da testare e da leggere).
  - evidence: `src/worker/weights.ts`, test "keeps the profile weight cache on the latest measurement", "keeps the last known profile weight when no measurement remains".

- **`today` validato con `isRealDate` e fallback `new Date().toISOString().slice(0, 10)`**.
  - rationale: riusa il validatore esistente; il client manda la data locale, il server non si fida e ha un default deterministico UTC.
  - alternatives_rejected: nuova utility di validazione data (duplicazione); rifiutare `today` non valido (il contratto chiede fallback).
  - evidence: test "falls back to the UTC date when today is missing or not a real date".

- **Vista `WeightView` con riepilogo, form e lista senza router interno**: `GET /api/weights?today=...` al mount, `PUT /api/weights/:date` al submit, ricarica dopo il salvataggio.
  - rationale: la lista riflette subito upsert e semina; il form resta utilizzabile nello stato vuoto e la lista è sola lettura come richiesto.
  - alternatives_rejected: aggiornamento ottimistico dello stato locale (divergerebbe dalla cache e dalla semina); stato globale Pinia (una sola vista consumatrice).
  - evidence: `src/views/WeightView.test.ts`.

- **Helper puri in `src/lib/weight.ts`** (`weightSummary`, formattazione peso/data/variazione).
  - rationale: riepilogo e formattazione testabili senza DOM e riusabili dal grafico in TICKET-0020.
  - alternatives_rejected: logica nel componente (non testabile al seam puro).
  - evidence: `src/lib/weight.test.ts`.

- **Tab in basso Peso | Oggi | Profilo con icone `Scale`, `House`, `UserRound`**; route `/weight` aggiunta senza cambiare il default `/`.
  - rationale: rispetta ordine e atterraggio su Oggi; nessuna nuova dipendenza.
  - alternatives_rejected: riordinare le route per ottenere il default (il default dipende dal path `/`, non dall'ordine).
  - evidence: `src/components/BottomTabs.test.ts`, `src/router/index.ts`.

| I limiti di peso sono esportati da `lib/weight` e usati da worker e form | La review ha rilevato 30/300 duplicati in quattro punti; un'unica costante evita divergenze | Valori letterali nei form e nel messaggio del worker | `MIN_WEIGHT_KG`/`MAX_WEIGHT_KG` importati in `weights.ts` e `WeightView.vue` |
