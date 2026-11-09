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
