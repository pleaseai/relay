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

export async function signGithubPayload(body: string, secret: string): Promise<string> {
  const hash = await computeHmacSha256(body, secret)
  return `sha256=${hash}`
}

export function postWebhook(
  worker: Fetcher,
  provider: string,
  room: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return worker.fetch(`https://relay.test/webhook/${provider}/${room}`, {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}
