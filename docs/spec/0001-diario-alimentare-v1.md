---
id: SPEC-0001
title: Diario alimentare v1 — pasti, alimenti e target calorico
status: approved
source: conversazione (grilling del 2026-11-05)
---

# Diario alimentare v1

## Problem Statement

Crumbs oggi è uno scheletro: autenticazione Google funzionante e una tabella `meals` con un solo elenco di pasti, senza alcun modo di registrare cosa si è mangiato né di sapere quante calorie si sono assunte. Chi tiene un diario alimentare deve poter annotare in pochi secondi, da mobile, un pasto composto da più alimenti con le loro quantità, e vedere subito l'effetto sul proprio target calorico giornaliero. Deve anche poter correggere i valori nutrizionali proposti dalle fonti esterne, perché nessun database è accurato per tutti i cibi.

## Solution

Una PWA mobile-first con tre viste: **Oggi**, **Profilo** e il flusso di **aggiunta pasto**.

- **Oggi** mostra il giorno selezionato: riepilogo in alto (kcal consumate, target, scostamento; proteine, carboidrati, grassi in grammi e percentuale delle kcal) e i pasti in ordine cronologico con le rispettive voci. Frecce e calendario per cambiare giorno.
- **Aggiungi pasto** propone il tipo di pasto in base all'ora, permette di cercare alimenti (prima nei preferiti, poi su Open Food Facts per i prodotti confezionati e su USDA FoodData Central per i generici), inserire i grammi e salvare il pasto in modo atomico.
- **Profilo** contiene peso, altezza, sesso e data di nascita (con BMR e BMI mostrati come informazione), il target kcal impostato a mano e le note di attribuzione delle fonti.

Ogni alimento inserito diventa automaticamente un **preferito** riutilizzabile, con nome e valori per 100 g modificabili. Le voci dei pasti conservano uno snapshot dei valori al momento del salvataggio: correggere un preferito o ricevere dati aggiornati dalle API non altera i pasti già registrati.

I dati sono esportabili in un file `.xlsx` generato nel browser, con un foglio per le voci dei pasti e uno per i totali giornalieri.

Lo schema è già multi-utente (`user_id` su ogni tabella), ma l'accesso resta limitato dall'allowlist a una sola email.

## User Stories

1. Come proprietario, voglio accedere con Google, così che i miei dati siano visibili solo a me.
2. Come proprietario, voglio che il mio profilo contenga peso, altezza, sesso e data di nascita, così che l'app possa mostrarmi BMR e BMI informativi.
3. Come proprietario, voglio vedere il BMR calcolato con Mifflin-St Jeor, così da avere un riferimento quando scelgo il target.
4. Come proprietario, voglio vedere il BMI calcolato da peso e altezza, così da sapere dove sono.
5. Come proprietario, voglio impostare a mano il mio target kcal, così che il diario confronti il consumo con un obiettivo che decido io.
6. Come proprietario, voglio vedere kcal consumate, target e scostamento del giorno, così da sapere se sono sopra o sotto.
7. Come proprietario, voglio vedere proteine, carboidrati e grassi consumati in grammi e in percentuale delle kcal, così da capire la composizione della giornata senza target di macro.
8. Come proprietario, voglio aprire di default il giorno corrente, così da registrare subito quello che mangio.
9. Come proprietario, voglio passare al giorno precedente o successivo con due frecce, così da correggere un pasto dimenticato.
10. Come proprietario, voglio scegliere una data da un calendario, così da saltare a un giorno lontano.
11. Come proprietario, voglio che il tipo di pasto sia proposto dall'ora della registrazione (colazione, merenda mattina, pranzo, merenda pomeriggio, cena, post-cena), così da non doverlo scegliere ogni volta.
12. Come proprietario, voglio poter cambiare il tipo proposto, così da correggere una registrazione fatta in ritardo.
13. Come proprietario, voglio aggiungere più alimenti allo stesso pasto, così da registrare un piatto composto.
14. Come proprietario, voglio inserire la quantità di ogni alimento in grammi, così da avere valori coerenti con le fonti per 100 g.
15. Come proprietario, voglio vedere kcal e macro di ogni voce mentre compongo il pasto, così da capire il totale prima di salvare.
16. Come proprietario, voglio salvare il pasto in un colpo solo, così da non lasciare pasti a metà se chiudo l'app.
17. Come proprietario, voglio aggiungere una nota libera al pasto, così da annotare contesto che i numeri non catturano.
18. Come proprietario, voglio modificare un pasto passato (grammi, alimenti aggiunti o rimossi, tipo, nota), così da correggere gli errori.
19. Come proprietario, voglio cancellare un pasto, così da rimuovere una registrazione sbagliata senza perdere lo storico in modo irreversibile.
20. Come proprietario, voglio che i pasti cancellati spariscano dal diario e dall'export, così da non contare dati errati.
21. Come proprietario, voglio che i valori nutrizionali di un pasto salvato non cambino quando aggiorno un preferito, così che lo storico resti veritiero.
22. Come proprietario, voglio cercare tra i miei preferiti mentre digito, così da trovare in un attimo i cibi che mangio spesso.
23. Come proprietario, voglio che i preferiti siano ordinati per ultimo utilizzo, così che i più frequenti stiano in cima.
24. Come proprietario, voglio avviare una ricerca esterna con invio o dopo una breve pausa, così da non consumare il limite di richieste dell'API.
25. Come proprietario, voglio vedere i risultati divisi in "Prodotti confezionati" (Open Food Facts) e "Alimenti generici" (USDA), così da distinguere una marca da un alimento di base.
26. Come proprietario, voglio scegliere un prodotto confezionato e vederne marca e quantità, così da riconoscere quello giusto.
27. Come proprietario, voglio cercare un alimento generico in italiano (es. "mela") e ottenere il corrispondente USDA, così da non dover cercare in inglese.
28. Come proprietario, voglio vedere la fonte di ogni alimento, così da sapere quanto fidarmi dei valori.
29. Come proprietario, voglio che ogni alimento inserito venga salvato automaticamente nei preferiti, così da riusarlo senza ricerche.
30. Come proprietario, voglio modificare nome e valori per 100 g di un preferito, così da correggere dati sbagliati o tradurre un nome inglese.
31. Come proprietario, voglio che la modifica di un preferito valga per gli usi futuri e non per i pasti passati, così da non riscrivere la storia.
32. Come proprietario, voglio eliminare un preferito senza intaccare i pasti che lo usano, così da fare pulizia.
33. Come proprietario, voglio creare un alimento a mano (nome e valori per 100 g) quando le API non lo trovano, così da registrare piatti casalinghi e prodotti locali.
34. Come proprietario, voglio esportare i dati in `.xlsx` scegliendo un intervallo di date, così da analizzarli in un foglio di calcolo o condividerli.
35. Come proprietario, voglio che l'export contenga una riga per alimento e un foglio con i totali giornalieri e lo scostamento dal target, così da avere sia il dettaglio sia il riepilogo.
36. Come proprietario, voglio un messaggio chiaro quando una fonte esterna è temporaneamente non disponibile, così da sapere se riprovare o inserire a mano.
37. Come proprietario, voglio che l'app resti utilizzabile con Open Food Facts e inserimento manuale se la chiave USDA non è configurata, così da non restare bloccato.
38. Come proprietario, voglio vedere le note di licenza e attribuzione delle fonti, così da rispettare ODbL e CC0.
39. Come sviluppatore, voglio che ogni tabella e ogni query siano legati a `user_id`, così che aggiungere un secondo utente non richieda una migrazione.
40. Come proprietario, voglio che le scritture richiedano una connessione, così da non gestire code offline in questa versione.

## Acceptance Criteria

### Profilo e target

- [ ] `GET /api/profile` restituisce peso, altezza, sesso, data di nascita e target kcal dell'utente autenticato; `PUT /api/profile` li aggiorna.
- [ ] Il BMR è calcolato con Mifflin-St Jeor e verificato su un caso noto con valori letterali indipendenti.
- [ ] Il BMI è calcolato da peso e altezza e mostrato come informazione, mai usato per il target.
- [ ] Il target kcal è un valore unico nel profilo; cambiarlo ricalcola gli scostamenti dei giorni passati (comportamento accettato).
- [ ] Il primo accesso autenticato crea o aggiorna la riga `users` usando il `sub` Google come chiave.

### Pasti e voci

- [ ] `POST /api/meals` crea pasto e voci in modo atomico: se una voce non è valida, non viene scritto nulla.
- [ ] Un pasto con 150 g di un alimento da 356 kcal/100 g, 12 g proteine, 70 g carboidrati e 1,5 g grassi produce 534 kcal, 18 g proteine, 105 g carboidrati e 2,25 g grassi.
- [ ] `GET /api/days/:date` restituisce i pasti non cancellati del giorno con voci e totali, ordinati cronologicamente.
- [ ] Il tipo di pasto proposto rispetta le finestre: 05:00–10:30 colazione, 10:30–12:00 merenda mattina, 12:00–15:00 pranzo, 15:00–18:00 merenda pomeriggio, 18:00–22:00 cena, 22:00–05:00 post-cena; il tipo salvato è sempre quello scelto dall'utente.
- [ ] `occurred_at` è memorizzato in UTC e `local_date` è la data locale del dispositivo al momento del salvataggio.
- [ ] `PUT /api/meals/:id` sostituisce le voci del pasto e ricalcola i totali dai valori per 100 g salvati, senza chiamare le API.
- [ ] `DELETE /api/meals/:id` imposta `deleted_at`; il pasto non compare più in `GET /api/days/:date` né nell'export.
- [ ] Modificare i valori di un preferito non cambia i valori delle voci di pasto già salvate.

### Preferiti e ricerca

- [ ] `GET /api/foods` restituisce i preferiti dell'utente, ordinati per `last_used_at` decrescente.
- [ ] Ogni alimento inserito in un pasto viene salvato in `foods` come preferito, con deduplica per `(user_id, source, source_id)` e, in assenza di `source_id`, per nome normalizzato.
- [ ] `PATCH /api/foods/:id` aggiorna nome e valori per 100 g; `DELETE /api/foods/:id` elimina il preferito e le voci di pasto conservano lo snapshot con `food_id = NULL`.
- [ ] `POST /api/foods` crea un alimento manuale con `source = 'manual'`.
- [ ] La ricerca esterna parte solo con almeno 3 caratteri, su invio o dopo una pausa; non a ogni tasto.
- [ ] `GET /api/foods/search?q=` interroga Open Food Facts e USDA in parallelo e restituisce due gruppi separati, mai fusi.
- [ ] I risultati mostrano solo alimenti con kcal presente, al massimo 10 per fonte.
- [ ] La ricerca USDA usa la mappa italiano→inglese; se la voce manca, la query italiana viene passata così com'è e, se non produce risultati utili, resta la creazione manuale.
- [ ] Senza `USDA_API_KEY` il gruppo "Alimenti generici" è disabilitato con un messaggio esplicito; Open Food Facts e la creazione manuale restano funzionanti.
- [ ] Su 429 o 503 di Open Food Facts viene servita la cache D1 scaduta se presente, altrimenti un messaggio "riprova"; nessun retry aggressivo.
- [ ] Le risposte delle API esterne sono trimmate ai soli campi usati prima di essere salvate in `api_cache`; la cache delle query scade dopo 7 giorni, quella di prodotti e alimenti dopo 30.
- [ ] Ogni alimento espone `source` e la relativa attribuzione: "Dati da Open Food Facts (ODbL)" o "Fonte: USDA FoodData Central (CC0)".

### Oggi e interfaccia

- [ ] La vista Oggi apre il giorno corrente e mostra riepilogo, pasti e voci; le frecce e il calendario cambiano giorno.
- [ ] Il flusso di aggiunta pasto compone una bozza locale e la salva con una sola richiesta.
- [ ] Il riepilogo mostra kcal consumate, target, scostamento e macro in grammi e percentuale delle kcal, senza barre con target di macro.
- [ ] La navigazione mobile usa tab in basso per Oggi e Profilo.
- [ ] Le viste sono utilizzabili su larghezza mobile senza scorrimento orizzontale.

### Export

- [ ] L'export è un `.xlsx` generato nel browser, con intervallo di date selezionabile e default al mese corrente.
- [ ] Il foglio "pasti" contiene una riga per voce: data, tipo pasto, alimento, grammi, kcal, proteine, carboidrati, grassi, fibre, zuccheri, sale, fonte.
- [ ] Il foglio "giorni" contiene una riga per giorno: kcal totali, target corrente, scostamento, totali macro.
- [ ] I pasti cancellati sono esclusi e le date usano il fuso locale.

### Trasversali

- [ ] Tutte le rotte `/api/*` tranne `/api/health` richiedono `Authorization: Bearer` e restituiscono 401 senza credenziale valida.
- [ ] Ogni riga di `profiles`, `foods`, `meals` e `api_cache` è riconducibile a un utente (o è cache di query senza dati personali) e ogni query filtra per l'utente autenticato.
- [ ] La migrazione elimina la vecchia tabella `meals` (vuota) e crea le nuove tabelle; `npm run db:migrate:local` la applica senza errori.
- [ ] `npm test` e `npm run type-check` passano.

## Non obiettivi (v1)

- Statistiche, grafici e andamento settimanale o mensile.
- Storico del peso e delle misure corporee.
- Barcode e scanner con fotocamera.
- Scritture offline e sincronizzazione.
- Notifiche e promemoria.
- Target di macro e storico dei target.
- Multi-utente attivo (solo schema pronto; l'allowlist resta a una email).
- Stima automatica dei valori da foto o testo con modelli AI.
- Fusione dei valori tra fonti diverse: un alimento appartiene a una sola fonte.

## Dati e API

### Tabelle D1

```
users          id (= sub Google), email, name, picture, created_at
profiles       user_id, height_cm, sex, birth_date, weight_kg, weight_updated_at,
               target_kcal, updated_at
foods          id, user_id, name, brand, barcode, source, source_id,
               kcal_100g (obbligatoria), protein_100g, carbs_100g, fat_100g,
               fiber_100g, sugar_100g, salt_100g (nullable: ignoto ≠ 0),
               serving_g, serving_label, last_used_at, created_at, updated_at
meals          id, user_id, occurred_at (UTC), local_date, meal_type, note,
               created_at, updated_at, deleted_at
meal_items     id, meal_id, food_id (nullable), name_snapshot, source, brand, source_id,
               kcal_100g (obbligatoria), protein_100g, carbs_100g, fat_100g,
               fiber_100g, sugar_100g, salt_100g (nullable: ignoto ≠ 0),
               grams, position
api_cache      key, source, payload, fetched_at
```

Unicità: `foods` su `(user_id, source, source_id)` quando `source_id` non è nullo, altrimenti su `(user_id, nome normalizzato)`. `meal_items.food_id` diventa `NULL` alla cancellazione del preferito; valori nutrizionali, `source`, `brand` e `source_id` restano nello snapshot, così la voce resta leggibile.

Un nutriente non disponibile nella fonte è `NULL`, mai `0`: uno zero è valido solo se la fonte lo dichiara. I totali trattano `NULL` come zero.

Il token statico di servizio non ha identità Google: viene risolto all'utente con email `ALLOWED_EMAIL`; se la riga non esiste, le rotte rispondono 403 e serve un primo login Google.

### Rotte API

| Metodo | Rotta | Scopo |
|---|---|---|
| GET | `/api/health` | esistente, pubblica |
| GET | `/api/me` | esistente |
| GET/PUT | `/api/profile` | profilo e target |
| GET | `/api/days/:date` | pasti, voci e totali del giorno |
| POST | `/api/meals` | crea pasto con voci |
| PUT | `/api/meals/:id` | sostituisce le voci del pasto |
| DELETE | `/api/meals/:id` | soft delete |
| GET | `/api/foods` | preferiti |
| POST | `/api/foods` | alimento manuale |
| PATCH/DELETE | `/api/foods/:id` | modifica o elimina preferito |
| GET | `/api/foods/search?q=` | ricerca esterna raggruppata |
| GET | `/api/foods/off/:code` | prodotto Open Food Facts normalizzato |
| GET | `/api/export?from=&to=` | righe voci e totali giornalieri per l'export |

Il file `.xlsx` è generato lato client; il Worker espone solo i dati JSON dell'intervallo.

### Costanti e configurazione

- Finestre dei tipi pasto in un unico file di costanti, come elencato negli acceptance criteria.
- Open Food Facts: `fields` espliciti, User-Agent `Crumbs/0.1 (<ALLOWED_EMAIL>)`, ricerca min 3 caratteri, cache query 7 giorni, prodotti 30.
- USDA: `USDA_API_KEY` come secret; senza secret il gruppo generici è disabilitato.
- Mappa italiano→inglese in `src/worker/usda-aliases.ts`, circa 150 voci sui cibi ricorrenti, revisionabile.
- Dipendenza client per `.xlsx`: SheetJS (`xlsx`).

## Seams

- **Seam più alto (primario):** handler HTTP del Worker (`fetch`) invocato con `Request` reali e D1 reale, con le migrazioni applicate al DB di test. Implementato con il fallback SQLite in memoria dietro l'interfaccia `D1Database`, perché `@cloudflare/vitest-pool-workers` non supporta la versione di Vitest installata. Le API esterne (Open Food Facts, USDA) sono mockate solo al confine di rete (`fetchMock`), con fixture registrate. Le asserzioni leggono le risposte HTTP e le righe restituite dalle stesse rotte, mai lo stato interno.
- **Seam frontend (nuovo):** test a livello di vista con Vue Test Utils e happy-dom, con la rete mockata al confine (`fetch`/`apiFetch`): coprono il flusso aggiunta pasto, il riepilogo del giorno e il salvataggio del profilo. Nessuna asserzione su componenti interni o store.
- **Seam invariati:** `verifyGoogleIdToken` e la gestione della credenziale restano testati come oggi. Nessun nuovo seam interno per repository o adapter: la logica passa dalle rotte HTTP.
- **Fallback tecnico:** se `@cloudflare/vitest-pool-workers` non è compatibile con la versione di Vitest installata, lo stesso seam HTTP viene testato con D1 SQLite in memoria dietro l'interfaccia `D1Database`, senza cambiare i test.

## Prototipo

Il prototipo usa-e-getta è in `prototype/` (entry Vite separato, fuori dalla build di produzione) e si apre con `npm run prototype`. Tre varianti switchabili con `?variant=`; la variante scelta è **A · Diario classico**, con due innesti dalle altre: ora accanto al titolo di ogni pasto e bozza sempre visibile durante l'aggiunta. Il prototipo non è codice di produzione: la variante scelta va reimplementata nei ticket.
