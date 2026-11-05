# Crumbs

Diario alimentare come PWA. Scheletro applicativo: nessuna logica di business.

## Stack

- Vue 3 + TypeScript su Vite
- Vue Router, Pinia
- Tailwind CSS v4
- shadcn-vue (Reka UI) — componenti in `src/components/ui`
- `vite-plugin-pwa` (service worker generato, `autoUpdate`)
- Icone: `@lucide/vue`

## Sviluppo

Un solo comando avvia tutto: Vite con HMR sul frontend, Worker con D1 locale e proxy `/api`.

```bash
npm install
npm run dev:all       # frontend http://localhost:5173 + API http://localhost:8787
```

In alternativa, due terminali:

```bash
npm run dev:api       # build iniziale + wrangler dev su :8787
npm run dev           # Vite su :5173, con proxy /api -> :8787
```

Il proxy è configurato solo per lo sviluppo: in produzione Worker e asset stanno sullo stesso hostname.

Altri comandi:

```bash
npm run build       # type-check + build di produzione in dist/
npm run preview     # anteprima locale del build
npm run type-check  # solo vue-tsc
```

Il service worker è disattivato in sviluppo; si attiva nel build di produzione.

## Struttura

```
public/
  favicon.svg
  icons/                  # icone PWA (192, 512, maskable, apple-touch)
src/
  components/ui/          # componenti shadcn-vue
  router/                 # rotte
  stores/                 # store Pinia
  composables/            # composable riutilizzabili
  views/                  # pagine
  worker/index.ts         # API del Worker (/api/*)
  lib/utils.ts            # cn()
  style.css               # Tailwind + tema shadcn
migrations/               # migrazioni SQL di D1
worker-configuration.d.ts # tipi generati da wrangler (npm run types)
```

## Database D1

`crumbs-db` è collegato al Worker con il binding `DB` (`wrangler.jsonc`). Schema in `migrations/`.

```bash
npm run db:migrate:local    # applica le migrazioni al DB locale (.wrangler/state)
npm run db:migrate:remote   # applica le migrazioni al DB Cloudflare
npm run types               # rigenera worker-configuration.d.ts dopo modifiche al config
```

API disponibili:

- `GET /api/health` → `{ "ok": true }` (pubblica)
- `GET/PUT /api/profile` → profilo e target kcal
- `GET /api/days/:date` → pasti, voci e totali del giorno
- `POST /api/meals`, `PUT/DELETE /api/meals/:id` → crea, sostituisce, cancella un pasto
- `GET/POST /api/foods`, `PATCH/DELETE /api/foods/:id` → preferiti
- `GET /api/foods/search?q=` → ricerca su Open Food Facts (gruppo `off`)
- `GET /api/foods/off/:code` → prodotto per codice a barre
- `GET /api/export?from=&to=` → dati JSON per l'export `.xlsx`

Tutte richiedono `Authorization: Bearer <token>` tranne `/api/health`. Il token statico `API_TOKEN` viene risolto all'utente con email `ALLOWED_EMAIL`: perché funzioni, quell'utente deve aver fatto almeno un login Google (altrimenti 403).

## Autenticazione API

Tutte le rotte `/api/*` tranne `/api/health` richiedono una credenziale `Authorization: Bearer`.

Credenziali accettate:

1. **ID token Google** (login utente), verificato nel Worker: firma RS256 contro le chiavi pubbliche Google, `iss`, `aud`, scadenza, `email_verified` e allowlist.
2. **Token statico** `API_TOKEN`, come accesso di servizio per script e curl.

Configurazione:

- `GOOGLE_CLIENT_ID`: variabile pubblica in `wrangler.jsonc`; se vuota il login Google è disabilitato.
- `VITE_GOOGLE_CLIENT_ID`: la stessa client ID in `.env`, letta dal build frontend (è pubblica).
- Nel client OAuth, tra le **Authorized JavaScript origins**, servono `https://crumbs.massilorenzo94.workers.dev`, `http://localhost:5173` e `http://localhost` (senza slash finale).
- `ALLOWED_EMAIL`: secret con l'unica email autorizzata (`npx wrangler secret put ALLOWED_EMAIL`).
- `API_TOKEN`: secret (`npm run secret:api-token`).
- Sviluppo locale: `ALLOWED_EMAIL` e `API_TOKEN` in `.dev.vars` (git-ignored).

`GET /api/me` restituisce la credenziale usata e, per Google, email, nome e immagine.

## Test

```bash
npm test            # Vitest, ambiente node, nessuna rete
npm run test:watch
```

Le rotte `/api/*` sono gestite dal Worker (`assets.run_worker_first`); il resto è servito come asset statico.

Sviluppo con DB e API locali:

```bash
npm run build
npx wrangler dev
```

## Deploy su Cloudflare Workers

Il progetto usa Workers con static assets (`wrangler.jsonc`). La cartella pubblicata è `dist/`, già configurata nel file: la dashboard non chiede la build output directory.

Su https://dash.cloudflare.com/ → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**:

| Campo | Valore |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:ci` |
| Preview command (non-production) | `npx wrangler versions upload` |

Il token API va lasciato vuoto: Cloudflare lo genera e lo gestisce da solo quando colleghi il repo dalla dashboard.

Ogni push su `main` genera un deploy di produzione; gli altri branch generano una versione di preview.

`deploy:ci` applica prima le migrazioni D1 remote **solo sul branch `main`** (`WORKERS_CI_BRANCH`), poi esegue il deploy. Se una migrazione fallisce, il deploy non avviene.

In locale il deploy manuale è:

```bash
npm run build
npx wrangler deploy
```

Routing SPA: gestito da `assets.not_found_handling: "single-page-application"` in `wrangler.jsonc`.

