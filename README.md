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
  _redirects              # SPA fallback per Cloudflare Pages
  favicon.svg
  icons/                  # icone PWA (192, 512, maskable, apple-touch)
src/
  components/ui/          # componenti shadcn-vue
  router/                 # rotte
  stores/                 # store Pinia
  composables/            # composable riutilizzabili
  views/                  # pagine
  lib/utils.ts            # cn()
  style.css               # Tailwind + tema shadcn
```

## Deploy su Cloudflare Workers

Il progetto usa Workers con static assets (`wrangler.jsonc`). La cartella pubblicata è `dist/`, già configurata nel file: la dashboard non chiede la build output directory.

Su https://dash.cloudflare.com/ → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**:

| Campo | Valore |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command (non-production) | `npx wrangler versions upload` |

Il token API va lasciato vuoto: Cloudflare lo genera e lo gestisce da solo quando colleghi il repo dalla dashboard.

Ogni push su `main` genera un deploy di produzione; gli altri branch generano una versione di preview.

In locale il deploy manuale è:

```bash
npm run build
npx wrangler deploy
```

Routing SPA: gestito da `assets.not_found_handling: "single-page-application"` in `wrangler.jsonc`.

## Test e lint

Non ancora configurati, per scelta: verranno aggiunti in una fase successiva.
