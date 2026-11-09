---
id: SPEC-0002
title: Attività fisica nel diario
status: approved
source: docs/features/FEAT-0001-attivita-fisica.md
---

# Attività fisica nel diario

## Problem Statement

Crumbs registra cosa mangio ma non cosa faccio. Chi tiene un diario alimentare vuole annotare anche l'attività fisica della giornata — una camminata, una corsa, una sessione in palestra — e vederla nello stesso posto dei pasti, senza aprire un'altra app o tenere un foglio separato. Oggi l'unico modo sarebbe scriverlo nella nota di un pasto, dove si perde e non è né selezionabile né esportabile come attività.

L'attività è un dato di contesto, non un calcolo: non voglio calorie bruciate, non voglio che il target o il netto giornaliero cambino. Voglio solo poter dire "oggi ho camminato dalle 18:00 alle 19:00" e ritrovarlo nel diario.

## Solution

Una sezione **attività** dentro il diario esistente, con lo stesso modello dei pasti:

- il FAB in basso a destra diventa un chooser con **+ Pasto** e **+ Attività**;
- **+ Attività** apre un flusso che propone un **catalogo personale** di attività (voci predefinite più quelle create dall'utente, ordinate per ultimo utilizzo) e permette di crearne una nuova al volo;
- si inseriscono **ora di inizio** (default: adesso) e **ora di fine** (default: inizio + 1 ora), entrambe modificabili; la durata è derivata e mostrata in sola lettura;
- la voce si salva con una **nota opzionale**;
- nella vista **Oggi** pasti e attività compaiono in un'unica sequenza cronologica; le attività hanno resa compatta (nome, inizio–fine, durata) e la nota appare solo se presente;
- le voci si possono modificare e cancellare (soft delete);
- l'export `.xlsx` aggiunge un foglio **Attività**; kcal, target e totali giornalieri restano invariati.

Le voci del diario conservano uno **snapshot del nome** dell'attività: rinominare o cancellare una voce del catalogo non riscrive la storia.

## User Stories

1. Come proprietario, voglio registrare un'attività fisica nella giornata, così da avere un diario completo di cibo e movimento.
2. Come proprietario, voglio che l'attività sia solo informativa, così che il mio target calorico e il netto giornaliero restino quelli che ho scelto.
3. Come proprietario, voglio aprire il menù **+** in basso e scegliere tra **+ Pasto** e **+ Attività**, così da usare un solo gesto per entrambe le registrazioni.
4. Come proprietario, voglio vedere il flusso pasto invariato, così che l'aggiunta di questa feature non mi faccia cambiare abitudini.
5. Come proprietario, voglio scegliere l'attività da una lista, così da non riscriverne il nome ogni volta.
6. Come proprietario, voglio che la lista proponga prima le attività che uso più di recente, così da trovare in un attimo quella di oggi.
7. Come proprietario, voglio trovare un set iniziale di attività comuni (camminata, corsa, bici, palestra, nuoto, yoga, ecc.), così da avere qualcosa da selezionare al primo uso.
8. Come proprietario, voglio creare una nuova attività dal flusso di aggiunta, così da registrare uno sport non presente in lista.
9. Come proprietario, voglio modificare il nome di un'attività del catalogo, così da correggere un refuso o usare il mio termine.
10. Come proprietario, voglio cancellare un'attività dal catalogo, così da fare pulizia delle voci che non uso.
11. Come proprietario, voglio che cancellare un'attività dal catalogo non cancelli le voci già registrate nel diario, così da non perdere lo storico.
12. Come proprietario, voglio che rinominare un'attività non cambi il nome nelle voci passate, così che il diario resti veritiero.
13. Come proprietario, voglio che l'ora di inizio sia precompilata con l'ora attuale, così da registrare subito quello che ho appena fatto.
14. Come proprietario, voglio che l'ora di fine sia precompilata a un'ora dopo l'inizio, così da non doverla impostare per un'attività tipica.
15. Come proprietario, voglio poter cambiare sia l'inizio sia la fine, così da registrare un'attività fatta prima o con una durata diversa.
16. Come proprietario, voglio vedere la durata calcolata mentre modifico gli orari, così da sapere subito quanto è durata.
17. Come proprietario, voglio che un'attività che finisce dopo la mezzanotte venga salvata correttamente, così da non doverla spezzare in due.
18. Come proprietario, voglio che un'attività oltre le 12 ore mi chieda conferma, così da non salvare un errore di battitura.
19. Come proprietario, voglio aggiungere una nota libera all'attività, così da annotare contesto (es. "con il cane", "salita").
20. Come proprietario, voglio vedere le attività nel diario insieme ai pasti, così da leggere la giornata in ordine cronologico.
21. Come proprietario, voglio che le attività siano compatte, così che non occupino più spazio dei pasti.
22. Come proprietario, voglio vedere la nota di un'attività solo quando c'è, così da non avere righe vuote.
23. Come proprietario, voglio modificare un'attività salvata (nome, orari, nota), così da correggere gli errori.
24. Come proprietario, voglio cancellare un'attività salvata, così da rimuovere una registrazione sbagliata.
25. Come proprietario, voglio che le attività cancellate spariscano dal diario e dall'export, così da non vedere dati errati.
26. Come proprietario, voglio esportare le attività in un foglio del file `.xlsx`, così da analizzarle insieme ai pasti.
27. Come proprietario, voglio che l'export dei pasti e i totali kcal restino identici a prima, così da non rompere i miei fogli esistenti.
28. Come proprietario, voglio che le attività siano visibili solo a me, così come i pasti e il profilo.
29. Come sviluppatore, voglio che l'API delle attività segua le stesse regole di autenticazione e di scoping per `user_id` del resto dell'app, così da non introdurre un accesso privilegiato.
30. Come sviluppatore, voglio che la corsa del Worker e le viste siano testabili attraverso i seam esistenti, così da non aggiungere infrastruttura di test.

## Acceptance Criteria

### Catalogo

- [ ] `GET /api/activities` restituisce le attività dell'utente autenticato, ordinate per `lastUsedAt` decrescente; le voci mai usate vengono dopo, in ordine alfabetico.
- [ ] Al primo accesso al catalogo di un utente senza voci, il catalogo viene popolato con il set predefinito: Camminata, Corsa, Bicicletta, Palestra, Nuoto, Yoga, Pilates, Calcetto, Tennis, Escursione.
- [ ] `POST /api/activities` con un nome valido crea una voce e restituisce `id`, `name`, `lastUsedAt: null`; un nome vuoto o più lungo di 80 caratteri restituisce 400.
- [ ] `PATCH /api/activities/:id` rinomina una voce dell'utente; un `id` di un altro utente restituisce 404.
- [ ] `DELETE /api/activities/:id` cancella la voce dal catalogo; le voci del diario che la usavano restano con il loro `name_snapshot` e `activity_id` diventa `NULL`.
- [ ] Tutte le rotte del catalogo richiedono la credenziale esistente e filtrano per `user_id`; con `API_TOKEN` senza utente rispondono 403 come le altre rotte.

### Voci del diario

- [ ] `POST /api/activity-entries` accetta `activityId`, `localDate`, `startedAt`, `endedAt` e `note` opzionale; salva `name_snapshot` letto dal catalogo e restituisce la voce creata.
- [ ] Un'attività con `startedAt` 12:00 e `endedAt` 13:30 produce una durata di 90 minuti.
- [ ] `startedAt` e `endedAt` devono essere istanti ISO con fuso orario; un valore senza fuso, non valido o con `endedAt <= startedAt` restituisce 400.
- [ ] Una voce con durata superiore a 24 ore restituisce 400; la UI chiede conferma oltre le 12 ore ma lascia salvare fino a 24.
- [ ] `localDate` deve essere una data reale (`YYYY-MM-DD`); la voce appartiene al giorno indicato anche se `startedAt` cade in un altro fuso.
- [ ] `PUT /api/activity-entries/:id` aggiorna attività, orari e nota di una voce dell'utente; un `id` di un altro utente restituisce 404.
- [ ] `DELETE /api/activity-entries/:id` imposta `deleted_at`; la voce sparisce da `GET /api/days/:date` e dall'export, e una seconda cancellazione è idempotente.
- [ ] `GET /api/days/:date` include `activities`, ordinate per `startedAt`, con `deleted_at IS NULL`, e lascia invariati `meals`, `totals` e `targetKcal`.
- [ ] Il totale kcal del giorno non cambia quando si aggiunge, modifica o cancella un'attività.

### Interfaccia

- [ ] Il FAB apre un chooser con le azioni **+ Pasto** e **+ Attività**; **+ Pasto** apre il flusso esistente senza modifiche.
- [ ] **+ Attività** mostra i campi attività, data, ora di inizio (default ora corrente), ora di fine (default inizio + 1 ora) e nota.
- [ ] Modificare inizio o fine aggiorna la durata mostrata in sola lettura; se fine < inizio la UI tratta la fine come il giorno successivo.
- [ ] Con durata oltre 12 ore, il salvataggio richiede una conferma esplicita.
- [ ] La vista Oggi mostra pasti e attività in un'unica sequenza ordinata per orario; un'attività 12:00–13:30 compare prima di un pasto delle 13:00.
- [ ] La riga attività mostra nome, inizio–fine e durata in forma compatta; la nota compare solo se presente.
- [ ] La modifica e la cancellazione di una voce sono raggiungibili dalla vista Oggi.

### Export

- [ ] `GET /api/export` include `activities` dell'intervallo richiesto, ordinate per data e inizio, con `name`, `startedAt`, `endedAt`, durata in minuti e nota.
- [ ] Il file `.xlsx` contiene un foglio **Attività** con intestazioni: Data, Attività, Inizio, Fine, Durata (min), Nota.
- [ ] I fogli **pasti** e **giorni** e i loro valori restano identici a prima della feature.
- [ ] Le attività cancellate non compaiono nell'export.

## Seams

- Highest seam: le rotte HTTP del Worker con D1 reale e migrazioni applicate (seam già usato da TICKET-0006). Coprono catalogo, voci, `GET /api/days/:date` ed export: richiesta → dati → risposta, senza toccare i moduli interni.
- Seam frontend: mount della vista `HomeView` e del flusso `AddActivityFlow` in DOM con `fetch` intercettato al confine di rete. Si verificano chooser, campi, durata derivata, conferma oltre 12 ore, interleaving e modifica/cancellazione dal punto di vista dell'utente.
- Seam puro per l'export: `buildExportSheets` di `src/lib/export.ts`, già testato, esteso con il foglio `attivita`. Nessun nuovo seam per il calcolo delle date: si usano le funzioni esistenti.
- Nuovi seam proposti: un solo modulo puro `src/lib/activity.ts` per tipi (`Activity`, `DayActivity`), `activityDurationMinutes(startedAt, endedAt)` e `formatDuration(minutes)`. È il punto più alto in cui verificare la derivazione della durata senza montare la UI.
- Le migrazioni D1 sono additive: nuove tabelle `activities` e `activity_entries`, nessuna modifica a `meals`, `meal_items`, `foods`, `profiles`, `users`.
