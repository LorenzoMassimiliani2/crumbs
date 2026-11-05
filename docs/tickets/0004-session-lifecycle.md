---
id: TICKET-0004
title: Gestire scadenza, rinnovo e logout della sessione Google
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0003]
blocks: []
source: conversation
github: 4
---

## Brief (AGENT-BRIEF)
L'app gestisce in modo esplicito il ciclo di vita dell'ID token Google, evitando che l'utente incontri errori opachi quando il token scade.

Comportamento richiesto:
- Prima di una chiamata API, se il token è scaduto (o scade entro 60 secondi), l'app non invia la richiesta: mostra la schermata di accesso con messaggio "sessione scaduta".
- Su risposta `401` da una qualsiasi chiamata autenticata, l'app cancella il token e torna alla schermata di accesso, mantenendo la rotta corrente per riprendere dopo il login.
- Il login successivo è a un click: GIS riusa la sessione Google attiva senza richiedere password, quando il browser lo consente.
- Comando "Esci" visibile dopo il login: cancella il token locale, disabilita la selezione automatica Google e torna alla schermata di accesso.
- Al ritorno in primo piano della PWA (visibilità o focus) l'app rivalida la credenziale con `GET /api/me`.
- Nessun loop di richieste: una sola rivalidazione per evento.

Fuori scope:
- refresh token OAuth;
- sessioni server-side;
- notifiche push.

## Acceptance criteria
- [ ] Token scaduto non genera chiamate API e porta alla schermata di accesso.
- [ ] Un `401` in qualsiasi punto dell'app cancella il token e riporta al login.
- [ ] Dopo il login si torna alla rotta da cui si era usciti.
- [ ] "Esci" rimuove il token e impedisce il riuso automatico della sessione Google.
- [ ] Tornando sull'app dopo un periodo di inattività la credenziale viene rivalidata una sola volta.
- [ ] Nessun messaggio di errore espone il contenuto del token.

## Choices
- decisione: nessun refresh token, re-login a un click alla scadenza.
  rationale: l'ID token dura un'ora; il code flow con refresh richiederebbe un backend di sessione e cookie.
  alternatives_rejected: rinnovo silenzioso con `prompt: 'none'` (inaffidabile con i cookie di terze parti).
  evidence: limiti discussi il 2026-11-05.
