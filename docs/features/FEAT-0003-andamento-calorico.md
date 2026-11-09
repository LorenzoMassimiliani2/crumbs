---
id: FEAT-0003
title: Andamento calorico nel Diario
status: approved
branch: feat/andamento
worktree: .worktrees/0003
batch: 1
depends_on: []
touches:
  - src/worker/stats.ts
  - src/worker/index.ts
  - src/lib/stats.ts
  - src/views/HomeView.vue
  - src/components/DailyTrendChart.vue
created_by: 01a1bf54-6f3a-7575-ba0d-9e4237b8cbce
created: 2026-11-09
---

## Brief

### Obiettivo

Vedere l'andamento calorico nella pagina Diario, non solo il giorno selezionato. Una sezione **Andamento** collassabile mostra barre delle kcal con la linea del target, in tre viste: Giorno, Settimana e Mese.

La feature comprende:

- sezione Andamento dentro Diario, sotto il riepilogo del giorno, aperta di default;
- selettore **Giorno / Settimana / Mese**, con la scelta ricordata nella sessione;
- vista Giorno: ultimi 14 giorni, una barra per giorno;
- vista Settimana: ultime 8 settimane, una barra per settimana con la media giornaliera;
- vista Mese: ultimi 12 mesi, una barra per mese con la media giornaliera;
- linea orizzontale del target attuale;
- riepilogo testuale con media del periodo, giorni registrati sul totale e variazione rispetto al periodo precedente quando entrambi hanno dati;
- tocco su una barra della vista Giorno che seleziona quel giorno nel Diario;
- tooltip su ogni barra con periodo, media e giorni registrati.

### Comportamento richiesto

- La sezione Andamento è chiusa/apribile e si apre di default sulla vista Giorno.
- La scelta Giorno/Settimana/Mese è ricordata per la sessione corrente; non viene salvata sul database.
- **Giorno**: 14 giorni che terminano oggi. Una barra per giorno; i giorni senza pasti non hanno barra. Il tocco seleziona quel giorno nel Diario.
- **Settimana**: 8 settimane che terminano con quella corrente, settimane da lunedì a domenica. Ogni barra è la media delle kcal giornaliere dei giorni con pasti della settimana. La settimana corrente usa solo i giorni fino a oggi.
- **Mese**: 12 mesi che terminano con quello corrente. Ogni barra è la media delle kcal giornaliere dei giorni con pasti del mese.
- Giorni futuri esclusi. I giorni senza pasti non valgono zero: non entrano nella media e non producono barra.
- Il riepilogo mostra: media del periodo, giorni con pasti sul numero di giorni trascorsi nel periodo, target attuale. La variazione rispetto al periodo precedente compare solo se entrambi i periodi hanno almeno un giorno con pasti.
- Il target è quello attuale e viene mostrato come tale: non esiste uno storico dei cambi di target.
- Grafico in SVG senza librerie, con barre, linea del target, etichette leggibili da telefono e tooltip nativo accessibile.
- Con nessun dato nel periodo, la sezione mostra uno stato vuoto comprensibile.
- L'endpoint di aggregazione è unico per intervallo: una sola richiesta per popolare la vista attiva. Nessuna richiesta per singolo giorno.

### Fuori scope

- macro, attività fisica o altri nutrienti nel grafico;
- storico dei target kcal;
- confronto tra utenti;
- esportazione dei trend;
- zoom, pan o filtri arbitrari di intervallo;
- nuove librerie di charting;
- modifiche al diario dei pasti o delle attività.

### Criteri di accettazione (alto livello)

- [ ] La sezione Andamento è visibile in Diario, collassabile e aperta di default su Giorno.
- [ ] Le viste Giorno, Settimana e Mese mostrano rispettivamente 14 giorni, 8 settimane e 12 mesi secondo le definizioni concordate.
- [ ] Le barre di settimana e mese usano la media giornaliera dei giorni con pasti, non il totale.
- [ ] I giorni senza pasti non producono barre e non entrano nella media; i giorni futuri sono esclusi.
- [ ] La linea del target è quella attuale ed è etichettata come tale.
- [ ] Il riepilogo mostra media, giorni registrati sul totale e variazione quando calcolabile.
- [ ] Il tocco su una barra della vista Giorno seleziona quel giorno nel Diario.
- [ ] Ogni barra espone periodo, media e giorni registrati in modo accessibile.
- [ ] Il cambio vista è ricordato durante la sessione.
- [ ] Un periodo senza dati mostra uno stato vuoto.
- [ ] Il grafico è SVG senza nuove dipendenze.
- [ ] Tutte le nuove rotte richiedono la credenziale esistente e filtrano per `user_id`.

### Dati e API (proposta, da confermare in spec)

- `GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` restituisce `{ days: [{ date, kcal, meals }] }` con una voce per ogni giorno che ha almeno un pasto non cancellato; `meals` è il numero di pasti del giorno.
- Validazione: date reali, `from <= to`, intervallo massimo di 800 giorni (copre 12 mesi correnti più 12 precedenti per il confronto).
- Aggregazione SQL lato Worker, filtrata per `user_id`, esclusi i pasti cancellati.
- Il client raggruppa i giorni in settimane e mesi e calcola medie, conteggi e variazione.
- Nessuna nuova tabella e nessuna migrazione.

### Strategia di esecuzione

- Seriale, un solo batch, un branch `feat/andamento`.
- Esecuzione manuale salvo passaggio esplicito a `orchestrator`.

## Sub-spec / tickets

Spec e ticket generati da questo brief. Prossimo passo: `implement-spec` (manuale) o `orchestrator`.

- spec: docs/spec/0004-andamento-calorico.md
- tickets:
  - TICKET-0023 — Andamento: aggregazione e vista Giorno (`docs/tickets/0023-andamento-aggregazione-vista-giorno.md`, #23)
  - TICKET-0024 — Andamento: viste Settimana e Mese (`docs/tickets/0024-andamento-viste-settimana-mese.md`, #24)

## Note di merge (compilate da orchestrator)

- risultato merge su `orchestrator/integrate`: non-eseguito
- note conflitto (se stop umano): —
