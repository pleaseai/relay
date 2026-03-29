declare namespace Cloudflare {
  interface Env {
    RelayParty: DurableObjectNamespace
    WEBHOOK_SECRET: string
    AUTH_TOKEN: string
    FORWARD_PAYLOAD?: string
  }
}
