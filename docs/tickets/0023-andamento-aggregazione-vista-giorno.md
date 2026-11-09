---
id: TICKET-0023
title: Andamento: aggregazione e vista Giorno
status: ready-for-agent
category: enhancement
blocked_by: []
blocks: [TICKET-0024]
source: docs/spec/0004-andamento-calorico.md
github: 23
---

## Brief (AGENT-BRIEF)
L'utente deve vedere l'andamento delle kcal degli ultimi 14 giorni dentro la pagina Diario, con la linea del target, e poter aprire un giorno toccando la sua barra.

Comportamento richiesto:
- Nuovo endpoint `GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` con aggregazione lato Worker: restituisce `{ targetKcal, days }`, dove `days` contiene `{ date, kcal, meals }` solo per i giorni con almeno un pasto non cancellato dell'utente, ordinati per data.
- `targetKcal` è il target attuale del profilo o `null`; `meals` è il numero di pasti non cancellati del giorno; `kcal` coincide con il totale del giorno mostrato dal Diario.
- Date non reali, `from > to` o intervallo oltre 800 giorni rispondono 400. La rotta richiede la credenziale e filtra per utente.
- In Diario, sotto il riepilogo del giorno, compare una sezione **Andamento** collassabile, aperta di default.
- La sezione mostra le ultime due settimane: 14 giorni che terminano oggi, una barra per ciascun giorno con pasti; i giorni senza pasti non hanno barra e i giorni futuri sono esclusi.
- La linea del target è disegnata con `targetKcal` ed è etichettata come target attuale; assente se `targetKcal` è null.
- Il riepilogo mostra la media delle kcal dei giorni con pasti, i giorni con pasti sui 14 giorni trascorsi e la variazione rispetto ai 14 giorni precedenti; la variazione compare solo se entrambi i periodi hanno almeno un giorno con pasti.
- Toccando una barra si seleziona quel giorno nel Diario e si aggiornano pasti e riepilogo.
- Ogni barra espone periodo, kcal e numero di pasti in modo accessibile (tooltip nativo o etichetta).
- Se il periodo non ha giorni con pasti, la sezione mostra uno stato vuoto invece del grafico.
- Grafico in SVG senza librerie, leggibile da telefono, con etichette X non sovrapposte.

Interfacce:
- Un unico intervallo per richiesta copre periodo corrente e precedente: da `today - 27` a `today`.
- La geometria e le medie vivono in una funzione pura testabile; il componente si limita a renderizzare i bucket.
- Nessuna migrazione: l'aggregazione legge pasti e voci esistenti.

Fuori scope:
- viste Settimana e Mese e selettore delle viste (TICKET-0024);
- memoria della vista;
- macro, attività, export, obiettivi peso;
- intervalli arbitrari o zoom.

## Acceptance criteria
- [ ] `GET /api/stats` restituisce target e giorni con pasti non cancellati, ordinati per data.
- [ ] Un giorno senza pasti non compare; un pasto cancellato non conta né nelle kcal né in `meals`.
- [ ] Per lo stesso giorno, `kcal` del trend coincide con il totale di `GET /api/days/:date`.
- [ ] Date non reali, `from > to` e intervalli oltre 800 giorni restituiscono 400.
- [ ] La rotta richiede la credenziale e non espone dati di altri utenti.
- [ ] In Diario compare la sezione Andamento, collassabile e aperta di default.
- [ ] La vista Giorno mostra al massimo 14 barre, una per giorno con pasti; i giorni vuoti non producono barre.
- [ ] La linea del target è presente ed etichettata come attuale; con target null non viene disegnata.
- [ ] Il riepilogo mostra media, giorni con pasti su 14 e variazione quando calcolabile.
- [ ] La variazione non compare se manca uno dei due periodi.
- [ ] Toccando una barra si apre quel giorno nel Diario.
- [ ] Ogni barra espone periodo, kcal e pasti in modo accessibile.
- [ ] Un periodo senza dati mostra lo stato vuoto.
- [ ] Il grafico è SVG e non introduce nuove dipendenze.
- [ ] Il client fa una sola richiesta per popolare la vista.

## Choices

- **Lettura dei pasti estratta in `mealsByDate(env, userId, from, to)`, condivisa da `GET /api/days/:date` e `GET /api/stats`**: entrambe le rotte sommano le stesse righe con `itemTotals`/`sumTotals` di `src/lib/diary.ts`.
  - rationale: il ticket chiede che `kcal` del trend coincida con `totals.kcal` del Diario; una query aggregata separata avrebbe introdotto una seconda verità su arrotondamenti e pasti cancellati.
  - alternatives_rejected: `SUM(mi.kcal_100g * mi.grams / 100)` in SQL per giorno (arrotondamento diverso e logica duplicata); endpoint che chiama `getDay` per ogni data (N richieste lato Worker).
  - evidence: `src/worker/meals.ts` (`mealsByDate`, `getDay`); test "reports a day kcal identical to the day view totals" in `src/worker/stats.test.ts`.

- **Intervallo `stats` inclusivo, massimo 800 giorni**: `to - from + 1 > 800` risponde 400; `from` e `to` sono obbligatori e devono essere date reali, `from > to` è rifiutato.
  - rationale: "intervallo oltre 800 giorni" letto come numero di giorni coperti dalla richiesta; il limite è solo una guardia, il client ne usa 28.
  - alternatives_rejected: limite sulla differenza `to - from` (800 date richieste sarebbero 801 giorni); default a "oggi" quando manca un parametro (nasconde errori del client).
  - evidence: test "accepts a range of 800 days and rejects one day more" e "rejects missing or unreal dates and a reversed range".

- **Modello del grafico in `src/lib/stats.ts` con `buildDayTrend(stats, today)`**: la finestra è sempre di 14 giorni che terminano `today`; le barre esistono solo per i giorni con pasti e sono posizionate sullo slot del giorno dentro i 14 (i giorni vuoti lasciano un vuoto, non vengono compattati).
  - rationale: mantiene la distanza temporale reale tra le barre e rispetta "giorni senza pasti: nessuna barra"; la funzione pura copre bucket, medie, variazione e geometria senza DOM.
  - alternatives_rejected: compattare le barre dei soli giorni pieni (le distanze mentirebbero); 28 slot nel grafico (il periodo precedente serve solo alla variazione).
  - evidence: `src/lib/stats.test.ts` (slot 5 e 9 su 14, `x = slot / 14`); test del componente "renders one bar per day with meals".

- **Variazione in percentuale, calcolata solo con pasti in entrambi i periodi**: media arrotondata all'intero e `changePercent` arrotondato; se il periodo precedente è vuoto il blocco "Variazione" non viene renderizzato.
  - rationale: la percentuale è confrontabile tra periodi con numero di giorni registrati diverso; il testo esplicita "rispetto ai 14 giorni precedenti".
  - alternatives_rejected: differenza in kcal assoluta (meno leggibile come direzione); mostrare "—" al posto della variazione (il ticket chiede che non compaia).
  - evidence: `src/lib/stats.ts` (`changePercent`); test "compares with the previous 14 days only when both periods have meals", "hides the change when the previous period has no meals".

- **Asse Y: massimo tra picco e target, con margine del 10% arrotondato al centinaio**; linea del target a `targetKcal / yMax` e etichetta "Target attuale N kcal"; nessuna linea se `targetKcal` è `null`.
  - rationale: la linea resta sempre dentro il grafico e leggibile anche quando il target è il valore più alto; numeri tondi sull'asse.
  - alternatives_rejected: scala fissa a 3000 kcal (illeggibile per diete basse); linea fuori scala quando il target supera tutte le barre.
  - evidence: test "scales bars and the target line on a readable axis", "keeps the target line above the tallest bar", "has no target line when the profile has no target".

- **Etichette X al massimo 5, scelte dall'ultima all'indietro con passo `ceil((slot - 1) / 4)`**: nessuna etichetta può avvicinarsi meno di uno step a quella successiva.
  - rationale: regola deterministica e testabile contro la sovrapposizione su telefono, senza misurare il testo.
  - alternatives_rejected: etichetta su ogni giorno (sovrapposte a 320 px); etichette solo su primo e ultimo (poco informative).
  - evidence: `axisLabelIndices` e test "spaces the labels of a 14-day window so they cannot overlap"; nel componente le etichette risultano `28/10`, `1/11`, `5/11`, `9/11`.

- **Componente `CalorieTrend` riceve `stats` e `today` già aggregati, si apre di default e comunica la selezione con `emit('select', date)`**: `HomeView` imposta `selectedDate`, il `watch` esistente ricarica il giorno.
  - rationale: il componente resta di sola resa e la navigazione riusa il flusso del Diario; nessuna libreria di grafici, solo SVG.
  - alternatives_rejected: calcolo del trend dentro `HomeView` (difficile da testare isolato); chiamata API dentro il componente (richiesta duplicata e stato duplicato).
  - evidence: `src/components/CalorieTrend.vue`, suo test "emits the day when a bar is clicked"; test HomeView "selects the day of a tapped bar and reloads the diary".

- **Una sola richiesta `stats` al mount per l'intervallo `today - 27 … today`, ricaricata dopo il salvataggio di un pasto**: la vista Giorno non cambia con il giorno selezionato.
  - rationale: "14 giorni che terminano oggi" e variazione con una richiesta; ricaricare dopo un pasto evita un trend stantio senza moltiplicare le chiamate.
  - alternatives_rejected: ricaricare a ogni cambio giorno (inutile: il trend non dipende dal giorno selezionato); una richiesta per giorno (escluso dal ticket).
  - evidence: test HomeView "loads the 28-day interval with one request and renders the day view" (from `2026-10-09` a `2026-11-05` con "oggi" al 5 novembre).
