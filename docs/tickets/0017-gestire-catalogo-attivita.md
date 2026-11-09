---
id: TICKET-0017
title: Gestire il catalogo delle attività
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0014]
blocks: []
source: docs/spec/0002-attivita-fisica.md
github: 17
---

## Brief (AGENT-BRIEF)
L'utente deve poter rinominare e cancellare le voci del catalogo attività senza alterare le voci già registrate nel diario.

Comportamento richiesto:
- Nel flusso **+ Attività** è possibile rinominare una voce di catalogo (nome obbligatorio, massimo 80 caratteri) e cancellarla con conferma.
- Rinominare una voce non cambia il nome delle voci di diario che la usavano: il diario mostra la copia salvata al momento della registrazione.
- Cancellare una voce di catalogo la rimuove dalla lista di scelta e scollega le voci di diario che la usavano; quelle voci restano visibili nel diario con il nome salvato.
- Una voce di diario il cui catalogo è stato cancellato resta modificabile: per salvarla bisogna scegliere un'attività esistente dal catalogo, che sostituisce il nome salvato.
- Le voci predefinite sono modificabili e cancellabili come quelle create dall'utente.
- Usare un'attività aggiorna il suo ultimo utilizzo, così la lista resta ordinata per uso recente.

Interfacce:
- `PATCH /api/activities/:id` con `{name}` rinomina una voce dell'utente.
- `DELETE /api/activities/:id` cancella la voce del catalogo; le voci di diario collegate restano con il nome salvato.
- Un `id` inesistente o di un altro utente restituisce 404.
- Un nome vuoto o oltre 80 caratteri restituisce 400.

Fuori scope:
- modifica delle voci di diario (TICKET-0016);
- import/export del catalogo;
- categorie, icone o metadati delle attività.

## Acceptance criteria
- [ ] Si può rinominare una voce di catalogo; la lista mostra subito il nuovo nome.
- [ ] Rinominare non cambia il nome delle voci di diario già salvate.
- [ ] Si può cancellare una voce di catalogo con conferma; sparisce dalla lista di scelta.
- [ ] Le voci di diario dell'attività cancellata restano nel diario con il nome salvato.
- [ ] Modificare una voce il cui catalogo è stato cancellato richiede la scelta di un'attività e salva il nuovo nome.
- [ ] `PATCH` con nome vuoto o oltre 80 caratteri restituisce 400.
- [ ] `PATCH` e `DELETE` con identificativo di un altro utente restituiscono 404.
