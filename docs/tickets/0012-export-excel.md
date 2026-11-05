---
id: TICKET-0012
title: Esportare il diario in Excel
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0008]
blocks: []
source: docs/spec/0001-diario-alimentare-v1.md
github: 12
---

## Brief (AGENT-BRIEF)
L'utente deve poter scaricare i propri dati in un file `.xlsx` per analizzarli in un foglio di calcolo, scegliendo un intervallo di date.

Comportamento richiesto:
- `GET /api/export?from=&to=` restituisce, per l'utente autenticato, le voci dei pasti non cancellati nell'intervallo e i totali per giorno. Le date sono quelle locali del diario; le voci includono data, tipo pasto, alimento, grammi, kcal, proteine, carboidrati, grassi, fibre, zuccheri, sale e fonte.
- Il file `.xlsx` è generato nel browser con SheetJS; nessun file viene generato o conservato dal server.
- Intervallo predefinito: mese corrente. Date non valide o `from` successivo a `to` producono 400.
- Due fogli: "pasti" con una riga per voce e le colonne concordate; "giorni" con una riga per giorno, kcal totali, target corrente e scostamento, totali dei macro.
- I pasti cancellati sono esclusi. Un intervallo senza dati produce comunque un file valido con le intestazioni.
- Il target usato nel foglio "giorni" è quello corrente del profilo.
- L'azione di export è nel Profilo; al termine il file viene scaricato con un nome che contiene l'intervallo.

Fuori scope:
- generazione server-side, CSV o altri formati, grafici, export dei preferiti o del profilo come fogli separati.

## Acceptance criteria
- [ ] `GET /api/export` restituisce solo le voci dei pasti non cancellati dell'utente nell'intervallo richiesto.
- [ ] Un pasto cancellato non compare in nessun foglio.
- [ ] Il foglio "pasti" ha una riga per voce con tutte le colonne concordate.
- [ ] Il foglio "giorni" ha una riga per giorno con kcal totali, target corrente, scostamento e totali macro.
- [ ] Il file generato si apre in un lettore `.xlsx` e contiene i due fogli con le intestazioni attese.
- [ ] Con intervallo senza dati il file è valido e contiene solo le intestazioni.
- [ ] `from` successivo a `to` o una data non valida producono 400.
- [ ] L'intervallo predefinito è il mese corrente.
- [ ] `npm test`, `npm run type-check` e `npm run build` passano.

## Choices
- decisione: file generato lato client con SheetJS.
  rationale: il Worker non deve produrre né trasportare un file binario; il browser ha già i dati in JSON.
  alternatives_rejected: generazione nel Worker; CSV (perde i due fogli).
  evidence: grilling Q15.
- decisione: due fogli, "pasti" e "giorni", senza foglio profilo.
  rationale: il dettaglio e il riepilogo coprono l'analisi; i target sono già nelle colonne del riepilogo.
  alternatives_rejected: un unico foglio; aggiungere il profilo.
  evidence: grilling Q15/Q25.
- decisione: target corrente in ogni riga del foglio "giorni".
  rationale: è la conseguenza accettata del target unico nel profilo.
  alternatives_rejected: target storico per giorno (richiederebbe lo storico dei target).
  evidence: grilling Q19=A, Q25.
