---
id: TICKET-0007
title: Creare schema D1, identità utente e profilo
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0006]
blocks: [TICKET-0008]
source: docs/spec/0001-diario-alimentare-v1.md
github: 7
---

## Brief (AGENT-BRIEF)
Il diario deve avere il proprio modello dati e un profilo utente persistente, con target kcal inserito a mano. Questo ticket crea le fondamenta che i ticket successivi estendono.

Comportamento richiesto:
- Migrazione unica che elimina la vecchia tabella `meals` (vuota) e crea `users`, `profiles`, `foods`, `meals`, `meal_items`, `api_cache` con i campi della spec, i vincoli di unicità e gli indici per le query del diario.
- `users`: chiave `id` = `sub` Google; campi email, nome, immagine, data di creazione. La riga viene creata o aggiornata al primo accesso autenticato, senza richieste esplicite da parte del client.
- `profiles`: per utente, peso in kg, altezza in cm, sesso `m`/`f`, data di nascita, target kcal e data di aggiornamento. `GET /api/profile` restituisce i valori salvati o `null` se il profilo non è mai stato compilato; `PUT /api/profile` valida e salva tutti i campi.
- Validazione: peso 30–300 kg, altezza 100–250 cm, sesso `m` o `f`, data di nascita nel passato, target 800–6000 kcal. Un valore non valido produce 400 con un campo `error` leggibile.
- Interfaccia: shell con tab in basso "Oggi" e "Profilo"; "Oggi" è un segnaposto. "Profilo" mostra il form (peso, altezza, sesso, nascita, target), salva con feedback, e mostra BMR e BMI come informazione, mai usati per il target.
- BMR con Mifflin-St Jeor, BMI da kg/m², entrambi arrotondati; nessun fattore attività.
- Tutte le rotte `/api/*` tranne `/api/health` richiedono `Authorization: Bearer`; senza credenziale valida rispondono 401.
- Lo schema è multi-utente: `profiles.user_id` referenzia `users.id` e ogni lettura è limitata all'utente autenticato.

Fuori scope:
- pasti, alimenti, ricerca esterna, export, statistiche, storico del peso, multi-utente attivo.

## Acceptance criteria
- [ ] La migrazione si applica da zero su un database vuoto e crea tutte le tabelle; la vecchia `meals` non esiste più.
- [ ] `foods` è unica per `(user_id, source, source_id)` quando `source_id` è presente.
- [ ] Esistono indici per i pasti per utente e data locale, per i preferiti per utente e ultimo utilizzo, e per le voci per pasto.
- [ ] Il primo accesso autenticato crea la riga `users` con il `sub` Google; un accesso successivo aggiorna nome e immagine senza duplicare.
- [ ] `PUT /api/profile` seguito da `GET /api/profile` restituisce gli stessi valori.
- [ ] Peso, altezza, sesso, nascita o target fuori intervallo restituiscono 400 e non salvano nulla.
- [ ] La vista Profilo carica i valori salvati, li salva e mostra un feedback di esito.
- [ ] Con peso 78 kg, altezza 178 cm, sesso `m`, nascita 1990-04-12, al 2026-11-05 il BMR mostrato è 1718 kcal e il BMI è 24,6.
- [ ] Le tab Oggi e Profilo cambiano vista e lo stato della tab attiva è visibile.
- [ ] Una rotta `/api/profile` senza credenziale risponde 401.
- [ ] `npm test`, `npm run type-check` e `npm run build` passano.

## Choices
- decisione: target kcal unico nel profilo, senza storico dei target.
  rationale: scelta esplicita dell'utente; cambiare target ricalcola gli scostamenti storici, conseguenza accettata.
  alternatives_rejected: storico dei target con data di validità; target per singolo giorno.
  evidence: grilling Q19=A; spec 0001.
- decisione: profilo con peso, altezza, sesso e data di nascita; BMR e BMI solo informativi.
  rationale: l'utente ha citato le kcal basali e vuole un riferimento, ma il target resta manuale.
  alternatives_rejected: profilo minimo peso/altezza; profilo con fattore attività (non alimenta alcun calcolo).
  evidence: grilling Q8=B, Q18=B.
- decisione: migrazione unica che crea tutto lo schema, anche le tabelle usate dai ticket successivi.
  rationale: evita migrazioni a raffica e tiene la storia dello schema leggibile.
  alternatives_rejected: una migrazione per ticket.
  evidence: spec 0001, sezione Dati.
