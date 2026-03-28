import type { Env } from '@pleaseai/relay-server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock partyserver before importing the module
const mockFetch = vi.fn()
const mockGetServerByName = vi.fn(() => Promise.resolve({ fetch: mockFetch }))
const mockRoutePartykitRequest = vi.fn(() => Promise.resolve(null))

vi.mock('partyserver', () => ({
  getServerByName: mockGetServerByName,
  routePartykitRequest: mockRoutePartykitRequest,
}))

// Mock relay-server
vi.mock('@pleaseai/relay-server', () => ({
  RelayParty: class RelayParty {},
}))

const worker = await import('./index.js')
const handler = worker.default

const mockEnv = {
  RelayParty: {} as DurableObjectNamespace,
} as unknown as Env

function makeRequest(method: string, path: string, body?: string): Request {
  return new Request(`https://example.com${path}`, {
    method,
    body,
  })
}

describe('relay-worker routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerByName.mockResolvedValue({ fetch: mockFetch })
    mockRoutePartykitRequest.mockResolvedValue(null)
  })

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const request = makeRequest('GET', '/health')
      const response = await handler.fetch(request, mockEnv)
      const body = await response.json() as { status: string }
      expect(response.status).toBe(200)
      expect(body.status).toBe('ok')
    })
  })

  describe('POST /webhook/:provider/:room', () => {
    it('routes github/my-room with X-Relay-Provider header', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }))
      const request = makeRequest('POST', '/webhook/github/my-room')

      await handler.fetch(request, mockEnv)

      expect(mockGetServerByName).toHaveBeenCalledWith(mockEnv.RelayParty, 'my-room')
      const forwardedRequest: Request = mockFetch.mock.calls[0][0]
      expect(forwardedRequest.headers.get('x-relay-provider')).toBe('github')
    })

    it('routes asana/my-room with X-Relay-Provider header', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }))
      const request = makeRequest('POST', '/webhook/asana/my-room')

      await handler.fetch(request, mockEnv)

      expect(mockGetServerByName).toHaveBeenCalledWith(mockEnv.RelayParty, 'my-room')
      const forwardedRequest: Request = mockFetch.mock.calls[0][0]
      expect(forwardedRequest.headers.get('x-relay-provider')).toBe('asana')
    })

    it('returns the response from the durable object', async () => {
      mockFetch.mockResolvedValue(new Response('forwarded', { status: 201 }))
      const request = makeRequest('POST', '/webhook/github/my-room')

      const response = await handler.fetch(request, mockEnv)

      expect(response.status).toBe(201)
    })
  })

  describe('POST /webhook/:room (missing provider)', () => {
    it('returns 400 when only one segment after /webhook/', async () => {
      const request = makeRequest('POST', '/webhook/my-room')

      const response = await handler.fetch(request, mockEnv)
      const body = await response.json() as { error: { code: string, message: string } }

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('missing_room')
      expect(body.error.message).toBe('Both provider and room are required: /webhook/:provider/:room')
    })
  })

  describe('POST /webhook/ (empty)', () => {
    it('returns 400 when no segments after /webhook/', async () => {
      const request = makeRequest('POST', '/webhook/')

      const response = await handler.fetch(request, mockEnv)
      const body = await response.json() as { error: { code: string, message: string } }

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('missing_room')
    })
  })

  describe('unmatched routes', () => {
    it('returns 404 for unknown routes', async () => {
      const request = makeRequest('GET', '/unknown')

      const response = await handler.fetch(request, mockEnv)
      const body = await response.json() as { error: { code: string } }

      expect(response.status).toBe(404)
      expect(body.error.code).toBe('not_found')
    })
  })
})
