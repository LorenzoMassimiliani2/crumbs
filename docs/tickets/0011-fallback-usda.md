---
id: TICKET-0011
title: Aggiungere la ricerca USDA per gli alimenti semplici
status: done
category: enhancement
blocked_by: [TICKET-0010, TICKET-0013]
blocks: []
source: docs/spec/0001-diario-alimentare-v1.md
github: 11
---

## Brief (AGENT-BRIEF)
Cercando "mela" Open Food Facts restituisce prodotti di marca, non la mela generica. Questo ticket aggiunge USDA FoodData Central come seconda fonte, scelta dall'utente con un selettore accanto alla ricerca.

Comportamento implementato:
- La ricerca ha un selettore accanto all'input: "Alimenti semplici" (USDA, default) e "Prodotti confezionati" (Open Food Facts). Cambiando fonte si rilancia la ricerca corrente.
- `GET /api/foods/search?q=&source=usda|off` interroga solo la fonte scelta (`source` assente vale `off`). La risposta mantiene la forma `{ off, usda }` con solo il gruppo richiesto popolato; nessuna fusione.
- USDA cerca solo in inglese: una mappa italiana→inglese di circa 180 cibi ricorrenti traduce la query. Se la voce manca, la query italiana viene passata così com'è; se non produce risultati utili, resta la creazione manuale.
- La chiave USDA arriva dal secret `USDA_API_KEY`. Se manca, `source=usda` risponde 503 con `code: "usda_not_configured"` e l'interfaccia mostra un messaggio; Open Food Facts resta funzionante.
- Normalizzazione USDA per 100 g: energia 208 o 957, proteine 203, carboidrati 205, grassi 204, fibre 291, zuccheri 269 o 269.3, sodio 307 da cui sale = mg × 0.0025. Nutriente assente = `null`, mai zero. Porzione da `servingSize` quando in grammi.
- Risposte USDA trimmate ai soli campi usati; cache D1 delle query per 7 giorni. Su errore o limite si serve la cache scaduta se presente, altrimenti un errore leggibile; nessun retry aggressivo.
- Un errore USDA non annulla la ricerca Open Food Facts, che è una richiesta separata.
- Attribuzione nel Profilo: "Fonte alimenti semplici: USDA FoodData Central (CC0)".

Fuori scope:
- barcode, traduzione automatica dei nomi dei risultati, fusione o scelta automatica tra fonti, import della mappa da database.

## Acceptance criteria
- [x] Il selettore accanto alla ricerca ha "Alimenti semplici" come default e "Prodotti confezionati" come alternativa.
- [x] Cambiare fonte rilancia la ricerca corrente sulla fonte scelta.
- [x] `source=usda` interroga solo USDA; `source=off` interroga solo Open Food Facts; `source` assente vale `off`.
- [x] La query "mela" produce risultati USDA usando l'alias `apple`.
- [x] Una voce assente dalla mappa viene passata a USDA così com'è, senza errore.
- [x] Senza `USDA_API_KEY`, `source=usda` risponde 503 con codice leggibile e nessuna chiamata esterna.
- [x] La normalizzazione produce i valori attesi su una fixture USDA nota, incluso il sale derivato dal sodio.
- [x] Un nutriente assente nella fixture è `null` e non `0`.
- [x] La cache evita una seconda chiamata per la stessa query entro 7 giorni e conserva solo campi usati.
- [x] Il Profilo mostra l'attribuzione USDA.
- [x] `npm test`, `npm run type-check` e `npm run build` passano.

## Choices
- decisione: selettore di fonte al posto della ricerca parallela con due gruppi.
  rationale: scelta esplicita dell'utente; rende esplicita la fonte e consente di risparmiare chiamate.
  alternatives_rejected: interrogare entrambe le fonti a ogni ricerca e mostrare due gruppi.
  evidence: richiesta utente del 2026-11-05, successiva al grilling Q32=B.
- decisione: mappa italiana→inglese nel codice, circa 180 voci, revisionabile.
  rationale: evita una seconda UI di amministrazione e copre i cibi ricorrenti; se manca una voce resta la creazione manuale.
  alternatives_rejected: tabella modificabile dall'app; nessuna mappa.
  evidence: grilling Q33=A.
- decisione: USDA con chiave gratuita come secret, disattivabile senza rompere l'app.
  rationale: la chiave è un prerequisito umano e non deve bloccare lo sviluppo.
  alternatives_rejected: DEMO_KEY in produzione (limiti bassi e non affidabili).
  evidence: grilling Q34; report API, limiti 1.000/ora.
