---
id: TICKET-0008
title: Registrare i pasti e vedere il giorno
status: ready-for-agent
category: enhancement
blocked_by: [TICKET-0007]
blocks: [TICKET-0009, TICKET-0010, TICKET-0012]
source: docs/spec/0001-diario-alimentare-v1.md
github: 8
---

## Brief (AGENT-BRIEF)
L'utente deve poter registrare un pasto composto da più alimenti con le quantità in grammi, vederlo nel giorno corretto e confrontare il consumo con il target. In questo ticket gli alimenti si inseriscono a mano o si riusano dai preferiti già salvati; la ricerca esterna arriva dopo.

Comportamento richiesto:
- `GET /api/days/:date` restituisce, per l'utente autenticato, il target kcal corrente, i totali del giorno e i pasti non cancellati in ordine cronologico. Ogni pasto espone tipo, `occurredAt`, `localDate`, nota, totali e voci; ogni voce espone nome, fonte, marca, grammi, valori per 100 g e valori calcolati.
- `POST /api/meals` crea pasto e voci in modo atomico. Corpo: `occurredAt` ISO UTC, `localDate` `YYYY-MM-DD`, tipo tra i sei ammessi, nota opzionale, elenco di voci con nome, fonte, `sourceId` opzionale, marca opzionale, grammi e valori per 100 g di kcal, proteine, carboidrati, grassi, fibre, zuccheri e sale.
- I totali sono calcolati dal server dai valori per 100 g e dai grammi; il client non li invia.
- Ogni voce congela i valori per 100 g al salvataggio (snapshot). Modifiche future ai preferiti non cambiano i pasti già salvati.
- Ogni alimento inserito viene salvato o aggiornato nei preferiti dell'utente, con deduplica per `(user_id, source, source_id)` e, in assenza di `source_id`, per nome normalizzato; `last_used_at` viene aggiornato.
- `PUT /api/meals/:id` sostituisce tipo, nota e voci del pasto in modo atomico, ricalcolando i totali dai valori ricevuti. `DELETE /api/meals/:id` imposta `deleted_at`; il pasto sparisce dal giorno e non è più modificabile.
- Validazione: tipo ammesso, grammi > 0 e ≤ 5000, valori per 100 g ≥ 0, `localDate` e `occurredAt` ISO validi, da 1 a 50 voci. Un errore restituisce 400 e non scrive nulla.
- Interfaccia "Oggi": riepilogo con kcal consumate, target e scostamento; proteine, carboidrati e grassi in grammi e percentuale delle kcal, senza barre con target di macro. Pasti in sezioni con orario, voci, note e kcal per pasto. Frecce precedente/successivo e selezione data da calendario. Stato vuoto per giorni senza pasti.
- Flusso di aggiunta: schermata intera con tipo di pasto proposto dall'ora (finestre 05:00–10:30, 10:30–12:00, 12:00–15:00, 15:00–18:00, 18:00–22:00, 22:00–05:00) e sempre modificabile; elenco dei preferiti filtrabile localmente mentre si digita; creazione manuale di un alimento con nome e valori per 100 g; bozza con più alimenti, grammi modificabili, totale aggiornato; salvataggio atomico con una sola richiesta.
- Modifica di un pasto passato con lo stesso flusso; eliminazione con conferma.
- L'app resta online-only: nessuna coda offline.

Fuori scope:
- ricerca su fonti esterne, modifica ed eliminazione dei preferiti come funzione dedicata, export, statistiche, storico del peso, barcode, offline.

## Acceptance criteria
- [ ] Creare un pasto con 150 g di un alimento da 356 kcal, 12 g proteine, 70 g carboidrati e 1,5 g grassi per 100 g restituisce 534 kcal, 18 g proteine, 105 g carboidrati e 2,25 g grassi.
- [ ] Se una voce non è valida, `POST /api/meals` restituisce 400 e non crea né pasto né voci né preferiti.
- [ ] `GET /api/days/:date` restituisce solo i pasti non cancellati dell'utente, ordinati per `occurred_at`, con totali coerenti con le voci.
- [ ] `occurredAt` è memorizzato in UTC e `localDate` resta la data locale inviata dal client.
- [ ] `PUT /api/meals/:id` sostituisce le voci e ricalcola i totali senza chiamare fonti esterne.
- [ ] `DELETE /api/meals/:id` rende il pasto invisibile al giorno e all'elenco, e una seconda cancellazione è innocua.
- [ ] Un alimento usato in un pasto compare nei preferiti; lo stesso alimento con la stessa fonte e id esterno non viene duplicato.
- [ ] Modificare i grammi e salvare un pasto esistente cambia i totali del giorno in modo coerente.
- [ ] La vista Oggi mostra riepilogo, pasti, orari, note e voci; le frecce e il calendario cambiano giorno.
- [ ] Il flusso di aggiunta propone il tipo corretto per ciascuna finestra oraria e permette di cambiarlo.
- [ ] La bozza accetta più alimenti, aggiorna il totale a ogni modifica dei grammi e si salva con una sola richiesta.
- [ ] Un alimento creato a mano senza ricerca esterna è salvabile e riutilizzabile dai preferiti.
- [ ] Un errore del server durante il salvataggio lascia la bozza intatta e mostra un messaggio comprensibile.
- [ ] Tutte le rotte rispondono 401 senza credenziale valida.
- [ ] `npm test`, `npm run type-check` e `npm run build` passano.

## Choices
- decisione: i totali sono calcolati dal server e restituiti dal giorno; il client mostra, non ricalcola come fonte di verità.
  rationale: un solo posto per l'aritmetica evita divergenze tra viste ed export.
  alternatives_rejected: calcolo solo client (export e API potrebbero divergere).
  evidence: spec 0001; prototipo variante A.
- decisione: `PUT` sostituisce l'intero pasto invece di fare patch per singola voce.
  rationale: la bozza è già una lista completa; una sola operazione atomica è più semplice da validare.
  alternatives_rejected: patch per voce con operazioni separate.
  evidence: grilling Q16; spec 0001.
- decisione: snapshot per 100 g nelle voci, con `food_id` solo come provenienza.
  rationale: lo storico non deve cambiare quando si corregge un preferito o cambiano le API.
  alternatives_rejected: join live con i preferiti.
  evidence: grilling Q13/Q20; spec 0001.
- decisione: salvataggio atomico della bozza, non per singolo alimento.
  rationale: evita pasti a metà e rende l'annullamento banale.
  alternatives_rejected: salvataggio immediato per alimento.
  evidence: grilling Q16.
- decisione: online-only.
  rationale: la coda offline è una feature con conflitti e stati d'errore che va dopo la stabilizzazione del modello dati.
  alternatives_rejected: IndexedDB con sincronizzazione in v1.
  evidence: grilling Q7.
