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
