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

## Deploy su Cloudflare Pages

1. Su https://dash.cloudflare.com/ → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Collega il repository GitHub e imposta:
   - Production branch: `main`
   - Framework preset: `Vue`
   - Build command: `npm run build`
   - Build output directory: `dist`
3. In **Settings → Environment variables** aggiungi `NODE_VERSION=22`.
4. Ogni push su `main` genera un deploy di produzione; gli altri branch generano preview deployment.

Non è configurato alcun workflow GitHub Actions: il deploy lo gestisce l'integrazione Git di Cloudflare.

## Test e lint

Non ancora configurati, per scelta: verranno aggiunti in una fase successiva.
