---
id: TICKET-0009
title: Gestire il catalogo dei preferiti
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0008]
blocks: []
source: docs/spec/0001-diario-alimentare-v1.md
github: 9
---

## Brief (AGENT-BRIEF)
L'utente deve poter correggere, rinominare ed eliminare gli alimenti che ha salvato, senza alterare i pasti già registrati. Il catalogo dei preferiti è ciò che rende veloce registrare i cibi ricorrenti.

Comportamento richiesto:
- `GET /api/foods` restituisce i preferiti dell'utente ordinati per `last_used_at` decrescente, poi per nome.
- `POST /api/foods` crea un alimento manuale con nome e valori per 100 g; fonte `manual`.
- `PATCH /api/foods/:id` aggiorna nome e valori per 100 g. La modifica vale per gli usi futuri; le voci dei pasti già salvate restano identiche.
- `DELETE /api/foods/:id` elimina il preferito; le voci dei pasti che lo usavano restano intatte e il loro riferimento al preferito diventa nullo.
- Deduplica all'inserimento: stesso `(user_id, source, source_id)` oppure stesso nome normalizzato e stessa fonte producono un solo preferito, aggiornando i valori esistenti invece di crearne un altro.
- Validazione dei valori: kcal e macro ≥ 0, grammi > 0, nome non vuoto; valori fuori intervallo producono 400.
- Interfaccia: l'elenco dei preferiti nel flusso di aggiunta mostra un'azione per alimento (modifica, elimina); la modifica apre un form con nome e valori per 100 g e salva con feedback; l'eliminazione chiede conferma e spiega che i pasti passati non cambiano. La creazione manuale è disponibile dallo stesso elenco.
- Il filtro locale dei preferiti resta immediato mentre si digita.

Fuori scope:
- ricerca su fonti esterne, import massivo, unione manuale di duplicati oltre la deduplica automatica, gestione dei preferiti da una pagina dedicata.

## Acceptance criteria
- [ ] `GET /api/foods` restituisce i preferiti dell'utente nell'ordine di ultimo utilizzo.
- [ ] Modificare nome e valori di un preferito cambia ciò che viene proposto nei pasti successivi.
- [ ] Dopo la modifica di un preferito, i valori delle voci di pasto già salvate restano quelli di prima.
- [ ] Eliminare un preferito lo rimuove dall'elenco e rende nullo il riferimento nelle voci che lo usavano, senza cancellare le voci.
- [ ] Inserire due volte lo stesso alimento con la stessa fonte e id esterno produce un solo preferito.
- [ ] Inserire un alimento con `source_id` assente e nome equivalente a uno esistente aggiorna quello esistente invece di duplicarlo.
- [ ] Un alimento con nome vuoto o valori negativi viene rifiutato con 400.
- [ ] Nell'interfaccia si possono modificare ed eliminare i preferiti con conferma, e il salvataggio mostra un esito.
- [ ] `npm test`, `npm run type-check` e `npm run build` passano.

## Choices
- decisione: eliminazione fisica del preferito con annullamento del riferimento nelle voci, non soft delete.
  rationale: lo storico è già nello snapshot; un soft delete aggiungerebbe stato senza valore.
  alternatives_rejected: soft delete dei preferiti.
  evidence: grilling Q20, Q32.
- decisione: nessuna pagina dedicata ai preferiti; la gestione vive nel flusso di aggiunta.
  rationale: l'utente li tocca solo mentre registra un pasto.
  alternatives_rejected: nuova tab o sezione nel Profilo.
  evidence: prototipo variante A; spec 0001.
- decisione: deduplica per id esterno e, in mancanza, per nome normalizzato.
  rationale: evita duplicati visibili quando la stessa ricerca viene ripetuta.
  alternatives_rejected: nessuna deduplica; deduplica solo per nome.
  evidence: grilling Q20; spec 0001.
