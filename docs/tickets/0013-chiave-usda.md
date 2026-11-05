---
id: TICKET-0013
title: Ottenere e configurare la chiave USDA FoodData Central
status: ready-for-human
category: enhancement
blocked_by: []
blocks: [TICKET-0011]
source: docs/spec/0001-diario-alimentare-v1.md
github: 13
---

## Brief (AGENT-BRIEF)
Prerequisito umano per il fallback sugli alimenti generici: USDA FoodData Central richiede una API key gratuita. Un agente non può creare l'account né conservare la chiave.

Comportamento richiesto:
- Creare un account su FoodData Central e ottenere una API key gratuita.
- Configurare il secret `USDA_API_KEY` nel Worker di produzione con `npx wrangler secret put USDA_API_KEY`.
- Aggiungere la stessa variabile in `.dev.vars` per lo sviluppo locale, senza committarla.
- Verificare la chiave con una richiesta di ricerca che restituisce 200 e almeno un risultato.
- Comunicare al team solo l'avvenuta configurazione, mai il valore della chiave.

Fuori scope:
- codice applicativo (arriva nel ticket 0011), rotazione della chiave, quote superiori a quella gratuita.

## Acceptance criteria
- [ ] La API key USDA esiste ed è attiva.
- [ ] Il secret `USDA_API_KEY` è impostato sul Worker di produzione.
- [ ] `USDA_API_KEY` è presente in `.dev.vars` locale e non è tracciato da git.
- [ ] Una richiesta di prova a USDA con la chiave restituisce 200 con almeno un risultato.
- [ ] Il valore della chiave non compare in nessun file committato.

## Choices
- decisione: usare la chiave gratuita USDA invece di DEMO_KEY.
  rationale: DEMO_KEY ha limiti molto bassi (30/ora, 50/giorno) e non è adatta all'uso quotidiano.
  alternatives_rejected: DEMO_KEY; rinunciare al fallback generici.
  evidence: report API, limiti ufficiali USDA.
- decisione: chiave come secret del Worker e variabile locale, mai nel client.
  rationale: la chiave non deve essere esposta nella PWA.
  alternatives_rejected: chiave nel bundle frontend.
  evidence: spec 0001; report API.
