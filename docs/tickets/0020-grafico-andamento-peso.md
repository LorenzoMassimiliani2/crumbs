---
id: TICKET-0020
title: Grafico dell'andamento del peso
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0019]
blocks: []
source: docs/spec/0003-peso-andamento.md
github: 20
---

## Brief (AGENT-BRIEF)
La tab Peso deve mostrare l'andamento del peso nel tempo con un grafico leggibile da telefono, senza aggiungere librerie di charting.

Comportamento richiesto:
- Grafico a linea con punti, disegnato in SVG, che usa le misure già caricate dalla tab Peso.
- Selettore del periodo: 30, 90, 365 giorni e tutto; default 90 giorni. Il grafico mostra solo le misure del periodo.
- Asse Y con margine automatico attorno ai valori del periodo, così le variazioni sono leggibili senza partire da zero; con una sola misura il grafico resta leggibile.
- Ogni punto espone data e peso in modo accessibile (etichetta o tooltip nativo).
- Il grafico si aggiorna quando la lista delle misure cambia (nuova misura, modifica, eliminazione da TICKET-0021) e si adatta alla larghezza del contenitore.
- Con periodo senza misure mostra uno stato vuoto, non un grafico rotto.

Interfacce:
- Una funzione pura `weightChartModel(entries, period, today)` restituisce i punti filtrati e le scale X/Y normalizzate per il disegno; il componente si limita a renderizzarli.
- La vista Peso continua a usare `GET /api/weights` come fonte unica; il filtro del periodo è lato client.

Fuori scope:
- librerie di charting, zoom o pan;
- linea di obiettivo peso;
- export del grafico o dei dati;
- modifiche alle API.

## Acceptance criteria
- [ ] La tab Peso mostra un grafico SVG a linea con punti delle misure caricate.
- [ ] Il selettore offre 30, 90, 365 giorni e tutto; il default è 90.
- [ ] Cambiando periodo il grafico mostra solo le misure del periodo.
- [ ] L'asse Y parte con un margine attorno ai valori, non da zero.
- [ ] Con una sola misura il grafico resta leggibile (punto visibile e scala sensata).
- [ ] Ogni punto espone data e peso in modo accessibile.
- [ ] Il grafico si aggiorna dopo una nuova misura senza ricaricare la pagina.
- [ ] Un periodo senza misure mostra uno stato vuoto.
- [ ] Nessuna libreria di charting viene aggiunta a dipendenze o bundle.
- [ ] La funzione del modello del grafico è coperta da test puri su filtro, scale e margine.

## Choices

- **Modello puro in `src/lib/weight.ts`: `weightChartModel(entries, period, today)` restituisce `points` con `x`/`y` normalizzati 0–1 e dominio Y `yMin`/`yMax` già con margine.**
  - rationale: il componente deve solo mappare 0–1 sul rettangolo del grafico; filtro, scala e margine restano verificabili senza DOM al seam puro indicato dalla spec.
  - alternatives_rejected: coordinate SVG già in pixel nel modello (accoppia la geometria al layout); calcolare scale dentro il componente (non testabile).
  - evidence: `src/lib/weight.test.ts`, descrizione `weightChartModel`.

- **Periodo numerico = finestra `[today - (period - 1), today]`, estremi inclusi; `'all'` va dalla prima all'ultima misura.**
  - rationale: "30 giorni" include oggi e i 29 precedenti, quindi 30 date; una misura futura resta fuori dal grafico ma continua a comparire in riepilogo e lista.
  - alternatives_rejected: solo limite inferiore (una data futura allungherebbe la finestra e altererebbe la scala X); escludere anche oggi (perderebbe la misura corrente).
  - evidence: test "keeps only measurements of the last N days, sorted and excluding the future".

- **X proporzionale alla data reale, non all'indice della misura; con una sola misura il punto è centrato (`x = 0.5`).**
  - rationale: il grafico rappresenta il tempo, non la sequenza; una singola misura non ha un inizio/fine significativi e va mostrata al centro.
  - alternatives_rejected: spaziatura uniforme tra le misure (distorce i vuoti temporali); punto al bordo destro con una sola misura (meno leggibile).
  - evidence: test "positions points on the period window from the first day to today" e "centres a single measurement".

- **Margine Y automatico = 15% dell'escursione, minimo 0,5 kg; con una sola misura dominio `peso ± 0,5 kg` e punto a metà altezza.**
  - rationale: le variazioni restano visibili senza partire da zero e la scala non degenera quando tutti i valori coincidono.
  - alternatives_rejected: margine fisso in kg (troppo grande per variazioni piccole, troppo piccolo per grandi); asse da zero (richiesto esplicitamente di evitarlo).
  - evidence: test "adds a margin around the values instead of starting from zero" e "centres a single measurement with a readable scale".

- **Componente separato `src/components/WeightChart.vue` con stato del periodo interno (default 90) e props `entries`/`today`.**
  - rationale: la vista passa la lista già caricata e il grafico si aggiorna in modo reattivo dopo salvataggio, senza nuove fetch; il selettore resta locale al grafico.
  - alternatives_rejected: grafico e selettore dentro `WeightView` (mescola responsabilità e rende i test della vista più rumorosi); ricaricare le misure dal grafico (seconda fonte di verità).
  - evidence: `src/components/WeightChart.test.ts`, `src/views/WeightView.test.ts`.

- **SVG con `viewBox="0 0 320 180"` e classi `w-full h-auto`, senza librerie di charting.**
  - rationale: scala in modo uniforme con la larghezza del contenitore mantenendo punti circolari; nessuna dipendenza nel bundle.
  - alternatives_rejected: `preserveAspectRatio="none"` (deforma cerchi e spessori); canvas (meno accessibile e non testabile nel DOM).
  - evidence: `npm run build` senza nuove dipendenze; `src/components/WeightChart.test.ts`.

- **Accessibilità: SVG `role="img"` con `aria-label`, `<title>` nativo su ogni punto, `aria-pressed` sui pulsanti del periodo.**
  - rationale: soddisfa "etichetta o tooltip nativo" e rende il selettore comprensibile agli screen reader senza JS aggiuntivo.
  - alternatives_rejected: tooltip custom con stato e posizionamento (complessità non richiesta); tabella nascosta duplicata (dati già nella lista).
  - evidence: test sui `<title>` dei punti e su `aria-pressed`.

- **Periodo senza misure: messaggio "Nessuna misura nel periodo selezionato."; registro completamente vuoto: resta lo stato vuoto globale della vista e il grafico non viene montato.**
  - rationale: evita due stati vuoti sovrapposti e non mostra un grafico senza dati.
  - alternatives_rejected: mostrare sempre il grafico con assi vuoti (sembra rotto); nascondere il selettore quando il periodo è vuoto (impedirebbe di cambiare periodo).
  - evidence: test "shows an empty state when the selected period has no measurements".

| Il margine minimo dell'asse Y è 0,5 kg anche con escursioni piccole | Corregge il finding della review: il ticket chiedeva almeno 0,5 kg, non solo per escursione nulla | Applicare il minimo solo al caso a misura singola | `Math.max((max - min) * 0.15, 0.5)`; test con 78–80 kg → 77,5–80,5 |
