---
id: TICKET-0001
title: Configurare OAuth client Google per la PWA
status: done
category: enhancement
blocked_by: []
blocks: [TICKET-0003]
source: conversation
github: 1
---

## Brief (AGENT-BRIEF)
Prerequisito umano: creare e configurare il client OAuth "Web application" su Google Cloud per permettere il login Google Identity Services (GIS) alla PWA.

Contratto operativo:
- Progetto Google Cloud dedicato all'app.
- OAuth consent screen: tipo External, stato Testing, utente di test = email del proprietario. Scope richiesti: `openid`, `email`, `profile`.
- OAuth Client ID di tipo "Web application".
- Authorized JavaScript origins, senza redirect URI (GIS non usa redirect):
  - `https://crumbs.massilorenzo94.workers.dev`
  - `http://localhost:5173`
- Il client secret non serve: non va creato né conservato.

Output attesi, comunicati al resto del team:
- `GOOGLE_CLIENT_ID` (pubblico) da impostare come variabile del Worker.
- Email del proprietario da impostare come secret `ALLOWED_EMAIL`.
- Conferma che una chiamata GIS di prova restituisce un `credential` (JWT) decodificabile.

Fuori scope:
- codice applicativo;
- verifica formale dell'app da parte di Google (non necessaria con questi scope);
- login per utenti diversi dal proprietario.

## Acceptance criteria
- [x] Client ID Web creato e disponibile.
- [x] Entrambe le origin autorizzate.
- [x] Consent screen in Testing con l'email del proprietario tra gli utenti di test.
- [x] Un tentativo di login da `http://localhost:5173` restituisce un `credential` JWT.
- [x] `GOOGLE_CLIENT_ID` e `ALLOWED_EMAIL` comunicati e impostati nel Worker.

## Choices
- decisione: usare GIS con ID token invece del code flow OAuth.
  rationale: nessun client secret, nessun redirect, nessun cookie di sessione; integrazione minima con una PWA statica.
  alternatives_rejected: authorization code flow con cookie HttpOnly (più sicuro ma richiede endpoint di callback, tabella sessioni e secret); Cloudflare Access (richiede dominio proprio).
  evidence: discussione del 2026-11-05, scelta opzione A.
