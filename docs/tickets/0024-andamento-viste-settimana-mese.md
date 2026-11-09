---
id: TICKET-0024
title: Andamento: viste Settimana e Mese
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0023]
blocks: []
source: docs/spec/0004-andamento-calorico.md
github: 24
---

## Brief (AGENT-BRIEF)
La sezione Andamento deve offrire anche le viste Settimana e Mese, con un selettore e la scelta ricordata durante la sessione.

Comportamento richiesto:
- Selettore **Giorno / Settimana / Mese** nella sezione Andamento; default Giorno. La scelta resta attiva durante la sessione e non viene salvata sul database.
- Vista Settimana: fino a 8 settimane di calendario, da lunedì a domenica, che terminano con quella corrente. Una barra per settimana con la media delle kcal giornaliere dei giorni con pasti; la settimana corrente usa solo i giorni fino a oggi.
- Vista Mese: fino a 12 mesi di calendario che terminano con quello corrente. Una barra per mese con la media delle kcal giornaliere dei giorni con pasti.
- Giorni senza pasti non producono barre e non entrano nelle medie; giorni futuri esclusi.
- Il confronto con il periodo precedente usa rispettivamente le 8 settimane precedenti e i 12 mesi precedenti; la variazione compare solo se entrambi i periodi hanno giorni con pasti.
- Il riepilogo mostra media del periodo, giorni con pasti sui giorni trascorsi del periodo e variazione.
- Il grafico usa una sola richiesta per intervallo, coprendo periodo corrente e precedente entro 800 giorni.
- Tooltip accessibile per ogni barra con periodo, media e giorni registrati.
- Nella vista Giorno il tocco continua ad aprire quel giorno; nelle viste Settimana e Mese il tocco non cambia il giorno selezionato.
- Un periodo senza dati mostra lo stato vuoto.

Fuori scope:
- intervalli arbitrari, zoom o pan;
- confronto tra utenti o con obiettivi peso;
- macro, attività, export;
- persistenza della vista scelta oltre la sessione.

## Acceptance criteria
- [ ] La sezione Andamento mostra il selettore Giorno/Settimana/Mese con default Giorno.
- [ ] La vista scelta resta attiva durante la sessione.
- [ ] La vista Settimana mostra fino a 8 barre lunedì–domenica con la media giornaliera.
- [ ] La settimana corrente considera solo i giorni fino a oggi.
- [ ] La vista Mese mostra fino a 12 barre mensili con la media giornaliera.
- [ ] Giorni senza pasti e giorni futuri non producono barre né entrano nelle medie.
- [ ] La variazione usa le 8 settimane o i 12 mesi precedenti e compare solo con dati in entrambi i periodi.
- [ ] Il riepilogo mostra media, giorni registrati sui giorni trascorsi e variazione.
- [ ] Una sola richiesta popola la vista attiva, anche per il confronto.
- [ ] Ogni barra espone periodo, media e giorni registrati in modo accessibile.
- [ ] Il tocco su una barra giorno apre quel giorno; su settimana e mese non cambia il giorno.
- [ ] Un periodo senza dati mostra lo stato vuoto.

## Choices

- **Un solo modello di grafico per le tre viste (`buildTrend(stats, view, today)`), con `slot` come posizione nella finestra**: le barre portano `key`, `date`, `label`, `kcal`, `recordedDays` e la geometria; `buildDayTrend` resta l'implementazione della vista Giorno.
  - rationale: il componente SVG e il riepilogo restano unici, mentre la parte pura e testabile cambia solo per bucket; i test della vista Giorno continuano a valere.
  - alternatives_rejected: tre modelli e tre componenti separati (duplicazione di assi, target, tooltip e riepilogo); rendere la vista un parametro del solo componente con calcoli nel template (non testabile senza DOM).
  - evidence: `src/lib/stats.ts` (`buildTrend`, `assembleTrend`); test "returns the day model by default" e le suite `buildWeekTrend`/`buildMonthTrend`.

- **Bucket di calendario calcolati sulle date locali, con settimane lunedì–domenica (`startOfWeek`) e mesi interi (`startOfMonth`/`addMonths`)**: i giorni della settimana o del mese corrente si fermano a `today`; i giorni futuri non entrano in nessun conteggio.
  - rationale: rispetta la definizione del ticket (settimana lunedì–domenica, mesi di calendario) e non richiede una seconda verità sul fuso orario, perché le date sono già `YYYY-MM-DD`.
  - alternatives_rejected: settimane mobili di 7 giorni a partire da oggi (non allineate al calendario); usare le date UTC del browser (`Date` locali con shift di fuso).
  - evidence: test "uses 8 calendar weeks ending with the current one and excludes future days", "uses 12 calendar months ending with the current one", "averages the days with meals inside each week and counts them".

- **Media pesata sui giorni con pasti del periodo e variazione solo con dati in entrambi i periodi**: la media corrente è `somma kcal / giorni con pasti`; la variazione è `round((media - media precedente) / media precedente * 100)` e la sua etichetta nomina il periodo di confronto della vista.
  - rationale: i giorni non registrati non abbassano la media, e un confronto senza dati non viene inventato; il testo della variazione resta coerente con la vista attiva.
  - alternatives_rejected: media su tutti i giorni trascorsi (penalizza i giorni non registrati); variazione in kcal assolute (meno leggibile come direzione).
  - evidence: test "averages only the days with meals..." (Giorno), "compares with the 8 previous weeks only when both periods have meals", "compares with the 12 previous months only when both periods have meals".

- **Un'intervallo unico per vista (`trendRangeFor`) che copre periodo corrente e precedente**: 28 giorni per Giorno, 16 settimane (112 giorni) per Settimana, 24 mesi (al massimo 735 giorni) per Mese, sempre sotto il limite di 800 giorni dell'API.
  - rationale: una sola richiesta popola barre, media e variazione, come richiesto; l'intervallo resta valido per l'endpoint già esistente.
  - alternatives_rejected: due richieste (corrente e precedente) per la variazione; richiedere solo il periodo corrente e ricavare la variazione da dati mancanti.
  - evidence: test "covers the current and previous period of every view with one interval"; test HomeView "switches view with one request per period and remembers the choice" (`from` 2026-07-20 per Settimana, 2024-12-01 per Mese con "oggi" al 5 novembre).

- **Selettore Giorno/Settimana/Mese dentro la sezione, con la vista tenuta da `HomeView` e passata come prop `view`**: default `day`, cambio con `emit('update:view')`, nessuna persistenza; al cambio parte una sola richiesta per il nuovo intervallo.
  - rationale: lo stato sopravvive al collasso e al ricaricamento dei dati perché vive fuori dal componente che può essere rimontato; il componente resta di sola resa.
  - alternatives_rejected: `localStorage` o database (fuori scope: la scelta dura solo la sessione); stato interno al componente (perso a ogni rimontaggio dopo il caricamento degli stats).
  - evidence: `src/views/HomeView.vue` (`trendView`, `watch(trendView, loadStats)`); test "offers the day, week and month views with day as the default", "switches view with one request per period and remembers the choice".

- **Barre Settimana/Mese non interattive: `role="img"`, nessun `tabindex`, `select` ignorato fuori dalla vista Giorno; tooltip con `title` e `aria-label` sempre presenti**.
  - rationale: il tocco deve cambiare giorno solo nella vista Giorno; ogni barra resta leggibile da screen reader con periodo, media e giorni registrati.
  - alternatives_rejected: rendere selezionabile il primo giorno del periodo (il ticket lo esclude esplicitamente); rimuovere del tutto `aria-label` nelle viste aggregate (perdita del tooltip accessibile).
  - evidence: test "does not select a day when a week or month bar is tapped", "renders month bars with an accessible tooltip", "labels every bar with period, average and recorded days".

- **Etichette X derivate dalla vista: `DD/MM` per giorni e settimane, abbreviazione del mese per i mesi; massimo 5 etichette condivise con la vista Giorno**.
  - rationale: dodici mesi consecutivi non ripetono il nome del mese, quindi l'abbreviazione è univoca; il limite esistente evita sovrapposizioni su telefono.
  - alternatives_rejected: etichette su ogni barra (sovrapposte a 320 px); etichetta completa "novembre 2026" sull'asse (troppo larga).
  - evidence: `formatMonthShort`, `slotLabels`; test "formats week and month periods" e il test esistente sulle etichette di 14 giorni.
