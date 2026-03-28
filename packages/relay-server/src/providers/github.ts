import { computeHmacSha256, constantTimeCompare, WebhookProvider } from './types'

export const githubProvider: WebhookProvider = {
  name: 'github',

  isHandshake: (_request: Request) => false,

  verify: async (body: string, request: Request, secret: string) => {
    const signature = request.headers.get('x-hub-signature-256')
    if (!signature) return false
    const hash = await computeHmacSha256(body, secret)
    return constantTimeCompare(signature, `sha256=${hash}`)
  },

  extractMetadata: (body: string, request: Request) => {
    const event = request.headers.get('x-github-event') ?? 'unknown'
    let action: string | null = null
    try {
      const parsed = JSON.parse(body)
      if (typeof parsed?.action === 'string') {
        action = parsed.action
      }
    } catch {
      // malformed JSON — action stays null
    }
    return { event, action }
  },
}
