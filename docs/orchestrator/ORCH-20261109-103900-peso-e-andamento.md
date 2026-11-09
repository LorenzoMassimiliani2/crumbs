---
id: ORCH-20261109-103900
work: FEAT-0002
type: feature
status: completed
contract: {discovery: skip, to-features: skip, to-spec: skip, to-tickets: skip, implement: delegated, review: delegated, merge: user-owned}
phases: [implement, review, merge]
---
# ORCH-20261109-103900 — peso-e-andamento

## Goal

Implementare TICKET-0019 → TICKET-0022 della feature FEAT-0002 (peso e andamento) sul branch `feat/peso`, un ticket alla volta, con test, type-check e build verdi a ogni passo.

## Contract (per fase)

| Fase | Autonomia | Chi decide |
|---|---|---|
| discovery | skip | — |
| to-features | skip | FEAT-0002 approvata |
| to-spec | skip | SPEC-0003 approvata |
| to-tickets | skip | TICKET-0019…0022 pronti |
| implement | delegated | orchestrator, seriale max 1 |
| review | delegated | orchestrator con code-review |
| merge | user-owned | Lorenzo |

## Workflow scelto

- Worktree unico `.worktrees/peso` sul branch `feat/peso`, creato da `main` (`cff95eb`).
- Nessun branch per ticket: un commit per ticket, in ordine di dipendenza.
- Dopo ogni ticket: `npm test`, `npm run type-check`, `npm run build`.
- Due fallimenti consecutivi sullo stesso ticket: stop ed escalation.
- A fine lavoro: review Standards + Spec, correzioni nel branch, `tickets-sync --push` per i `## Choices`.

## Grafo dipendenze

- TICKET-0019 (frontier)
- TICKET-0020 blocked_by 0019
- TICKET-0021 blocked_by 0019
- TICKET-0022 (nessun blocker)

Ordine seriale: 0019 → 0020 → 0021 → 0022.
0020 e 0021 toccano entrambi la vista Peso: la serialità evita conflitti.

## Topologia branch/worktree

- base: `main` (`cff95eb`)
- branch: `feat/peso`
- worktree: `.worktrees/peso`

## Avanzamento

| Fase | Stato | Note |
|---|---|---|
| plan | completed | feature, spec, ticket, ORCH |
| implement 0019 | completed | commit 1dc2c6d |
| implement 0020 | completed | commit a220336 |
| implement 0021 | completed | commit bdbb4bb |
| implement 0022 | completed | commit 819166f |
| review | pending | |
| merge | completed | merge `837eaf4` su `main` |

## Escalation

Stop e richiesta umana su: cambio scope, decisioni architetturali non coperte, conflitti difficili, due fallimenti consecutivi sullo stesso ticket, operazioni distruttive.

## Review

- Standards: un finding duro (migrazione 0006 non additiva rispetto ai Seams della spec, ora allineata) e giudizi su test/duplicazioni; corretti costanti condivise, nomi, tipo `pendingEdit` e campo inutilizzato.
- Spec: 1 alto (cache profilo quando la riga profilo non esiste ancora), 1 medio (margine Y minimo 0,5 kg), 2 bassi (allineamento spec, conferma su snapshot stantio). Tutti corretti in `9698f96`.

## Verifica finale

- branch `feat/peso`, 5 commit su `main`
- `npm test`: 295/295 verdi
- `npm run type-check`: verde
- `npm run build`: verde
