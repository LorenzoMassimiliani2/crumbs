---
id: ORCH-20261105-145558
work: SPEC-0001
type: feature
status: implementing
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
| review | delegated | code-review a fine batch |
| merge | user-owned | orchestrator mergia solo su `orchestrator/integrate`; `main` decide l'utente |

## Workflow scelto
- Worktree di integrazione `orchestrator/integrate` da `main`.
- Per ogni ticket: worktree `.worktrees/<TICKET-ID>` e branch `ticket/<TICKET-ID>` da `orchestrator/integrate`.
- Implementazione TDD; verifica verde (`npm test`, `npm run type-check`, `npm run build`) prima del merge in integrate; merge `--no-ff`; un commit per ticket sul suo branch.
- Review con `code-review` a fine batch; conflitti su file sensibili → STOP.

## Grafo dipendenze
```
0006 -> 0007 -> 0008 -> {0009, 0010, 0012}
0010 + 0013 -> 0011
0013 = umano (chiave USDA)
```

## Topologia branch/worktree
| Unità | Branch | Worktree |
|---|---|---|
| integrazione | `orchestrator/integrate` | `.worktrees/integrate` |
| TICKET-0006 | `ticket/TICKET-0006` | `.worktrees/TICKET-0006` |
| TICKET-0007 | `ticket/TICKET-0007` | `.worktrees/TICKET-0007` |
| TICKET-0008 | `ticket/TICKET-0008` | `.worktrees/TICKET-0008` |
| TICKET-0009 | `ticket/TICKET-0009` | `.worktrees/TICKET-0009` |
| TICKET-0010 | `ticket/TICKET-0010` | `.worktrees/TICKET-0010` |
| TICKET-0012 | `ticket/TICKET-0012` | `.worktrees/TICKET-0012` |

## Avanzamento
- [x] Contract concordato
- [x] Piano copiato su `orchestrator/integrate`
- [x] 0006 seam di test (merge 8e37da7)
- [x] 0007 schema + profilo (merge)
- [x] 0008 pasti + giorno (merge)
- [x] 0009 preferiti (merge af90f40)
- [x] 0010 ricerca OFF (merge)
- [x] 0012 export (merge)
- [ ] review batch
- [ ] merge su main (utente)

## Escalation
- Conflitti su file sensibili: stop, branch e worktree intatti.
- Compatibilità Vitest/Cloudflare pool: fallback D1 SQLite in memoria, come da ticket.
- `0011` non parte finché `0013` non è completato.
