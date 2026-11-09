---
id: TICKET-0022
title: Profilo senza campo peso
status: ready-for-agent
category: enhancement
blocked_by: []
blocks: []
source: docs/spec/0003-peso-andamento.md
github: 22
---

## Brief (AGENT-BRIEF)
Il peso deve essere scritto solo dalla tab Peso. Il Profilo non deve più offrire un campo peso, ma deve continuare a mostrare BMR e BMI sul peso corrente.

Comportamento richiesto:
- Il form Profilo non contiene più il campo peso e il salvataggio non invia `weight`.
- `PUT /api/profile` accetta altezza, sesso, data di nascita e target kcal; se il payload contiene `weight`, risponde 400 con un messaggio che rimanda alla sezione Peso.
- `GET /api/profile` continua a restituire `weight` come peso corrente, così BMR e BMI restano calcolabili.
- BMR e BMI restano nella tab Profilo e usano il peso corrente.
- Con profilo senza peso e registro vuoto, BMR e BMI non mostrano valori inventati.
- Le altezze, il sesso, la data di nascita e il target continuano a funzionare come prima.

Interfacce:
- Il contratto di scrittura del profilo non include più `weight`.
- Il contratto di lettura resta invariato.

Fuori scope:
- spostare BMR o BMI nella tab Peso;
- modificare le formule di BMR/BMI;
- cambiare la validazione degli altri campi;
- export.

## Acceptance criteria
- [ ] Il form Profilo non ha più il campo peso.
- [ ] Salvare il profilo senza `weight` funziona e restituisce i valori aggiornati.
- [ ] `PUT /api/profile` con `weight` nel payload risponde 400 con un messaggio comprensibile.
- [ ] `GET /api/profile` restituisce ancora `weight`.
- [ ] BMR e BMI restano visibili nel Profilo e usano il peso corrente.
- [ ] Con peso assente, BMR e BMI non mostrano valori inventati.
- [ ] Altezza, sesso, data di nascita e target si salvano e validano come prima.

## Choices
- **Migrazione `0006_profiles_weight_nullable.sql` che ricostruisce `profiles` rendendo `weight_kg` nullable**: SQLite non permette di rimuovere `NOT NULL` sul posto, quindi la tabella viene copiata in `profiles_new`, poi sostituita.
  - rationale: un profilo può nascere senza peso (`PUT /api/profile` senza `weight`), e la colonna non può restare `NOT NULL` senza inventare un valore; il peso ora è una cache scritta dalle misure, non un campo obbligatorio del profilo.
  - alternatives_rejected: usare un valore sentinella (es. `0`) e tradurlo in `null` in lettura (dato inventato nel database); non creare la riga profilo finché manca il peso (perdita di altezza, sesso, nascita e target); aggiungere una seconda colonna nullable (doppia fonte di verità).
  - evidence: `migrations/0006_profiles_weight_nullable.sql`; test "round-trips the profile through PUT and GET" (profilo nuovo senza riga e senza peso).

- **`PUT /api/profile` rifiuta la sola presenza della chiave `weight`** (`'weight' in input`) con 400 e messaggio "Il peso si registra nella sezione Peso, non nel profilo."
  - rationale: il contratto di scrittura non include più il peso; un `weight: null` è comunque una scrittura esplicita da rifiutare, non un campo assente.
  - alternatives_rejected: ignorare silenziosamente `weight` (nasconde un client vecchio e viola il "400 se il payload contiene weight"); validare il valore 30-300 (accetterebbe una scrittura che non deve più esistere).
  - evidence: `parseProfile` in `src/worker/profile.ts`; test "rejects a profile payload that still carries the weight".

- **`saveProfile` non tocca `weight_kg` né `weight_updated_at` e risponde rileggendo il profilo completo**: l'`INSERT ... ON CONFLICT` aggiorna solo altezza, sesso, nascita e target; la risposta passa da `readProfile`.
  - rationale: `weight_kg` è cache delle misure, quindi l'aggiornamento del profilo non deve sovrascriverla; restituire il profilo completo permette al client di mantenere BMR e BMI aggiornati subito dopo il salvataggio.
  - alternatives_rejected: restituire solo i valori scritti (il client perderebbe il peso corrente per BMR/BMI); includere `weight_kg` nell'update con il valore letto (race con una misura registrata nel frattempo).
  - evidence: `src/worker/index.ts` (`saveProfile`); test "round-trips the profile through PUT and GET" e "returns the current weight after a profile save" implicito nel `GET`.

- **`profileFromRow` restituisce `ProfileResponse` (`ProfileValues` + `weight`), separato da `ProfileValues` di scrittura**.
  - rationale: il contratto di lettura resta invariato e include il peso corrente, mentre il contratto di scrittura non lo contiene; il tipo rende esplicita la differenza.
  - alternatives_rejected: un unico tipo con `weight` opzionale (perde il controllo sul payload di scrittura).
  - evidence: `src/worker/profile.ts` (`ProfileResponse`); `src/views/ProfileView.vue` (`ProfileResponse` locale con `weight`).

- **La vista Profilo tiene il peso in `currentWeight` separato dal form**: il campo non è renderizzato, ma `currentWeight` alimenta BMR e BMI.
  - rationale: il peso serve ai calcoli ma non è più modificabile dal Profilo; tenerlo fuori dal `form` impedisce per costruzione che finisca nel payload di salvataggio.
  - alternatives_rejected: lasciare `weight` nel `form` come campo nascosto (facile reintrodurlo nel payload o nella UI).
  - evidence: `src/views/ProfileView.vue`; test "loads the saved profile and shows BMR and BMI as information", "saves the profile and shows feedback".

- **Con peso assente i valori mostrati sono `—`**: `currentWeight` resta `null` e i `computed` di BMR/BMI restituiscono `null`.
  - rationale: nessun valore inventato quando il registro è vuoto e il profilo non ha peso.
  - alternatives_rejected: mostrare 0 o un peso di default.
  - evidence: test "shows no BMR or BMI values when the current weight is missing".

- **`seedFromProfile` ignora un profilo con `weight_kg` null**: la semina non inserisce una misura senza peso.
  - rationale: la misura di partenza esiste solo se c'è un peso noto; con la colonna ora nullable il guard `if (!profile)` non bastava più.
  - alternatives_rejected: inserire `NULL` in `weight_entries.weight_kg` (la colonna è `NOT NULL`).
  - evidence: `src/worker/weights.ts` (`seedFromProfile`); test "returns an empty log when there is no profile weight to seed".

- **I test che preparavano il profilo via `PUT` con `weight` ora scrivono direttamente la riga `profiles`** (o omettono `weight` quando il peso non è necessario).
  - rationale: `PUT /api/profile` rifiuta `weight` per contratto; il seeding dei test deve usare la cache come farebbe una misura.
  - alternatives_rejected: lasciare i test rossi; indebolire la validazione lato server per compatibilità.
  - evidence: `seedProfile` in `src/worker/weights.test.ts`; corpi profilo aggiornati in `src/worker/activities.test.ts` e `src/worker/meals.test.ts`.

| La creazione del profilo inizializza `weight_kg` dall'ultima misura disponibile; gli aggiornamenti successivi non lo toccano | Corregge il finding della review: se la prima misura precede la riga profilo, l'UPDATE della cache toccava zero righe e il peso restava nullo | Aggiornare il peso a ogni salvataggio del profilo; lasciare il profilo senza peso finché non arriva una misura | `saveProfile` (subquery sull'ultima `measured_on` solo nell'INSERT); test "fills the profile weight when the profile is created after a measurement" |
