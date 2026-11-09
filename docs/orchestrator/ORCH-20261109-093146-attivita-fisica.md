---
id: ORCH-20261109-093146
work: FEAT-0001
type: feature
status: in-progress
contract: {discovery: skip, to-features: skip, to-spec: skip, to-tickets: skip, implement: delegated, review: delegated, merge: user-owned}
phases: [implement, review, merge]
---
# ORCH-20261109-093146 — attivita-fisica

## Goal

Implementare i ticket TICKET-0014 → TICKET-0018 della feature FEAT-0001 (attività fisica nel diario) sul branch `feat/attivita`, un ticket alla volta, con test, type-check e build verdi a ogni passo.

## Contract (per fase)

| Fase | Autonomia | Chi decide |
|---|---|---|
| discovery | skip | — |
| to-features | skip | ledger già approvato |
| to-spec | skip | SPEC-0002 approvata |
| to-tickets | skip | TICKET-0014…0018 pronti |
| implement | delegated | orchestrator, seriale max 1 |
| review | delegated | orchestrator con code-review |
| merge | user-owned | Lorenzo |

## Workflow scelto

- Worktree unico `.worktrees/attivita` sul branch `feat/attivita`, creato da `main`.
- Nessun branch per ticket: un commit per ticket, in ordine di dipendenza.
- Dopo ogni ticket: `npm test`, `npm run type-check`, `npm run build`.
- Se un ticket resta rosso due volte, stop ed escalation.
- A fine lavoro: `scripts/tickets-sync.py --push` per i `## Choices`.

## Grafo dipendenze

- TICKET-0014 (frontier, no blocker)
- TICKET-0015 blocked_by 0014
- TICKET-0016 blocked_by 0014
- TICKET-0017 blocked_by 0014
- TICKET-0018 blocked_by 0014

Ordine seriale: 0014 → 0015 → 0016 → 0017 → 0018.

## Topologia branch/worktree

- base: `main` (b86c8b2)
- branch di lavoro e integrazione: `feat/attivita`
- worktree: `.worktrees/attivita`

## Avanzamento

| Fase | Stato | Note |
|---|---|---|
| plan | completed | feature, spec, ticket, ORCH |
| implement 0014 | pending | |
| implement 0015 | pending | |
| implement 0016 | pending | |
| implement 0017 | pending | |
| implement 0018 | pending | |
| review | pending | |
| merge | user-owned | |

## Escalation

Stop e richiesta umana su: cambio scope, decisioni architetturali non coperte, conflitti difficili, due fallimenti consecutivi sullo stesso ticket, operazioni distruttive.
