export interface Env extends Cloudflare.Env {
  API_TOKEN: string
  ALLOWED_EMAIL: string
  USDA_API_KEY?: string
}
