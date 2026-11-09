---
id: SPEC-0003
title: Peso e andamento
status: approved
source: docs/features/FEAT-0002-peso-andamento.md
---

# Peso e andamento

## Problem Statement

Oggi Crumbs conosce un solo peso: il valore nel Profilo, che sovrascrive il precedente. Non posso vedere come il mio peso cambia nel tempo, né registrare una misura datata senza perdere quella di ieri. Il peso è anche il dato che alimenta BMR e BMI, quindi tenerlo in un campo unico e modificabile rende impossibile distinguere "il peso di oggi" da "quanto pesavo un mese fa".

Voglio una sezione dedicata al peso: registrare una misura al giorno e vedere l'andamento in un grafico, senza cambiare il resto del diario.

## Solution

Una nuova tab **Peso** nella barra in basso, con ordine **Peso | Oggi | Profilo** e **Oggi** attiva all'apertura.

La tab Peso contiene:

- peso corrente, data dell'ultima misura e variazione rispetto alla misura precedente;
- un grafico a linea con punti, disegnato in SVG senza librerie esterne, con selettore del periodo (30, 90, 365 giorni oppure tutto; default 90);
- un form rapido con data (default oggi) e peso in kg;
- la lista compatta delle ultime 10 misure, con modifica ed eliminazione definitiva.

Una sola misura per data: salvare una data già presente aggiorna il valore. La prima volta che si apre la tab, se il registro è vuoto e il profilo ha un peso, viene creata la misura di oggi con quel peso.

Il peso esce dal Profilo: il form non ha più il campo peso e `PUT /api/profile` non accetta più `weight`. `GET /api/profile` continua a restituire il peso corrente, e BMR/BMI restano nel Profilo calcolati su quel valore. La cache `profiles.weight_kg` segue automaticamente l'ultima misura disponibile.

L'export `.xlsx` resta invariato.

## User Stories

1. Come proprietario, voglio aprire una tab Peso dalla barra in basso, così da gestire il peso senza passare dal Profilo.
2. Come proprietario, voglio che la barra mostri Peso, Oggi e Profilo e che Oggi sia attiva all'apertura, così da ritrovare subito il diario.
3. Come proprietario, voglio registrare il peso di una data, così da costruire uno storico nel tempo.
4. Come proprietario, voglio che la data sia precompilata con oggi, così da registrare la misura in pochi tocchi.
5. Come proprietario, voglio reinserire il peso della stessa data e aggiornare quella misura, così da correggere un valore sbagliato senza duplicati.
6. Come proprietario, voglio che una sola misura esista per data, così che il grafico non abbia doppioni.
7. Come proprietario, voglio vedere il peso corrente e la data dell'ultima misura, così da sapere a quando risale il dato.
8. Come proprietario, voglio vedere la variazione rispetto alla misura precedente, così da capire la direzione nell'ultimo intervallo.
9. Come proprietario, voglio un grafico a linea del peso nel tempo, così da vedere l'andamento a colpo d'occhio.
10. Come proprietario, voglio scegliere il periodo del grafico tra 30, 90, 365 giorni e tutto, così da passare da una vista ravvicinata a una lunga.
11. Come proprietario, voglio che l'asse Y abbia un margine automatico attorno ai valori, così che le variazioni siano leggibili senza partire da zero.
12. Come proprietario, voglio che il grafico sia leggibile da telefono, così da usarlo nel contesto quotidiano.
13. Come proprietario, voglio vedere le ultime 10 misure in una lista compatta, così da controllare e correggere i dati recenti.
14. Come proprietario, voglio modificare data o peso di una misura, così da correggere un errore.
15. Come proprietario, voglio una conferma quando la modifica sposta una misura su una data già occupata, così da non sovrascrivere per sbaglio.
16. Come proprietario, voglio cancellare una misura con conferma, così da rimuovere un dato errato.
17. Come proprietario, voglio che la cancellazione sia definitiva e immediata in grafico, lista e calcoli, così da non vedere dati fantasma.
18. Come proprietario, voglio che, cancellata l'ultima misura, il peso del profilo scenda alla misura precedente, così che BMR e BMI restino coerenti.
19. Come proprietario, voglio che, cancellate tutte le misure, il profilo mantenga l'ultimo peso noto, così da non perdere BMR e BMI.
20. Come proprietario, voglio che la prima apertura con profilo già compilato crei la misura di oggi dal peso del profilo, così da avere subito un punto di partenza.
21. Come proprietario, voglio che il registro non si ripopoli da solo dopo che ho cancellato tutte le misure, così da rispettare la mia scelta.
22. Come proprietario, voglio che il Profilo non abbia più il campo peso, così da non avere due punti in cui il peso viene scritto.
23. Come proprietario, voglio continuare a vedere BMR e BMI nel Profilo, calcolati sul peso corrente, così da non perdere le informazioni esistenti.
24. Come proprietario, voglio che il profilo si salvi senza peso, così da poter aggiornare altezza, sesso, nascita e target senza toccare il registro.
25. Come proprietario, voglio che il mio peso resti privato come il resto dei dati, così da non esporlo ad altri.
26. Come sviluppatore, voglio che il peso corrente del profilo sia una cache aggiornata dalle scritture delle misure, così da avere una sola fonte di verità.
27. Come sviluppatore, voglio che la semina iniziale avvenga una sola volta per utente, così da non reintrodurre misure cancellate.
28. Come sviluppatore, voglio che il grafico dipenda da una funzione pura testabile, così da non verificare solo il DOM.
29. Come sviluppatore, voglio che l'export resti identico, così da non rompere i fogli esistenti.
30. Come sviluppatore, voglio che le nuove rotte seguano autenticazione e scoping per `user_id` del resto dell'app, così da non introdurre accessi privilegiati.

## Acceptance Criteria

### Modello e API

- [ ] Nuova tabella `weight_entries` con `id`, `user_id`, `measured_on` (`YYYY-MM-DD`), `weight_kg`, `created_at`, `updated_at`; unicità su (`user_id`, `measured_on`); nessun soft delete.
- [ ] `GET /api/weights` restituisce le misure dell'utente ordinate per data crescente, con `date` e `weight`.
- [ ] `GET /api/weights?today=YYYY-MM-DD` riceve dal client la data locale e la valida; se `today` manca o non è una data reale, usa la data UTC corrente.
- [ ] Al primo accesso di un utente senza misure e con `profiles.weight_kg` valorizzato, `GET /api/weights` crea la misura di `today` usando il peso del profilo; senza peso del profilo il registro resta vuoto.
- [ ] La semina avviene una sola volta per utente tramite un flag persistente; dopo aver cancellato tutte le misure, un nuovo `GET` restituisce una lista vuota.
- [ ] `PUT /api/weights/:date` con `{weight}` crea o aggiorna la misura della data; due `PUT` sulla stessa data lasciano una sola riga.
- [ ] Una data non reale (`2026-02-30`), un peso non numerico, minore di 30 o maggiore di 300 restituiscono 400.
- [ ] `DELETE /api/weights/:date` elimina la misura; una data senza misura restituisce 404.
- [ ] `profiles.weight_kg` viene aggiornato all'ultima misura disponibile dopo creazione, modifica ed eliminazione; se non restano misure, mantiene l'ultimo valore noto.
- [ ] Inserire una misura più vecchia della corrente non cambia `profiles.weight_kg`.
- [ ] `GET /api/profile` continua a restituire `weight`; `PUT /api/profile` funziona senza `weight` e risponde 400 se il payload contiene `weight`.
- [ ] Le rotte del peso richiedono la credenziale esistente, filtrano per `user_id` e non espongono dati di altri utenti.

### Tab e vista Peso

- [ ] La barra in basso mostra Peso, Oggi e Profilo, in questo ordine; la route `/weight` apre la tab Peso e `/` resta Oggi.
- [ ] Aprendo l'app si atterra su Oggi.
- [ ] La tab Peso mostra peso corrente, data dell'ultima misura e variazione rispetto alla misura precedente; con registro vuoto mostra uno stato vuoto comprensibile.
- [ ] Il form rapido ha data (default oggi) e peso in kg con un decimale; salvare aggiunge o aggiorna la misura e aggiorna subito vista e grafico.
- [ ] La lista mostra le ultime 10 misure dalla più recente; ogni riga è modificabile ed eliminabile.
- [ ] Modificare una misura su una data già esistente richiede conferma prima di sovrascrivere.
- [ ] L'eliminazione richiede conferma ed è definitiva.
- [ ] Il grafico è SVG, senza librerie di charting nel bundle.
- [ ] Il selettore del periodo offre 30, 90, 365 giorni e tutto; il default è 90 e il grafico mostra solo le misure del periodo.
- [ ] L'asse Y ha un margine automatico attorno ai valori del periodo e resta leggibile con una sola misura.
- [ ] Ogni punto espone data e peso in modo accessibile (etichetta o tooltip nativo).

### Profilo

- [ ] Il form Profilo non contiene più il campo peso e il salvataggio non invia `weight`.
- [ ] BMR e BMI restano visibili nel Profilo e usano il peso corrente restituito da `GET /api/profile`.
- [ ] Con profilo senza peso e registro vuoto, BMR e BMI non producono valori inventati.

### Export

- [ ] Il file `.xlsx` è identico a prima: fogli `pasti`, `giorni`, `Attività`, nessun foglio Peso.

## Seams

- Highest seam: rotte HTTP del Worker con D1 reale e migrazioni applicate (seam già usato dai ticket esistenti). Coprono lista, upsert, eliminazione, semina unica, cache del profilo e nuovo contratto di `PUT /api/profile`.
- Seam frontend: mount della vista Peso in DOM con `fetch` intercettato al confine di rete; verifica di form, lista, conferme, selettore periodo e stato vuoto. Mount della barra in basso per ordine e tab attiva; mount del Profilo per l'assenza del campo peso e la presenza di BMR/BMI.
- Seam puro: un modulo `src/lib/weight.ts` con il modello del grafico (`weightChartModel(entries, period, today)`): filtra il periodo, calcola scala X/Y, margine e punti SVG. È il punto più alto per verificare la geometria senza DOM. Riusa `isRealDate`/formattazione date esistenti dove possibile.
- Nessun nuovo seam per l'export: non viene toccato.
- Le migrazioni D1 sono additive: nuova tabella `weight_entries`, nuova colonna flag su `users`, nessuna modifica distruttiva.
