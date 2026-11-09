---
id: TICKET-0015
title: Attività oltre la mezzanotte e durate lunghe
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0014]
blocks: []
source: docs/spec/0002-attivita-fisica.md
github: 15
---

## Brief (AGENT-BRIEF)
Il flusso **+ Attività** deve gestire ore di fine precedenti all'inizio e durate molto lunghe senza salvare errori di battitura.

Comportamento richiesto:
- Quando l'ora di fine è precedente all'ora di inizio, la fine si intende il giorno successivo: la durata è calcolata sull'intervallo che scavalca la mezzanotte.
- Se la durata supera 12 ore e non supera 24 ore, al salvataggio compare una conferma esplicita che mostra la durata; annullando si resta nel flusso senza salvare.
- Una durata superiore a 24 ore non è salvabile: il server restituisce 400 e la UI mostra un messaggio comprensibile.
- La durata mostrata in sola lettura riflette correttamente l'intervallo notturno e il formato è leggibile (ore e minuti).
- Il server accetta istanti coerenti (`endedAt` successivo a `startedAt`, anche se cade nel giorno dopo) e continua a rifiutare istanti senza fuso, non validi o invertiti.

Fuori scope:
- attività che durano più di 24 ore o che vanno divise su più giorni;
- calorie, MET e qualunque calcolo energetico;
- modifiche alla vista Oggi oltre alla durata mostrata.

Nota: TICKET-0014 blocca il salvataggio quando la fine non è successiva all'inizio; questo ticket sostituisce quel comportamento con la semantica del giorno successivo.

## Acceptance criteria
- [ ] Inizio 23:00 e fine 01:00 produce una durata di 120 minuti e salva correttamente.
- [ ] Inizio 18:00 e fine 08:00 (14 ore) mostra una conferma con la durata prima di salvare.
- [ ] Annullare la conferma non salva nulla e lascia il flusso aperto con i valori inseriti.
- [ ] Una durata di 25 ore viene rifiutata dal server con 400 e la UI mostra un messaggio chiaro.
- [ ] Un `endedAt` precedente o uguale a `startedAt` restituisce 400.
- [ ] La durata mostrata in sola lettura usa sempre ore e minuti e non valori negativi.

## Choices

| decisione | rationale | alternatives_rejected | evidence |
| --- | --- | --- | --- |
| La risoluzione della mezzanotte vive in `activityInstants(localDate, startTime, endTime)` in `src/lib/activity.ts`: se la fine è precedente all'inizio si costruisce l'istante sul giorno locale successivo | Un solo punto puro e testabile per la semantica degli orari, usato dal flusso UI; costruire la data locale con `day + 1` gestisce anche i cambi di ora legale, cosa che sommare 24 h in millisecondi non fa | Aggiungere 24 h in ms all'istante di fine; duplicare il calcolo dentro `AddActivityFlow.vue` | `src/lib/activity.ts` (`activityInstants`); test "rolls an end before the start to the following day"; test UI "reads times past midnight..." |
| Inizio e fine uguali restano un errore in UI ("L'ora di fine deve essere successiva all'ora di inizio") e il server continua a rispondere 400 per `endedAt <= startedAt` | Il ticket definisce il giorno successivo solo per la fine *precedente*; con input a soli `HH:MM` un orario uguale non è distinguibile da un'attività di 24 h, e l'acceptance richiede 400 su `endedAt <= startedAt` | Trattare l'uguaglianza come 24 h o come fine del giorno dopo | `src/views/AddActivityFlow.vue` (`timeError`); test UI "blocks the save... when the end equals the start"; test worker "rejects an end that is not after the start" |
| Le durate oltre 12 h richiedono una conferma in-flow prima della POST; "Annulla" chiude solo il dialogo e conserva i valori inseriti | Il salvataggio resta esplicito e a due passi senza perdere il lavoro fatto; il flusso non viene smontato, quindi gli orari restano | `window.confirm`; conferma delegata al componente padre; salvataggio con un secondo click sul bottone | `src/views/AddActivityFlow.vue` (`requestSave`, `confirming`); test UI "asks for confirmation over 12 hours..." |
| La soglia delle 12 h è `LONG_ACTIVITY_MINUTES` e il limite delle 24 h è `MAX_ACTIVITY_MINUTES`, entrambi in `src/lib/activity.ts` | UI e Worker condividono gli stessi numeri, senza duplicare costanti magiche | Costanti separate nel componente e nel worker | `src/lib/activity.ts`; uso in `AddActivityFlow.vue` e `src/worker/activities.ts` |
| Il server rifiuta con 400 la durata superiore a 24 h confrontando la differenza grezza in millisecondi, non i minuti arrotondati; esattamente 24 h sono accettate | "Superiore a 24 ore" va misurato sull'istante reale: 24 h + 1 s non deve passare perché `activityDurationMinutes` arrotonderebbe a 1440 | Confronto sui minuti arrotondati; limite a 12 h lato server | `createActivityEntry` in `src/worker/activities.ts`; test "accepts exactly 24 hours and rejects anything longer" |
| `formatDuration` resta compatto ("45 min", "2 h", "14 h 30 min") e renderizza `—` per valori negativi o non finiti | Interpretazione di "usa sempre ore e minuti" come unità ore/minuti (mai minuti grezzi o valori negativi); il formato compatto è già usato nella vista Oggi e mantiene leggibile la riga attività | Formato sempre con entrambe le componenti ("0 h 45 min", "1 h 0 min") | `src/lib/activity.test.ts` ("renders compact Italian durations", "renders a dash for invalid values"); test UI "shows long and night durations..." |
