import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveProvider } from './providers'
import { computeHmacSha256 } from './providers/types'

// We test the logic of onRequest by extracting the pure handler logic.
// Since RelayParty extends PartyServer (a Durable Object), we cannot instantiate
// it directly in tests. Instead we test the provider-delegation logic inline,
// which is the behaviour we care about.

function makeRequest(options: {
  method?: string
  provider?: string
  hookSecret?: string
  headers?: Record<string, string>
  body?: string
} = {}): Request {
  const {
    method = 'POST',
    provider,
    hookSecret,
    headers = {},
    body = '{}',
  } = options

  const allHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...headers,
  }
  if (provider) allHeaders['x-relay-provider'] = provider
  if (hookSecret) allHeaders['x-hook-secret'] = hookSecret

  return new Request('https://example.com/webhook', {
    method,
    headers: allHeaders,
    body: method !== 'GET' ? body : undefined,
  })
}

// Inline handler that mirrors RelayParty.onRequest logic for unit-testability
async function onRequest(
  request: Request,
  storage: { get: (key: string) => Promise<string | undefined>, put: (key: string, value: string) => Promise<void> },
  env: { WEBHOOK_SECRET?: string },
  broadcast: (msg: string) => void,
  getConnectionCount: () => number,
): Promise<Response> {
  if (request.method !== 'POST')
    return new Response('Method Not Allowed', { status: 405 })

  const providerName = request.headers.get('x-relay-provider')
  if (!providerName)
    return Response.json({ error: { code: 'missing_provider', message: 'X-Relay-Provider header required' } }, { status: 400 })

  let provider
  try { provider = resolveProvider(providerName) }
  catch (e) { return Response.json({ error: { code: 'unknown_provider', message: (e as Error).message } }, { status: 400 }) }

  if (provider.isHandshake(request)) {
    const hookSecret = request.headers.get('x-hook-secret')
    if (!hookSecret)
      return Response.json({ error: { code: 'missing_hook_secret', message: 'Handshake request missing X-Hook-Secret header' } }, { status: 400 })

    await storage.put('webhook_secret', hookSecret)
    return new Response('', { status: 200, headers: { 'x-hook-secret': hookSecret } })
  }

  const body = await request.text()

  const secret = await storage.get('webhook_secret') ?? env.WEBHOOK_SECRET
  if (!secret)
    return Response.json({ error: { code: 'no_secret', message: 'Webhook secret not configured' } }, { status: 500 })

  const valid = await provider.verify(body, request, secret)
  if (!valid)
    return Response.json({ error: { code: 'invalid_signature', message: 'Signature verification failed' } }, { status: 401 })

  const { event, action } = provider.extractMetadata(body, request)

  const envelope = JSON.stringify({
    type: 'webhook_event',
    event_id: crypto.randomUUID(),
    provider: providerName,
    event,
    action,
    received_at: new Date().toISOString(),
  })

  broadcast(envelope)
  return Response.json({ accepted: true, provider: providerName, event, action, connections: getConnectionCount() })
}

describe('RelayParty onRequest', () => {
  let storageMock: { get: ReturnType<typeof vi.fn>, put: ReturnType<typeof vi.fn> }
  let broadcastMock: ReturnType<typeof vi.fn>
  let getConnectionCountMock: ReturnType<typeof vi.fn>
  let env: { WEBHOOK_SECRET?: string }

  // typed aliases for passing to onRequest
  let storage: { get: (key: string) => Promise<string | undefined>, put: (key: string, value: string) => Promise<void> }
  let broadcast: (msg: string) => void
  let getConnectionCount: () => number

  beforeEach(() => {
    storageMock = {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    }
    broadcastMock = vi.fn()
    getConnectionCountMock = vi.fn().mockReturnValue(0)
    storage = storageMock as unknown as typeof storage
    broadcast = broadcastMock as unknown as typeof broadcast
    getConnectionCount = getConnectionCountMock as unknown as typeof getConnectionCount
    env = {}
  })

  it('returns 405 for non-POST requests', async () => {
    const req = makeRequest({ method: 'GET' })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(405)
  })

  it('returns 400 when X-Relay-Provider header is missing', async () => {
    const req = makeRequest({ method: 'POST' })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('missing_provider')
  })

  it('returns 400 for unknown provider', async () => {
    const req = makeRequest({ provider: 'nonexistent' })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('unknown_provider')
  })

  it('handles Asana handshake: stores secret and echoes X-Hook-Secret', async () => {
    const req = makeRequest({ provider: 'asana', hookSecret: 'my-secret-token' })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-hook-secret')).toBe('my-secret-token')
    expect(storageMock.put).toHaveBeenCalledWith('webhook_secret', 'my-secret-token')
    expect(broadcastMock).not.toHaveBeenCalled()
  })

  it('delegates verification to provider and returns 401 on failure', async () => {
    env.WEBHOOK_SECRET = 'secret'
    const req = makeRequest({
      provider: 'github',
      headers: { 'x-hub-signature-256': 'sha256=bad', 'x-github-event': 'push' },
      body: '{"action":"opened"}',
    })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('invalid_signature')
  })

  it('broadcast envelope includes provider field', async () => {
    const secret = 'test-secret'
    const body = '{"action":"opened"}'
    env.WEBHOOK_SECRET = secret
    const hash = await computeHmacSha256(body, secret)
    const req = makeRequest({
      provider: 'github',
      headers: { 'x-github-event': 'push', 'x-hub-signature-256': `sha256=${hash}` },
      body,
    })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(200)
    expect(broadcastMock).toHaveBeenCalledOnce()

    const envelope = JSON.parse(broadcastMock.mock.calls[0][0] as string) as Record<string, unknown>
    expect(envelope.provider).toBe('github')
    expect(envelope.type).toBe('webhook_event')
    expect(envelope.event).toBe('push')
    expect(envelope.action).toBe('opened')
  })

  it('returns 500 when no secret configured', async () => {
    const req = makeRequest({
      provider: 'github',
      headers: { 'x-github-event': 'ping' },
      body: '{}',
    })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(500)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('no_secret')
    expect(broadcastMock).not.toHaveBeenCalled()
  })

  it('uses stored secret over env secret', async () => {
    storageMock.get.mockResolvedValue('stored-secret')
    env.WEBHOOK_SECRET = 'env-secret'
    // With wrong sig for stored-secret, should fail (not pass with env-secret)
    const req = makeRequest({
      provider: 'github',
      headers: { 'x-hub-signature-256': 'sha256=bad', 'x-github-event': 'push' },
      body: '{}',
    })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    expect(res.status).toBe(401)
    expect(storageMock.get).toHaveBeenCalledWith('webhook_secret')
  })

  it('response includes provider field', async () => {
    const secret = 'test-secret'
    const bodyStr = '{"action":"opened"}'
    env.WEBHOOK_SECRET = secret
    const hash = await computeHmacSha256(bodyStr, secret)
    const req = makeRequest({
      provider: 'github',
      headers: { 'x-github-event': 'push', 'x-hub-signature-256': `sha256=${hash}` },
      body: bodyStr,
    })
    const res = await onRequest(req, storage, env, broadcast, getConnectionCount)
    const body = await res.json() as { provider: string, accepted: boolean }
    expect(body.provider).toBe('github')
    expect(body.accepted).toBe(true)
  })
})
