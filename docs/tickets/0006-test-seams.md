---
id: TICKET-0006
title: Cablare i seam di test del Worker e delle viste
status: ready-for-agent
category: enhancement
blocked_by: []
blocks: [TICKET-0007]
source: docs/spec/0001-diario-alimentare-v1.md
github: 6
---

## Brief (AGENT-BRIEF)
Il progetto deve poter verificare il comportamento del Worker attraverso le sue rotte HTTP e quello delle viste attraverso il DOM, senza rete reale. Questo è un prefactor: non cambia comportamento visibile all'utente.

Comportamento richiesto:
- Suite Worker: ogni test invoca l'handler HTTP del Worker con `Request` reali e una D1 reale con le migrazioni applicate. Le chiamate HTTP esterne (Open Food Facts, USDA) sono intercettate al confine di rete e servite da fixture; nessun test raggiunge la rete.
- Suite frontend: le viste si montano in un ambiente DOM e le chiamate API sono intercettate al confine di rete (fetch). Nessuna asserzione su store, funzioni interne o ordine delle chiamate.
- `npm test` esegue entrambe le suite insieme ai test esistenti di verifica token e credenziale, che continuano a passare senza modifiche.
- Un test di fumo per seam: una rotta pubblica risponde 200 davanti a D1 reale; una vista si monta e mostra il proprio contenuto.
- La configurazione non richiede servizi esterni, credenziali o variabili d'ambiente.

Fuori scope:
- soglie di copertura, test E2E in un browser reale, modifiche alla CI, riscrittura dei test esistenti.

## Acceptance criteria
- [ ] `npm test` esegue suite Worker, suite viste e i test esistenti, e passa da zero.
- [ ] Il test Worker applica le migrazioni a un D1 reale e verifica una rotta HTTP.
- [ ] Una chiamata esterna non intercettata fallisce con un messaggio chiaro invece di uscire in rete.
- [ ] Un test di vista monta una vista e verifica il testo visibile.
- [ ] I test esistenti di token e credenziale passano senza modifiche.
- [ ] Nessun test effettua richieste di rete reali.

## Choices
- decisione: un seam primario sulle rotte HTTP del Worker con D1 reale, più un seam a livello di vista per il frontend.
  rationale: è il punto più alto in cui si osserva comportamento utente (richiesta → dati → risposta) senza accoppiarsi ai moduli interni.
  alternatives_rejected: testare repository e adapter con mock interni (più seam e fragili ai refactor); solo unit test (non coprono i flussi).
  evidence: spec 0001, sezione Seams; guida di testing del repo.
- decisione: API esterne mockate solo al confine di rete.
  rationale: le fonti esterne sono l'unico vero confine; tutto il resto è codice nostro.
  alternatives_rejected: mockare i moduli client delle API (verifica l'implementazione, non il comportamento).
  evidence: guida di mocking del repo.
- decisione: usare il pool Cloudflare per Vitest; se incompatibile con la versione di Vitest installata, usare un D1 SQLite in memoria dietro l'interfaccia `D1Database`, senza cambiare i test.
  rationale: preserva il seam HTTP anche se lo strumento ufficiale non è disponibile.
  alternatives_rejected: scendere a test di repository.
  evidence: spec 0001, fallback tecnico nei Seams; verifica di compatibilità in fase di implementazione.
