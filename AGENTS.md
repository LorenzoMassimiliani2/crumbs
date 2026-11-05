# AGENTS.md

Regole per gli agenti che lavorano in questo repo.

- Architettura e convenzioni: vedi `docs/architettura.md`.
- Decisioni (ADR): `docs/decisioni/`; feature ledger: `docs/features/`.
- Ticket tracker: `docs/tickets/` (backend: github-source); spec: `docs/spec/`.
- Learning inbox: `.agents/learnings.md`.
- Ticket: GitHub Issues sono la fonte di verità. `scripts/tickets-sync.py --pull` prima di lavorare, `--push` a fine lavoro.
- Non modificare `external/` manualmente: usa gli script in `scripts/`.
