---
id: TICKET-0011
title: Aggiungere il fallback USDA per gli alimenti generici
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0010, TICKET-0013]
blocks: []
source: docs/spec/0001-diario-alimentare-v1.md
github: 11
---

## Brief (AGENT-BRIEF)
Cercando "mela" Open Food Facts restituisce prodotti di marca, non la mela generica. Questo ticket aggiunge USDA FoodData Central come seconda fonte, interrogata in parallelo, per coprire gli alimenti di base in italiano.

Comportamento richiesto:
- La ricerca esterna interroga Open Food Facts e USDA in parallelo per ogni query valida, e restituisce due gruppi separati: `off` (prodotti confezionati) e `usda` (alimenti generici). Nessuna fusione dei valori e nessun risultato duplicato tra i gruppi.
- USDA cerca solo in inglese: una mappa italiana→inglese di circa 150 cibi ricorrenti (pasta, riso, pane, carne, pesce, uova, latticini, legumi, verdure, frutta, condimenti) traduce la query. Se la voce manca, la query italiana viene passata così com'è; se non produce risultati utili, resta la creazione manuale.
- La chiave USDA arriva dal secret `USDA_API_KEY`. Se manca, il gruppo `usda` non viene interrogato, l'interfaccia mostra "Alimenti generici non configurati" e tutto il resto continua a funzionare.
- Normalizzazione USDA per 100 g: energia 208 o 957, proteine 203, carboidrati 205, grassi 204, fibre 291, zuccheri 269 o 269.3, sodio 307 da cui sale = mg × 0.0025. Porzione da `servingSize` quando presente. Nutriente assente = `null`, mai zero.
- Le risposte USDA sono trimmate ai soli sette nutrienti prima di essere salvate; la cache segue le stesse regole del ticket Open Food Facts (query 7 giorni, alimento 30).
- Un errore o un limite di USDA non annulla i risultati Open Food Facts: il gruppo `usda` torna vuoto e l'interfaccia lo segnala.
- Interfaccia: gruppo "Alimenti generici" sotto i confezionati, con nome originale, fonte USDA e kcal per 100 g; un tocco aggiunge alla bozza. Il nome originale può essere rinominato modificando il preferito.
- Attribuzione nel Profilo: "Fonte alimenti generici: USDA FoodData Central (CC0)".

Fuori scope:
- barcode, traduzione automatica dei nomi dei risultati, fusione o scelta automatica tra fonti, import della mappa da database.

## Acceptance criteria
- [ ] La query "mela" produce risultati nel gruppo `usda` usando l'alias `apple`.
- [ ] La query "pasta" produce risultati nel gruppo `usda`.
- [ ] Una voce assente dalla mappa viene passata a USDA così com'è, senza errore.
- [ ] Senza `USDA_API_KEY` il gruppo `usda` non viene interrogato e l'interfaccia mostra il messaggio di mancata configurazione.
- [ ] Con USDA in errore, i risultati Open Food Facts vengono restituiti comunque.
- [ ] La normalizzazione produce i valori attesi su una fixture USDA nota, incluso il sale derivato dal sodio.
- [ ] Un nutriente assente nella fixture è `null` e non `0`.
- [ ] I due gruppi sono separati e nessun risultato mescola valori di fonti diverse.
- [ ] La cache evita una seconda chiamata per la stessa query entro 7 giorni.
- [ ] Il Profilo mostra l'attribuzione USDA.
- [ ] `npm test`, `npm run type-check` e `npm run build` passano.

## Choices
- decisione: interrogare le due fonti in parallelo a ogni ricerca, invece di un fallback solo su zero risultati.
  rationale: Open Food Facts restituisce quasi sempre qualcosa, anche per query generiche; il fallback condizionale non coprirebbe "mela".
  alternatives_rejected: USDA solo se OFF è vuoto; interruttore manuale "cerca generici".
  evidence: grilling Q32=B; report API, test della query "mela".
- decisione: mappa italiana→inglese nel codice, circa 150 voci, revisionabile.
  rationale: evita una seconda UI di amministrazione e copre i cibi ricorrenti; se manca una voce resta la creazione manuale.
  alternatives_rejected: tabella modificabile dall'app; nessuna mappa.
  evidence: grilling Q33=A.
- decisione: USDA con chiave gratuita come secret, disattivabile senza rompere l'app.
  rationale: la chiave è un prerequisito umano e non deve bloccare lo sviluppo.
  alternatives_rejected: DEMO_KEY in produzione (limiti bassi e non affidabili).
  evidence: grilling Q34; report API, limiti 1.000/ora.
