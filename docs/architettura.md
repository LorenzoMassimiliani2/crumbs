# Architettura

Crumbs è un diario alimentare come PWA: frontend Vue servito da Cloudflare Workers insieme alle API, con database D1.

## Stack
- linguaggi/framework: TypeScript, Vue 3, Vite, Tailwind CSS v4, shadcn-vue (Reka UI), Pinia, Vue Router
- backend: Cloudflare Workers (static assets + API `/api/*`), D1 (SQLite)
- PWA: vite-plugin-pwa, service worker `autoUpdate`, `navigateFallbackDenylist: /^\/api\//`
- deploy: Cloudflare Workers Builds da GitHub; build `npm run build`, deploy `npm run deploy:ci`
- runtime agente: prime-agent

## Convenzioni
- ticket tracker: `docs/tickets/` (backend: github-source)
- spec: `docs/spec/`
- decisioni (ADR): `docs/decisioni/`
- API: tutte le rotte `/api/*` tranne `/api/health` richiedono `Authorization: Bearer <credenziale>`: ID token Google valido (login utente) oppure `API_TOKEN` (accesso di servizio per script e curl)
- migrazioni D1: `migrations/`, applicate in locale con `npm run db:migrate:local` e in produzione dalla CI solo su `main`
- sviluppo locale: `npm run dev:all` (Vite :5173 + wrangler dev :8787, proxy `/api`)
