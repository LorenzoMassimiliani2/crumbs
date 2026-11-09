---
id: TICKET-0018
title: Esportare le attività in Excel
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0014]
blocks: []
source: docs/spec/0002-attivita-fisica.md
github: 18
---

## Brief (AGENT-BRIEF)
Il file `.xlsx` deve includere le attività dell'intervallo scelto, senza modificare i fogli e i totali esistenti.

Comportamento richiesto:
- `GET /api/export` include le attività non cancellate dell'intervallo, ordinate per data e ora di inizio, con data, nome salvato, inizio, fine, durata in minuti e nota.
- Il file `.xlsx` contiene un foglio **Attività** con intestazioni: Data, Attività, Inizio, Fine, Durata (min), Nota.
- Gli orari sono mostrati nel fuso locale del dispositivo nel formato `HH:MM`.
- I fogli **pasti** e **giorni**, le loro intestazioni e i loro valori restano identici a prima della feature.
- Le attività cancellate non compaiono nell'export.
- Un intervallo senza attività produce il foglio con la sola riga di intestazione.

Interfacce:
- Il payload di export include `activities` con `date`, `name`, `startedAt`, `endedAt`, `durationMinutes`, `note`.
- I fogli vengono costruiti dalla funzione pura già usata dai test di export, estesa con la chiave `attivita`.

Fuori scope:
- modifiche ai fogli pasti e giorni;
- riepiloghi o totali delle attività;
- qualunque colonna di calorie per le attività.

## Acceptance criteria
- [ ] `GET /api/export` restituisce le attività dell'intervallo, ordinate per data e inizio.
- [ ] Il file `.xlsx` contiene il foglio **Attività** con le sei intestazioni previste.
- [ ] Una voce con inizio 23:00 e fine 01:00 esporta durata 120.
- [ ] Gli orari esportati sono nel formato `HH:MM` locale.
- [ ] I fogli pasti e giorni e i loro valori restano identici a prima.
- [ ] Le attività cancellate non compaiono.
- [ ] Un intervallo senza attività produce solo l'intestazione del foglio Attività.
