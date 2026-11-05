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

```bash
npm install
npm run dev
```

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

- `GET /api/health` → `{ "ok": true }`
- `GET /api/meals` → ultimi 50 pasti non cancellati

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

## Test e lint

Non ancora configurati, per scelta: verranno aggiunti in una fase successiva.
