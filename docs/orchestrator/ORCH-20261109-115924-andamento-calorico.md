---
id: ORCH-20261109-115924
work: FEAT-0003
type: feature
status: completed
contract: {discovery: skip, to-features: skip, to-spec: skip, to-tickets: skip, implement: delegated, review: delegated, merge: user-owned}
phases: [implement, review, merge]
---
# ORCH-20261109-115924 — andamento-calorico

## Goal

Implementare TICKET-0023 → TICKET-0024 della feature FEAT-0003 (andamento calorico nel Diario) sul branch `feat/andamento`, un ticket alla volta, con test, type-check e build verdi a ogni passo.

## Contract (per fase)

| Fase | Autonomia | Chi decide |
|---|---|---|
| discovery | skip | — |
| to-features | skip | FEAT-0003 approvata |
| to-spec | skip | SPEC-0004 approvata |
| to-tickets | skip | TICKET-0023…0024 pronti |
| implement | delegated | orchestrator, seriale max 1 |
| review | delegated | orchestrator con code-review |
| merge | user-owned | Lorenzo |

## Workflow scelto

- Worktree unico `.worktrees/andamento` sul branch `feat/andamento`, creato da `main` (`adb34a6`).
- Un commit per ticket; 0024 dipende da 0023.
- Dopo ogni ticket: `npm test`, `npm run type-check`, `npm run build`.
- Due fallimenti consecutivi sullo stesso ticket: stop ed escalation.
- A fine lavoro: review Standards + Spec, correzioni nel branch, `tickets-sync --push` per i `## Choices`.

## Grafo dipendenze

- TICKET-0023 (frontier)
- TICKET-0024 blocked_by 0023

Ordine seriale: 0023 → 0024.

## Topologia branch/worktree

- base: `main` (`adb34a6`)
- branch: `feat/andamento`
- worktree: `.worktrees/andamento`

## Avanzamento

| Fase | Stato | Note |
|---|---|---|
| plan | completed | feature, spec, ticket, ORCH |
| implement 0023 | completed | commit 6fb3ca2 |
| implement 0024 | completed | commit b00c162 |
| review | completed | finding corretti nel commit di vista dedicata |
| merge | pending | branch `feat/andamento` pronto, decisione umana |

## Escalation

Stop e richiesta umana su: cambio scope, decisioni architetturali non coperte, conflitti difficili, due fallimenti consecutivi sullo stesso ticket, operazioni distruttive.

## Review

- Standards: test tautologico sostituito con letterale; duplicazione settimana/mese estratta in un builder condiviso; `dayNumber` importato dalla lib nel Worker; rimosso `trendRange`; geometria barre/etichette allineata.
- Spec: memoria della vista spostata in un composable di modulo (sopravvive al cambio pagina); media del periodo calcolata sulle kcal grezze; variazione mostrata anche con media precedente 0 (delta in kcal); errore `/api/stats` esplicito nella vista.
- Cambio richiesto dall'utente in review: l'Andamento è una vista dedicata `/trend` aperta da un'icona nel riepilogo del Diario, non una sezione collassabile.

## Verifica finale

- branch `feat/andamento`
- `npm test`: 356/356 verdi
- `npm run type-check`: verde
- `npm run build`: verde
