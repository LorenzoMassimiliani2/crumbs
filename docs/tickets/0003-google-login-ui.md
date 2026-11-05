---
id: TICKET-0003
title: Login con Google nella PWA
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0001, TICKET-0002]
blocks: [TICKET-0004]
source: conversation
github: 3
---

## Brief (AGENT-BRIEF)
La schermata di accesso offre il login con Google Identity Services. Dopo il login l'app usa l'ID token per chiamare le API protette.

Comportamento richiesto:
- La schermata di accesso mostra un pulsante "Accedi con Google"; il campo token statico resta disponibile come opzione secondaria ("Accesso con token").
- Il client GIS viene caricato solo quando serve, con `GOOGLE_CLIENT_ID` letto da configurazione pubblica del build.
- Al click, GIS restituisce un `credential` (ID token); l'app lo memorizza con la sua scadenza e lo invia come `Authorization: Bearer` a tutte le chiamate `/api/*`.
- Nessun token in URL, log o messaggi di errore.
- Se il login Google viene annullato o fallisce, l'utente resta sulla schermata e vede un messaggio comprensibile.
- Se `GOOGLE_CLIENT_ID` non è configurato, la schermata mostra solo l'accesso con token.
- L'app mostra l'identità dell'utente (email) dopo il login, tramite `GET /api/me`.

Fuori scope:
- rinnovo automatico del token, logout e gestione della scadenza durante l'uso (ticket successivo);
- registrazione, ruoli, multi-utente;
- modifica del layout del diario.

## Acceptance criteria
- [ ] Con client ID configurato, il pulsante Google completa il login e il diario si apre.
- [ ] Le chiamate `/api/*` includono l'ID token e ricevono `200`.
- [ ] Il token statico funziona ancora dal campo secondario.
- [ ] Login annullato non lascia credenziali memorizzate e mostra un messaggio.
- [ ] Senza client ID la schermata non tenta di caricare GIS e propone solo il token.
- [ ] L'email dell'utente autenticato è visibile dopo il login.

## Choices
- decisione: memorizzare l'ID token in `localStorage` con scadenza esplicita.
  rationale: coerente con il gate esistente; l'ID token dura un'ora e non è un segreto a lungo termine.
  alternatives_rejected: cookie HttpOnly (richiede code flow e backend di sessione).
  evidence: scelta opzione A del 2026-11-05.
