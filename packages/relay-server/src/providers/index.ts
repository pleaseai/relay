import { githubProvider } from './github'
import { asanaProvider } from './asana'
import type { WebhookProvider } from './types'

export type { WebhookProvider } from './types'
export { computeHmacSha256, constantTimeCompare } from './types'
export { githubProvider } from './github'
export { asanaProvider } from './asana'

const providers: Record<string, WebhookProvider> = {
  asana: asanaProvider,
  github: githubProvider,
}

export function resolveProvider(name: string): WebhookProvider {
  const provider = providers[name]
  if (!provider) {
    const valid = Object.keys(providers).sort().join(', ')
    throw new Error(`Unknown provider "${name}". Valid providers: ${valid}`)
  }
  return provider
}
