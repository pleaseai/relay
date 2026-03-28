import { describe, expect, it } from 'vitest'
import { computeHmacSha256 } from './types'
import { asanaProvider } from './asana'

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/webhook', { headers })
}

describe('asanaProvider.isHandshake', () => {
  it('returns true when X-Hook-Secret header is present', () => {
    const req = makeRequest({ 'x-hook-secret': 'abc123' })
    expect(asanaProvider.isHandshake(req)).toBe(true)
  })

  it('returns false when X-Hook-Secret header is absent', () => {
    const req = makeRequest()
    expect(asanaProvider.isHandshake(req)).toBe(false)
  })
})

describe('asanaProvider.verify', () => {
  it('returns true with a valid X-Hook-Signature', async () => {
    const body = JSON.stringify({ events: [{ action: 'changed', resource: { resource_type: 'task' } }] })
    const secret = 'mysecret'
    const sig = await computeHmacSha256(body, secret)
    const req = makeRequest({ 'x-hook-signature': sig })
    expect(await asanaProvider.verify(body, req, secret)).toBe(true)
  })

  it('returns false with an invalid X-Hook-Signature', async () => {
    const body = JSON.stringify({ events: [{ action: 'changed', resource: { resource_type: 'task' } }] })
    const req = makeRequest({ 'x-hook-signature': 'invalidsignature00000000000000000000000000000000000000000000000000' })
    expect(await asanaProvider.verify(body, req, 'mysecret')).toBe(false)
  })

  it('returns true for a heartbeat (empty events, no signature)', async () => {
    const body = JSON.stringify({ events: [] })
    const req = makeRequest()
    expect(await asanaProvider.verify(body, req, 'mysecret')).toBe(true)
  })

  it('returns false when no signature and body is not a heartbeat', async () => {
    const body = JSON.stringify({ events: [{ action: 'changed', resource: { resource_type: 'task' } }] })
    const req = makeRequest()
    expect(await asanaProvider.verify(body, req, 'mysecret')).toBe(false)
  })
})

describe('asanaProvider.extractMetadata', () => {
  it('extracts resource_type and action from first event', () => {
    const body = JSON.stringify({
      events: [
        { action: 'changed', resource: { resource_type: 'task' } },
        { action: 'added', resource: { resource_type: 'project' } },
      ],
    })
    const req = makeRequest()
    const meta = asanaProvider.extractMetadata(body, req)
    expect(meta.event).toBe('task')
    expect(meta.action).toBe('changed')
  })

  it('returns heartbeat event and null action for empty events array', () => {
    const body = JSON.stringify({ events: [] })
    const req = makeRequest()
    const meta = asanaProvider.extractMetadata(body, req)
    expect(meta.event).toBe('heartbeat')
    expect(meta.action).toBeNull()
  })

  it('returns unknown event and null action for malformed body', () => {
    const body = 'not valid json {'
    const req = makeRequest()
    const meta = asanaProvider.extractMetadata(body, req)
    expect(meta.event).toBe('unknown')
    expect(meta.action).toBeNull()
  })
})
