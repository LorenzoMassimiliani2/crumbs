---
id: FEAT-0002
title: Peso e andamento
status: verifying
branch: feat/peso
worktree: .worktrees/0002
batch: 1
depends_on: []
touches:
  - migrations/
  - src/worker/weights.ts
  - src/worker/index.ts
  - src/worker/profile.ts
  - src/lib/weight.ts
  - src/views/WeightView.vue
  - src/views/ProfileView.vue
  - src/components/BottomTabs.vue
  - src/router/index.ts
created_by: 01a1bf54-6f3a-7575-ba0d-9e4237b8cbce
created: 2026-11-09
---

## Brief

### Obiettivo

Registrare le misure di peso nel tempo e vederne l'andamento in un grafico. Il peso esce dal Profilo e diventa una sezione dedicata, raggiungibile da una nuova tab in basso.

La feature comprende:

- una nuova tab **Peso** nella barra in basso, con ordine **Peso | Oggi | Profilo** e **Oggi** selezionata all'apertura;
- una sezione **Peso** con peso corrente, data dell'ultima misura, variazione rispetto alla misura precedente, grafico dell'andamento, form rapido e lista delle ultime misure;
- una misura per data: inserire di nuovo la stessa data la aggiorna;
- il peso corrente del profilo allineato automaticamente all'ultima misura;
- il campo peso rimosso dal form Profilo e dal contratto `PUT /api/profile`;
- BMR e BMI restano nel Profilo e usano il peso corrente.

### Comportamento richiesto

- La barra in basso mostra tre tab: **Peso** (`/weight`), **Oggi** (`/`) e **Profilo** (`/profile`). All'apertura è attiva **Oggi**.
- La tab Peso mostra:
  - peso corrente (ultima misura) o stato vuoto se non ci sono misure;
  - data dell'ultima misura e variazione rispetto alla misura precedente;
  - grafico a linea con punti, disegnato in SVG senza librerie esterne;
  - selettore del periodo: 30, 90, 365 giorni oppure tutto, con default 90 giorni;
  - asse Y con margine automatico attorno ai valori del periodo;
  - form rapido: data (default oggi) e peso in kg con un decimale, tra 30 e 300;
  - lista compatta delle ultime 10 misure con modifica ed eliminazione.
- Una sola misura per data: salvare una data già presente aggiorna il valore invece di crearne una seconda.
- La modifica di una misura può cambiare data e peso; se la nuova data esiste già, la UI chiede conferma prima di sovrascrivere.
- L'eliminazione chiede conferma ed è definitiva: la misura sparisce da grafico, lista e calcoli.
- Al primo accesso alla tab Peso, se il registro è vuoto e il profilo ha un peso, viene creata una misura di oggi con quel peso. Se il profilo non ha peso, il registro resta vuoto.
- `profiles.weight_kg` resta la cache del peso corrente: viene aggiornato all'ultima misura disponibile dopo inserimento, modifica o eliminazione. Se non restano misure, resta l'ultimo valore noto.
- Il Profilo non ha più il campo peso. Mostra BMR e BMI calcolati sul peso corrente.
- `PUT /api/profile` accetta altezza, sesso, data di nascita e target kcal; se il payload contiene `weight`, risponde 400 spiegando che il peso si registra nella sezione Peso.
- `GET /api/profile` continua a restituire il peso corrente.
- L'export `.xlsx` resta invariato: nessun foglio Peso in questa versione.

### Fuori scope

- misure corporee diverse dal peso (vita, fianchi, massa grassa, foto);
- obiettivo peso o linea di target nel grafico;
- più misure nello stesso giorno;
- foglio Peso nell'export;
- notifiche o promemoria per pesarsi;
- import da bilancia o API esterne;
- sincronizzazione offline;
- modifiche al target kcal o al diario pasti/attività.

### Criteri di accettazione (alto livello)

- [ ] La barra in basso mostra Peso, Oggi e Profilo; l'apertura porta su Oggi.
- [ ] La tab Peso mostra peso corrente, data, variazione, grafico, selettore periodo, form e lista.
- [ ] Inserire una misura nuova la aggiunge; inserire una data esistente aggiorna quella misura senza duplicati.
- [ ] Il grafico usa solo misure del periodo scelto e ha un asse Y leggibile con margine automatico.
- [ ] Modifica ed eliminazione funzionano con conferma; l'eliminazione è definitiva.
- [ ] Il peso corrente del profilo segue l'ultima misura; senza misure resta l'ultimo valore noto.
- [ ] La prima apertura con profilo compilato e registro vuoto crea la misura di oggi.
- [ ] Il form Profilo non ha più il campo peso; BMR e BMI restano visibili e usano il peso corrente.
- [ ] `PUT /api/profile` senza peso funziona; con `weight` risponde 400.
- [ ] L'export `.xlsx` è invariato.
- [ ] Tutte le nuove rotte richiedono la credenziale esistente e filtrano per `user_id`.

### Dati e API (proposta, da confermare in spec)

- Nuova tabella `weight_entries`: `id`, `user_id`, `measured_on` (`YYYY-MM-DD`), `weight_kg`, `created_at`, `updated_at`; unicità su (`user_id`, `measured_on`).
- `GET /api/weights` — misure dell'utente ordinate per data.
- `PUT /api/weights/:date` — crea o aggiorna la misura della data con `{weight}`.
- `DELETE /api/weights/:date` — elimina la misura della data.
- `PUT /api/profile` — rimosso `weight` dal contratto; `GET /api/profile` invariato.
- La cache `profiles.weight_kg` viene aggiornata nelle scritture delle misure.

### Strategia di esecuzione

- Seriale, un solo batch, un branch `feat/peso`.
- Esecuzione manuale salvo passaggio esplicito a `orchestrator`.

## Sub-spec / tickets

Spec e ticket generati da questo brief. Prossimo passo: `implement-spec` (manuale) oppure passaggio a `orchestrator`.

- spec: docs/spec/0003-peso-andamento.md
- tickets:
  - TICKET-0019 — Tab Peso e registrazione delle misure (`docs/tickets/0019-tab-peso-registrazione-misure.md`, #19)
  - TICKET-0020 — Grafico dell'andamento del peso (`docs/tickets/0020-grafico-andamento-peso.md`, #20)
  - TICKET-0021 — Modificare ed eliminare una misura di peso (`docs/tickets/0021-modificare-eliminare-misura-peso.md`, #21)
  - TICKET-0022 — Profilo senza campo peso (`docs/tickets/0022-profilo-senza-peso.md`, #22)

## Note di merge (compilate da orchestrator)

- risultato merge su `orchestrator/integrate`: non-eseguito
- note conflitto (se stop umano): —

## Implementazione

- Ticket 0019–0022 implementati e verificati sul branch `feat/peso`.
- Review standards + spec eseguita; finding corretti in `9698f96`.
- Merge su `main`: user-owned, in attesa.
