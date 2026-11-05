---
id: ORCH-20261105-145558
work: SPEC-0001
type: feature
status: ready-for-merge
contract: {discovery: skip, to-features: skip, to-spec: skip, to-tickets: skip, implement: delegated, review: delegated, merge: user-owned}
phases: [implement, review, merge]
---
# ORCH-20261105-145558 — Diario alimentare v1

## Goal
Implementare la SPEC-0001 con TDD, ticket per ticket, commit per ticket su branch dedicati. Restano fuori `0011` (bloccato dalla chiave USDA umana, ticket `0013`).

## Contract (per fase)
| Fase | Autonomia | Chi decide |
|---|---|---|
| discovery | skip | già fatto (grilling) |
| to-features | skip | — |
| to-spec | skip | spec approvata |
| to-tickets | skip | ticket su GitHub #6–#13 |
| implement | delegated | orchestrator, TDD, commit per ticket |
| review | delegated | due assi (standards, spec) sul diff `main...HEAD` |
| merge | user-owned | orchestrator mergia solo su `orchestrator/integrate`; `main` decide l'utente |

## Workflow scelto
- Worktree di integrazione `orchestrator/integrate` da `main`.
- Per ogni ticket: worktree `.worktrees/<ID>` e branch `ticket/<ID>` da `orchestrator/integrate`.
- Implementazione TDD; verifica verde (`npm test`, `npm run type-check`, `npm run build`) prima del merge in integrate; merge `--no-ff`.
- Review a due assi (`review-standards`, `review-spec`) e giro di correzioni unico (`ticket/FIX-review`).

## Grafo dipendenze
```
0006 -> 0007 -> 0008 -> {0009, 0010, 0012}
0010 + 0013 -> 0011
0013 = umano (chiave USDA)
```

## Topologia branch/worktree
| Unità | Branch | Stato |
|---|---|---|
| integrazione | `orchestrator/integrate` | pronto, 140 test verdi |
| TICKET-0006 | `ticket/TICKET-0006` | mergiato |
| TICKET-0007 | `ticket/TICKET-0007` | mergiato |
| TICKET-0008 | `ticket/TICKET-0008` | mergiato |
| TICKET-0009 | `ticket/TICKET-0009` | mergiato |
| TICKET-0010 | `ticket/TICKET-0010` | mergiato |
| TICKET-0012 | `ticket/TICKET-0012` | mergiato |
| FIX-review | `ticket/FIX-review` | mergiato |
| TICKET-0011 | — | bloccato da 0013 (chiave USDA) |

## Avanzamento
- [x] Contract concordato
- [x] Piano copiato su `orchestrator/integrate`
- [x] 0006 seam di test
- [x] 0007 schema + profilo
- [x] 0008 pasti + giorno
- [x] 0009 preferiti
- [x] 0010 ricerca Open Food Facts
- [x] 0012 export Excel
- [x] Review standards + spec
- [x] Correzioni review (nutrienti null, preferiti non sovrascritti, giorno stale, fonte in Oggi, 409, SheetJS lazy)
- [x] Spec e README allineati
- [ ] 0011 fallback USDA — bloccato da 0013
- [ ] Merge su main (utente)

## Esito review
- Nessun blocco di correttezza.
- Corretti: `null` preservato in preferiti e voci; salvataggio pasto non riscrive i preferiti; vista Oggi non mostra il giorno precedente in caso di errore; fonte visibile per voce; 409 sul rename duplicato; SheetJS in chunk separato.
- Rinviati come follow-up: duplicazione di tipi/validatori, dimensione di `AddMealFlow.vue`, UPSERT utenti a ogni richiesta, advisory npm su `xlsx` 0.18.5 (uso solo in scrittura, rischio basso).

## Escalation
- Conflitti risolti: `src/worker/index.ts` (export + foods + OFF), `src/views/AddMealFlow.vue` (azioni preferiti + ricerca).
- Service token: risolto all'utente `ALLOWED_EMAIL`, 403 se la riga non esiste (serve un login Google).
- `0011` non parte finché `0013` non è completato.
