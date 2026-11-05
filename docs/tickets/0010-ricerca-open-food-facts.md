---
id: TICKET-0010
title: Cercare prodotti confezionati su Open Food Facts
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0008]
blocks: [TICKET-0011]
source: docs/spec/0001-diario-alimentare-v1.md
github: 10
---

## Brief (AGENT-BRIEF)
L'utente deve poter cercare un prodotto confezionato in italiano e aggiungerlo al pasto con i valori nutrizionali della confezione, correggibili.

Comportamento richiesto:
- `GET /api/foods/search?q=` accetta una query di almeno 3 caratteri e interroga Open Food Facts (Search-a-licious) con `langs=it,en` e campi espliciti. Restituisce un gruppo `off` di risultati normalizzati.
- La ricerca non parte a ogni tasto: il client la lancia su invio o dopo una pausa, mai per ogni carattere.
- Solo i risultati con kcal presente vengono mostrati, al massimo 10. Ordine per rilevanza della fonte.
- Prima di aggiungere un prodotto, il client chiede i dati correnti del prodotto per codice a barre (`GET /api/foods/off/:code`), normalizzati: kcal da `energy-kcal` oppure da kJ/4.184, proteine, carboidrati, grassi, fibre, zuccheri, sale (o sodio × 2.5 quando manca il sale), porzione se disponibile.
- Un nutriente assente è `null`, mai zero. Uno zero è valido solo se la fonte lo dichiara.
- Ogni risposta esterna è trimmata ai soli campi usati prima di essere salvata.
- Cache D1: risultati di ricerca per 7 giorni, prodotto per 30 giorni. Su 429 o 503 si serve la cache scaduta se esiste, altrimenti si restituisce un errore comprensibile; nessun retry aggressivo.
- Le richieste a Open Food Facts usano uno User-Agent `Crumbs/0.1 (<ALLOWED_EMAIL>)`.
- Interfaccia: dopo la ricerca, i risultati compaiono nel gruppo "Prodotti confezionati" con nome, marca e kcal per 100 g; un tocco aggiunge l'alimento alla bozza; la fonte è visibile. Nel Profilo compare l'attribuzione "Dati da Open Food Facts (ODbL)" con link.
- La sezione generici non è ancora presente: il gruppo USDA arriva nel ticket successivo.

Fuori scope:
- USDA e alimenti generici, barcode e scanner, fusione di fonti, rinomina dei risultati (resta possibile modificando il preferito).

## Acceptance criteria
- [ ] Una query di 2 caratteri non produce alcuna chiamata esterna; una di 3 o più produce risultati dal gruppo `off`.
- [ ] I risultati restituiti hanno sempre kcal presente e sono al massimo 10.
- [ ] La normalizzazione mappa correttamente kcal, proteine, carboidrati, grassi, fibre, zuccheri e sale su una fixture di prodotto nota.
- [ ] Un nutriente assente nella fixture è `null` e non `0`.
- [ ] Il sale viene derivato dal sodio quando il sale manca.
- [ ] La seconda ricerca della stessa query entro 7 giorni è servita dalla cache e non chiama la fonte.
- [ ] Con risposta 429 e cache scaduta presente, l'API restituisce i dati in cache; senza cache restituisce un errore leggibile.
- [ ] Le risposte salvate in cache non contengono campi non usati.
- [ ] Lo User-Agent inviato alla fonte contiene il nome dell'app e l'email configurata.
- [ ] L'interfaccia mostra il gruppo "Prodotti confezionati" e aggiunge il prodotto selezionato alla bozza.
- [ ] Il Profilo mostra l'attribuzione Open Food Facts con link.
- [ ] `npm test`, `npm run type-check` e `npm run build` passano.

## Choices
- decisione: Open Food Facts come fonte primaria per i confezionati.
  rationale: gratuita e senza chiave, migliore copertura italiana tra i candidati, barcode nativo, valori per 100 g con sale; limiti 10 ricerche/minuto e 15 letture/minuto gestibili con cache e debounce.
  alternatives_rejected: Edamam e Nutritionix (nessun free tier), FatSecret (barcode e italiano Premier, caching vietato), CalorieNinjas (italiano non verificato, niente barcode).
  evidence: ricerca sulle fonti ufficiali del 2026-11-05, report di ricerca del 2026-11-05.
- decisione: ricerca su invio o dopo pausa, non a ogni tasto.
  rationale: la documentazione di Open Food Facts vieta esplicitamente la ricerca mentre si digita.
  alternatives_rejected: debounce breve a ogni carattere (consuma il limite e rischia blocchi).
  evidence: report API, limiti ufficiali.
- decisione: dati correnti del prodotto letti al momento della selezione, non solo dall'indice di ricerca.
  rationale: l'indice può essere vecchio; il prodotto è la fonte più aggiornata.
  alternatives_rejected: usare solo i valori dell'indice di ricerca.
  evidence: report API, sezione 4.1.
