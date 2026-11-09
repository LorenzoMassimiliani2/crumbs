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
