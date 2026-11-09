---
id: SPEC-0004
title: Andamento calorico nel Diario
status: approved
source: docs/features/FEAT-0003-andamento-calorico.md
---

# Andamento calorico nel Diario

## Problem Statement

La pagina Diario conosce solo il giorno selezionato: vedo le kcal di oggi, poi quelle di ieri, ma non riesco a capire la direzione nel tempo. Per confrontare giorni, settimane o mesi dovrei cambiarli uno a uno e ricordarmi i numeri.

Voglio una sezione **Andamento** nella stessa pagina, con barre delle kcal e la linea del target, per vedere a colpo d'occhio se sto mangiando sopra o sotto l'obiettivo e come cambia la media nel tempo. Il diario resta il contenuto principale: l'andamento si apre e si chiude.

## Solution

Una vista dedicata **Andamento**, aperta dall'icona nel riepilogo del giorno, con la vista **Giorno** attiva di default. Dalla vista si torna al Diario.

- **Giorno**: 14 giorni che terminano oggi, una barra per giorno. Toccando una barra si apre quel giorno nel Diario.
- **Settimana**: 8 settimane (lunedì–domenica) che terminano con quella corrente, una barra per settimana con la **media giornaliera** delle kcal dei giorni con pasti.
- **Mese**: 12 mesi che terminano con quello corrente, una barra per mese con la **media giornaliera**.
- Linea orizzontale del **target attuale**, etichettata come tale.
- Riepilogo: media del periodo, giorni con pasti sui giorni trascorsi, variazione rispetto al periodo precedente quando entrambi hanno dati.
- Giorni senza pasti: nessuna barra e fuori dalla media. Giorni futuri esclusi.
- La vista scelta è ricordata per la sessione.
- Grafico SVG senza librerie.

I dati arrivano da un unico endpoint di aggregazione per intervallo, con una sola richiesta per popolare la vista attiva.

## User Stories

1. Come proprietario, voglio aprire l'Andamento da un'icona nella pagina Diario, così da confrontare i giorni senza cercare un'altra tab.
2. Come proprietario, voglio tornare al Diario dalla vista Andamento, così che il diario resti il contenuto principale.
3. Come proprietario, voglio che la vista Andamento si apra sulla Giorno, così da vedere subito gli ultimi giorni.
4. Come proprietario, voglio passare tra Giorno, Settimana e Mese, così da cambiare scala di osservazione.
5. Come proprietario, voglio che la vista scelta resti attiva durante la sessione, così da non riselezionarla ogni volta.
6. Come proprietario, voglio vedere le kcal degli ultimi 14 giorni come barre, così da confrontare giorni vicini.
7. Come proprietario, voglio vedere una barra per settimana con la media giornaliera, così da confrontare settimane di lunghezza simile con il target.
8. Come proprietario, voglio vedere una barra per mese con la media giornaliera, così da leggere la tendenza lunga.
9. Come proprietario, voglio una linea del target kcal, così da capire a colpo d'occhio se sono sopra o sotto.
10. Come proprietario, voglio che il target sia etichettato come attuale, così da sapere che non è lo storico.
11. Come proprietario, voglio che i giorni senza pasti non abbiano barra, così da non confondere l'assenza di dati con zero kcal.
12. Come proprietario, voglio che i giorni futuri siano esclusi, così che il grafico non mostri barre vuote in avanti.
13. Come proprietario, voglio che le medie considerino solo i giorni con pasti, così da non abbassare la media nei giorni non registrati.
14. Come proprietario, voglio vedere la media del periodo, così da avere un numero sintetico oltre alle barre.
15. Come proprietario, voglio vedere quanti giorni ho registrato sul totale trascorso, così da sapere quanto è affidabile la media.
16. Come proprietario, voglio vedere la variazione rispetto al periodo precedente, così da capire se la media sta salendo o scendendo.
17. Come proprietario, voglio che la variazione compaia solo se entrambi i periodi hanno dati, così da non mostrare confronti inventati.
18. Come proprietario, voglio toccare una barra dei giorni e aprire quel giorno nel Diario, così da passare dal trend al dettaglio.
19. Come proprietario, voglio un tooltip su ogni barra con periodo, media e giorni registrati, così da leggere il valore esatto.
20. Come proprietario, voglio uno stato vuoto quando il periodo non ha dati, così da capire che non c'è nulla da mostrare.
21. Come proprietario, voglio che il grafico sia leggibile da telefono, così da usarlo nel contesto quotidiano.
22. Come proprietario, voglio che le etichette sull'asse X non si sovrappongano, così da leggere date e periodi.
23. Come sviluppatore, voglio una sola richiesta per intervallo invece di una per giorno, così da non moltiplicare le chiamate.
24. Come sviluppatore, voglio che l'aggregazione avvenga nel Worker, così che il client riceva solo i giorni con dati.
25. Come sviluppatore, voglio che le kcal di un giorno nel trend coincidano con il totale mostrato nel Diario, così da non avere due verità.
26. Come sviluppatore, voglio che il calcolo dei bucket (giorno, settimana, mese) sia una funzione pura testabile, così da verificare medie e periodi senza DOM.
27. Come sviluppatore, voglio che il trend sia privato come il resto dei dati, così da non esporre kcal di altri utenti.
28. Come sviluppatore, voglio che l'export e le viste esistenti restino invariati, così da non introdurre regressioni.

## Acceptance Criteria

### API

- [ ] `GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` restituisce `{ targetKcal, days }`, con `days` ordinato per data crescente.
- [ ] `days` contiene una voce `{ date, kcal, meals }` solo per i giorni con almeno un pasto non cancellato dell'utente.
- [ ] `meals` è il numero di pasti non cancellati del giorno.
- [ ] Per ogni giorno, `kcal` coincide con `totals.kcal` restituito da `GET /api/days/:date` per la stessa data.
- [ ] `targetKcal` è il target attuale del profilo, oppure `null` se il profilo non lo ha.
- [ ] Date non reali, `from > to` o un intervallo superiore a 800 giorni restituiscono 400.
- [ ] La rotta richiede la credenziale esistente, filtra per `user_id` e non espone dati di altri utenti.
- [ ] Il Worker esegue l'aggregazione nell'intervallo richiesto; il client non fa una richiesta per giorno.

### Sezione Andamento

- [ ] Il riepilogo del giorno in Diario contiene un'icona che apre la vista dedicata Andamento; la vista ha un comando per tornare al Diario.
- [ ] La vista Andamento si apre sulla Giorno di default.
- [ ] Il selettore offre Giorno, Settimana e Mese; il default è Giorno.
- [ ] La vista scelta resta attiva durante la sessione e non viene persistita sul database.
- [ ] La vista Giorno mostra 14 barre, una per ciascuno degli ultimi 14 giorni che ha pasti; i giorni senza pasti non hanno barra.
- [ ] La vista Settimana mostra fino a 8 barre, una per settimana lunedì–domenica; ogni barra è la media delle kcal dei giorni con pasti della settimana.
- [ ] La settimana corrente considera solo i giorni fino a oggi.
- [ ] La vista Mese mostra fino a 12 barre, una per mese; ogni barra è la media delle kcal dei giorni con pasti del mese.
- [ ] Nessun giorno futuro produce barre o entra nelle medie.
- [ ] La linea del target usa `targetKcal` ed è etichettata come target attuale; se `targetKcal` è null non viene disegnata.
- [ ] Il riepilogo mostra media del periodo, giorni con pasti sul numero di giorni trascorsi e variazione rispetto al periodo precedente quando entrambi i periodi hanno almeno un giorno con pasti.
- [ ] La variazione non compare se manca uno dei due periodi.
- [ ] Un periodo senza giorni con pasti mostra uno stato vuoto al posto del grafico.
- [ ] Il grafico è SVG, con barre, linea del target, etichette leggibili e tooltip accessibile per ogni barra.
- [ ] Un pannello Opzioni nella vista Andamento permette di scegliere barre o linea, mostrare/nascondere la linea del target e i valori sopra le barre; le scelte restano attive durante la sessione.
- [ ] Il tocco su una barra della vista Giorno seleziona quel giorno nel Diario e aggiorna i pasti mostrati.
- [ ] Nelle viste Settimana e Mese il tocco non cambia il giorno selezionato.

### Definizione dei periodi

- [ ] Giorno: intervallo di 14 giorni che termina oggi; periodo precedente = i 14 giorni immediatamente precedenti.
- [ ] Settimana: 8 settimane di calendario che terminano con quella corrente; periodo precedente = le 8 settimane immediatamente precedenti.
- [ ] Mese: 12 mesi di calendario che terminano con quello corrente; periodo precedente = i 12 mesi immediatamente precedenti.
- [ ] Per il confronto, il client richiede un unico intervallo che copre periodo corrente e precedente, entro il limite di 800 giorni.

## Seams

- Highest seam: rotte HTTP del Worker con D1 reale e migrazioni applicate (seam esistente). Verifica aggregazione, filtri utente, giorni cancellati, conteggio pasti, target e validazioni.
- Seam puro: `src/lib/stats.ts` con le definizioni dei periodi e `buildTrend(days, view, today)` che produce bucket, medie, conteggi e modello del grafico. È il punto più alto per verificare Giorno/Settimana/Mese, giorni mancanti, settimana corrente parziale, media e variazione senza DOM.
- Seam frontend: mount di `HomeView` (icona di ingresso), di `TrendView` con router e `fetch` intercettato al confine di rete, e del componente grafico; verifica di selettore, barre, target, riepilogo, stato vuoto, ritorno al Diario e tocco che seleziona il giorno.
- Nessun nuovo seam per l'export: non viene toccato.
- Nessuna migrazione: l'aggregazione legge `meals` e `meal_items` esistenti.
