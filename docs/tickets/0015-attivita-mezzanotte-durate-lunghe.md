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
