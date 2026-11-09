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
