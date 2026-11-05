---
id: TICKET-0005
title: Rimuovere l'accesso con token dalla schermata di login
status: ready-for-agent
category: enhancement
blocked_by: []
blocks: []
source: conversation
github: 5
---

## Brief (AGENT-BRIEF)
La schermata di accesso deve offrire solo il login con Google. L'accesso con token statico sparisce dall'interfaccia; il Worker continua ad accettare `API_TOKEN` come credenziale di servizio per script e curl.

Comportamento richiesto:
- La schermata di accesso mostra solo il pulsante ufficiale "Accedi con Google": niente campo token, niente pulsante "Entra con token", niente separatore "oppure" e nessun testo che citi il token.
- Con `VITE_GOOGLE_CLIENT_ID` configurato il login Google si comporta come oggi (ID token salvato con scadenza, email in header, Esci, rivalidazione).
- Se `VITE_GOOGLE_CLIENT_ID` è assente o vuoto, la schermata mostra un messaggio comprensibile di login Google non configurato e non offre alcun accesso alternativo.
- Credenziali salvate di tipo `service` non autenticano più l'app: all'avvio vengono rimosse e la schermata di accesso Google viene mostrata.
- La chiave legacy `crumbs.apiToken` non viene più migrata; se presente viene rimossa.
- In header non compare più l'etichetta "Accesso con token": l'identità mostrata è solo quella Google (`email`).
- `API_TOKEN` resta valido su `/api/*` per richieste esterne all'app.

Fuori scope:
- rimuovere `API_TOKEN` dal Worker o dalle API;
- modificare la verifica dell'ID token Google o il ciclo di vita della sessione;
- introdurre un nuovo metodo di accesso.

Nota: questo ticket sostituisce il criterio del TICKET-0003 che prevedeva il token come accesso secondario.

## Acceptance criteria
- [ ] La schermata di accesso non contiene campo, pulsante o testo riferiti al token.
- [ ] Con client ID configurato il login Google completa e il diario si apre.
- [ ] Senza client ID la schermata mostra il messaggio di configurazione mancante.
- [ ] Una credenziale `service` salvata in localStorage non apre l'app e viene rimossa.
- [ ] La chiave legacy `crumbs.apiToken` viene rimossa e non autentica.
- [ ] `API_TOKEN` continua a funzionare con curl su `/api/meals` e `/api/me`.
- [ ] `npm run type-check` e `npm run build` passano.

## Choices
- decisione: rimuovere solo l'accesso con token dalla UI, mantenendo `API_TOKEN` nel Worker.
  rationale: l'app personale usa Google; il token statico serve solo a script e curl.
  alternatives_rejected: rimuovere anche `API_TOKEN` (rompe tooling e automazioni); lasciare il campo nascosto (superficie inutile e stato da mantenere).
  evidence: richiesta dell'utente del 2026-11-05.
