import type { Connection, ConnectionContext } from 'partyserver'
import { Server } from 'partyserver'
import { resolveProvider } from './providers'

export interface Env {
  [key: string]: unknown
  RelayParty: DurableObjectNamespace<RelayParty>
  WEBHOOK_SECRET?: string
  AUTH_TOKEN?: string
}

export class RelayParty extends Server<Env> {
  static options = { hibernate: true }

  onConnect(connection: Connection, ctx: ConnectionContext): void {
    const url = new URL(ctx.request.url)
    const token = url.searchParams.get('token')
    const expectedToken = this.env.AUTH_TOKEN

    if (expectedToken && token !== expectedToken) {
      connection.close(4001, 'Unauthorized')
      return
    }

    connection.send(JSON.stringify({
      type: 'connected',
      room: this.name,
    }))
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST')
      return new Response('Method Not Allowed', { status: 405 })

    const providerName = request.headers.get('x-relay-provider')
    if (!providerName)
      return Response.json({ error: { code: 'missing_provider', message: 'X-Relay-Provider header required' } }, { status: 400 })

    let provider
    try { provider = resolveProvider(providerName) }
    catch (e) { return Response.json({ error: { code: 'unknown_provider', message: (e as Error).message } }, { status: 400 }) }

    // Handshake
    if (provider.isHandshake(request)) {
      const hookSecret = request.headers.get('x-hook-secret')
      if (!hookSecret)
        return Response.json({ error: { code: 'missing_hook_secret', message: 'Handshake request missing X-Hook-Secret header' } }, { status: 400 })

      await this.ctx.storage.put('webhook_secret', hookSecret)
      return new Response('', { status: 200, headers: { 'x-hook-secret': hookSecret } })
    }

    const body = await request.text()

    // Verification
    const secret = await this.ctx.storage.get<string>('webhook_secret') ?? this.env.WEBHOOK_SECRET
    if (!secret)
      return Response.json({ error: { code: 'no_secret', message: 'Webhook secret not configured' } }, { status: 500 })

    const valid = await provider.verify(body, request, secret)
    if (!valid)
      return Response.json({ error: { code: 'invalid_signature', message: 'Signature verification failed' } }, { status: 401 })

    // Metadata
    const { event, action } = provider.extractMetadata(body, request)

    const envelope = JSON.stringify({
      type: 'webhook_event',
      event_id: crypto.randomUUID(),
      provider: providerName,
      event,
      action,
      received_at: new Date().toISOString(),
    })

    this.broadcast(envelope)
    return Response.json({ accepted: true, provider: providerName, event, action, connections: this.getConnectionCount() })
  }

  private getConnectionCount(): number {
    let count = 0
    for (const _ of this.getConnections())
      count++
    return count
  }
}
