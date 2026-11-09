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
