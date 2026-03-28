import { computeHmacSha256, constantTimeCompare, WebhookProvider } from './types'

export const asanaProvider: WebhookProvider = {
  name: 'asana',

  isHandshake: (request: Request): boolean => {
    return request.headers.get('x-hook-secret') !== null
  },

  verify: async (body: string, request: Request, secret: string): Promise<boolean> => {
    const signature = request.headers.get('x-hook-signature')
    if (!signature) {
      try {
        const parsed = JSON.parse(body) as { events?: unknown[] }
        return Array.isArray(parsed.events) && parsed.events.length === 0
      }
      catch {
        return false
      }
    }
    const computed = await computeHmacSha256(body, secret)
    return constantTimeCompare(computed, signature)
  },

  extractMetadata: (body: string, _request: Request): { event: string, action: string | null } => {
    try {
      const parsed = JSON.parse(body) as {
        events: Array<{ action: string, resource: { resource_type: string } }>
      }
      const events = parsed.events
      if (!Array.isArray(events) || events.length === 0) {
        return { event: 'heartbeat', action: null }
      }
      const first = events[0]
      return {
        event: first.resource?.resource_type ?? 'unknown',
        action: first.action ?? null,
      }
    }
    catch {
      return { event: 'unknown', action: null }
    }
  },
}
