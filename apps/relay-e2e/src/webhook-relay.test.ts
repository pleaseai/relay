import { SELF } from 'cloudflare:test'
import { afterEach, describe, expect, it } from 'vitest'
import { postWebhook, signGithubPayload } from './helpers'

const WEBHOOK_SECRET = 'test-webhook-secret'
const AUTH_TOKEN = 'test-auth-token'

/**
 * Collects all messages from a WebSocket into an array.
 * Must be called immediately after ws.accept() to avoid missing messages.
 */
function collectMessages(ws: WebSocket): string[] {
  const messages: string[] = []
  ws.addEventListener('message', (event) => {
    messages.push(typeof event.data === 'string' ? event.data : String(event.data))
  })
  return messages
}

/**
 * Waits until a message matching the predicate appears in the collected messages array.
 */
function waitForMessage(
  messages: string[],
  predicate: (msg: string) => boolean,
  timeoutMs = 5_000,
): Promise<string> {
  // Check already-collected messages first
  for (const msg of messages) {
    if (predicate(msg))
      return Promise.resolve(msg)
  }

  return new Promise((resolve, reject) => {
    let poll: ReturnType<typeof setInterval>

    const timeout = setTimeout(() => {
      clearInterval(poll)
      reject(new Error(`Timed out waiting for message (collected ${messages.length} total)`))
    }, timeoutMs)

    poll = setInterval(() => {
      for (const msg of messages) {
        if (predicate(msg)) {
          clearTimeout(timeout)
          clearInterval(poll)
          resolve(msg)
          return
        }
      }
    }, 20)
  })
}

function waitForWsClose(ws: WebSocket, timeoutMs = 5_000): Promise<CloseEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for WebSocket close'))
    }, timeoutMs)

    ws.addEventListener('close', (event) => {
      clearTimeout(timeout)
      resolve(event)
    })
  })
}

async function connectToRoom(room: string, token?: string) {
  const params = token ? `?token=${token}` : ''
  const resp = await SELF.fetch(
    `https://relay.test/parties/relay-party/${room}${params}`,
    { headers: { Upgrade: 'websocket' } },
  )
  const ws = resp.webSocket!
  ws.accept()
  const messages = collectMessages(ws)
  return { ws, messages, resp }
}

describe('webhook → party-server → party-client', () => {
  const openSockets: WebSocket[] = []

  afterEach(() => {
    for (const ws of openSockets)
      ws.close()
    openSockets.length = 0
  })

  it('health check returns ok', async () => {
    const res = await SELF.fetch('https://relay.test/health')
    const body = await res.json() as { status: string }
    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
  })

  it('connects via WebSocket and receives connected message', async () => {
    const { ws, messages, resp } = await connectToRoom('e2e-connect-test', AUTH_TOKEN)
    openSockets.push(ws)
    expect(resp.status).toBe(101)

    const raw = await waitForMessage(messages, m => m.includes('connected'))
    const parsed = JSON.parse(raw)

    expect(parsed.type).toBe('connected')
    expect(parsed.room).toBe('e2e-connect-test')
  })

  it('rejects WebSocket without valid token', async () => {
    const { ws } = await connectToRoom('e2e-auth-test', 'wrong-token')
    openSockets.push(ws)

    const closeEvent = await waitForWsClose(ws)
    expect(closeEvent.code).toBe(4001)
  })

  it('broadcasts GitHub webhook to connected client', async () => {
    const room = 'e2e-github-broadcast'

    // 1. Connect WebSocket client — messages collected from accept()
    const { ws, messages } = await connectToRoom(room, AUTH_TOKEN)
    openSockets.push(ws)

    await waitForMessage(messages, m => m.includes('connected'))

    // 2. POST webhook with valid signature
    const payload = JSON.stringify({ action: 'opened', number: 42 })
    const signature = await signGithubPayload(payload, WEBHOOK_SECRET)

    const res = await postWebhook(SELF, 'github', room, payload, {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
    })

    expect(res.status).toBe(200)
    const resBody = await res.json() as { accepted: boolean, provider: string, event: string, action: string }
    expect(resBody.accepted).toBe(true)
    expect(resBody.provider).toBe('github')
    expect(resBody.event).toBe('pull_request')
    expect(resBody.action).toBe('opened')

    // 3. Verify client received the envelope
    const raw = await waitForMessage(messages, m => m.includes('webhook_event'))
    const envelope = JSON.parse(raw)

    expect(envelope.type).toBe('webhook_event')
    expect(envelope.provider).toBe('github')
    expect(envelope.event).toBe('pull_request')
    expect(envelope.action).toBe('opened')
    expect(envelope.event_id).toBeDefined()
    expect(envelope.received_at).toBeDefined()
  })

  it('rejects webhook with invalid signature', async () => {
    const payload = JSON.stringify({ action: 'closed' })

    const res = await postWebhook(SELF, 'github', 'e2e-invalid-sig', payload, {
      'x-hub-signature-256': 'sha256=invalid',
      'x-github-event': 'issues',
    })

    expect(res.status).toBe(401)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('invalid_signature')
  })

  it('rejects webhook without signature', async () => {
    const payload = JSON.stringify({ action: 'created' })

    const res = await postWebhook(SELF, 'github', 'e2e-no-sig', payload, {
      'x-github-event': 'issues',
    })

    expect(res.status).toBe(401)
  })

  it('multiple clients in same room all receive broadcast', async () => {
    const room = 'e2e-multi-client'

    const client1 = await connectToRoom(room, AUTH_TOKEN)
    const client2 = await connectToRoom(room, AUTH_TOKEN)
    openSockets.push(client1.ws, client2.ws)

    await waitForMessage(client1.messages, m => m.includes('connected'))
    await waitForMessage(client2.messages, m => m.includes('connected'))

    // POST webhook
    const payload = JSON.stringify({ action: 'synchronized' })
    const signature = await signGithubPayload(payload, WEBHOOK_SECRET)

    await postWebhook(SELF, 'github', room, payload, {
      'x-hub-signature-256': signature,
      'x-github-event': 'push',
    })

    const msg1 = await waitForMessage(client1.messages, m => m.includes('webhook_event'))
    const msg2 = await waitForMessage(client2.messages, m => m.includes('webhook_event'))

    const env1 = JSON.parse(msg1)
    const env2 = JSON.parse(msg2)

    expect(env1.event).toBe('push')
    expect(env2.event).toBe('push')
    expect(env1.event_id).toBe(env2.event_id)
  })

  it('clients in different rooms are isolated', async () => {
    const clientA = await connectToRoom('e2e-room-a', AUTH_TOKEN)
    const clientB = await connectToRoom('e2e-room-b', AUTH_TOKEN)
    openSockets.push(clientA.ws, clientB.ws)

    await waitForMessage(clientA.messages, m => m.includes('connected'))
    await waitForMessage(clientB.messages, m => m.includes('connected'))

    // POST webhook only to room A
    const payload = JSON.stringify({ action: 'opened' })
    const signature = await signGithubPayload(payload, WEBHOOK_SECRET)

    await postWebhook(SELF, 'github', 'e2e-room-a', payload, {
      'x-hub-signature-256': signature,
      'x-github-event': 'issues',
    })

    // Client A should receive
    const msgA = await waitForMessage(clientA.messages, m => m.includes('webhook_event'))
    expect(JSON.parse(msgA).event).toBe('issues')

    // Client B should NOT receive
    await scheduler.wait(500)
    const webhookMsgs = clientB.messages.filter(m => m.includes('webhook_event'))
    expect(webhookMsgs).toHaveLength(0)
  })
})
