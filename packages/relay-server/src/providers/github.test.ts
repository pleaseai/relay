import { describe, expect, it } from 'vitest'
import { githubProvider } from './github'
import { computeHmacSha256 } from './types'

async function makeRequest(headers: Record<string, string> = {}): Promise<Request> {
  return new Request('https://example.com/webhook', { headers })
}

async function signedRequest(body: string, secret: string, event = 'push'): Promise<Request> {
  const hash = await computeHmacSha256(body, secret)
  return makeRequest({
    'x-hub-signature-256': `sha256=${hash}`,
    'x-github-event': event,
  })
}

describe('githubProvider', () => {
  describe('name', () => {
    it('is "github"', () => {
      expect(githubProvider.name).toBe('github')
    })
  })

  describe('isHandshake', () => {
    it('always returns false', async () => {
      const req = await makeRequest()
      expect(githubProvider.isHandshake(req)).toBe(false)
    })

    it('returns false even with arbitrary headers', async () => {
      const req = await makeRequest({ 'x-hub-signature-256': 'sha256=abc' })
      expect(githubProvider.isHandshake(req)).toBe(false)
    })
  })

  describe('verify', () => {
    it('returns true with a valid signature', async () => {
      const body = '{"action":"opened"}'
      const secret = 'mysecret'
      const req = await signedRequest(body, secret)
      expect(await githubProvider.verify(body, req, secret)).toBe(true)
    })

    it('returns false with an invalid signature', async () => {
      const body = '{"action":"opened"}'
      const req = await makeRequest({ 'x-hub-signature-256': 'sha256=invalidsignature00000000000000000000000000000000000000000000000000' })
      expect(await githubProvider.verify(body, req, 'mysecret')).toBe(false)
    })

    it('returns false when the signature header is missing', async () => {
      const body = '{"action":"opened"}'
      const req = await makeRequest({ 'x-github-event': 'push' })
      expect(await githubProvider.verify(body, req, 'mysecret')).toBe(false)
    })

    it('returns false when body does not match signature', async () => {
      const body = '{"action":"opened"}'
      const secret = 'mysecret'
      const req = await signedRequest('different body', secret)
      expect(await githubProvider.verify(body, req, secret)).toBe(false)
    })

    it('returns false when secret does not match', async () => {
      const body = '{"action":"opened"}'
      const req = await signedRequest(body, 'correct-secret')
      expect(await githubProvider.verify(body, req, 'wrong-secret')).toBe(false)
    })
  })

  describe('extractMetadata', () => {
    it('extracts event from x-github-event header', async () => {
      const req = await makeRequest({ 'x-github-event': 'push' })
      const { event } = githubProvider.extractMetadata('{}', req)
      expect(event).toBe('push')
    })

    it('falls back to "unknown" when x-github-event header is missing', async () => {
      const req = await makeRequest()
      const { event } = githubProvider.extractMetadata('{}', req)
      expect(event).toBe('unknown')
    })

    it('extracts action from JSON body', async () => {
      const req = await makeRequest({ 'x-github-event': 'pull_request' })
      const { action } = githubProvider.extractMetadata('{"action":"opened"}', req)
      expect(action).toBe('opened')
    })

    it('returns null action when body has no action field', async () => {
      const req = await makeRequest({ 'x-github-event': 'push' })
      const { action } = githubProvider.extractMetadata('{"ref":"refs/heads/main"}', req)
      expect(action).toBe(null)
    })

    it('returns null action when action field is not a string', async () => {
      const req = await makeRequest({ 'x-github-event': 'push' })
      const { action } = githubProvider.extractMetadata('{"action":42}', req)
      expect(action).toBe(null)
    })

    it('returns null action when body is invalid JSON', async () => {
      const req = await makeRequest({ 'x-github-event': 'push' })
      const { action } = githubProvider.extractMetadata('not-json', req)
      expect(action).toBe(null)
    })

    it('returns null action when body is empty', async () => {
      const req = await makeRequest({ 'x-github-event': 'push' })
      const { action } = githubProvider.extractMetadata('', req)
      expect(action).toBe(null)
    })
  })
})
