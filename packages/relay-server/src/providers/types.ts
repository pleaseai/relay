export interface WebhookProvider {
  name: string
  verify: (body: string, request: Request, secret: string) => Promise<boolean>
  extractMetadata: (body: string, request: Request) => { event: string, action: string | null }
  isHandshake: (request: Request) => boolean
}

export async function computeHmacSha256(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('')
}

export function constantTimeCompare(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let mismatch = a.length ^ b.length
  for (let i = 0; i < len; i++)
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return mismatch === 0
}
