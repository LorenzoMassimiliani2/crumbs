---
id: TICKET-0002
title: Verificare l'ID token Google nel Worker
status: ready-for-agent
category: enhancement
blocked_by: []
blocks: [TICKET-0003]
source: conversation
github: 2
---

## Brief (AGENT-BRIEF)
Il Worker accetta come credenziale un ID token Google (JWT) inviato come `Authorization: Bearer <token>` e lo verifica prima di servire qualsiasi rotta `/api/*` protetta. `/api/health` resta pubblica.

Comportamento richiesto:
- Accettare due credenziali: ID token Google valido, oppure il token statico esistente (`API_TOKEN`) come accesso di servizio.
- Verifica dell'ID token:
  - firma RS256 contro le chiavi pubbliche di Google (JWKS);
  - `iss` uguale a `accounts.google.com` o `https://accounts.google.com`;
  - `aud` uguale a `GOOGLE_CLIENT_ID`;
  - `exp` non scaduto e `iat` non nel futuro, con tolleranza massima di 60 secondi;
  - `email_verified` vero;
  - `email` uguale a `ALLOWED_EMAIL`.
- Rotazione chiavi: se il `kid` non è noto, ricaricare le chiavi una sola volta; cache delle chiavi con TTL di un'ora tramite Cache API.
- Risposta `401` con header `WWW-Authenticate: Bearer` per credenziale assente, malformata, scaduta o non autorizzata; nessun dettaglio sull'errore nel body oltre a un codice stabile.
- Nuova rotta `GET /api/me` che, con credenziale valida, restituisce identità dell'utente (`email`, `name`, `picture`) e il tipo di credenziale usato.
- Configurazione: `GOOGLE_CLIENT_ID` come variabile del Worker, `ALLOWED_EMAIL` come secret. Se mancano, ogni credenziale Google è rifiutata e il token statico resta l'unico accesso valido.

Fuori scope:
- UI di login (ticket successivo);
- persistenza di utenti o sessioni in D1;
- refresh dei token;
- multi-utente.

## Acceptance criteria
- [ ] Token statico valido continua a funzionare su `/api/meals`.
- [ ] ID token valido per l'email autorizzata accede a `/api/meals` e `/api/me`.
- [ ] ID token con email diversa, `aud` errata, firma non valida o scaduto riceve `401`.
- [ ] Token assente riceve `401` con `WWW-Authenticate`.
- [ ] `kid` sconosciuto provoca un solo refetch delle chiavi e poi la verifica.
- [ ] `/api/health` resta accessibile senza credenziale.
- [ ] Test automatici della verifica (firma, claim, rotazione `kid`, allowlist) senza dipendere dalla rete.

## Choices
- decisione: mantenere il token statico come credenziale di servizio.
  rationale: consente script, curl e test senza dipendere da un login Google interattivo.
  alternatives_rejected: rimuovere subito il token statico (rompe tooling e automazioni esistenti).
  evidence: discussione del 2026-11-05.
- decisione: allowlist di una sola email.
  rationale: l'app è un diario personale; nessun modello multi-utente richiesto.
  alternatives_rejected: tabella utenti in D1 (rinviata a quando servirà davvero).
  evidence: discussione del 2026-11-05.
