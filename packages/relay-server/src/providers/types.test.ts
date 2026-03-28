import { describe, expect, it } from 'vitest'
import { computeHmacSha256, constantTimeCompare } from './types'

describe('computeHmacSha256', () => {
  it('produces a hex string of 64 characters', async () => {
    const result = await computeHmacSha256('hello', 'secret')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('produces a consistent result for the same inputs', async () => {
    const a = await computeHmacSha256('payload', 'mysecret')
    const b = await computeHmacSha256('payload', 'mysecret')
    expect(a).toBe(b)
  })

  it('produces different results for different payloads', async () => {
    const a = await computeHmacSha256('payload-a', 'mysecret')
    const b = await computeHmacSha256('payload-b', 'mysecret')
    expect(a).not.toBe(b)
  })

  it('produces different results for different secrets', async () => {
    const a = await computeHmacSha256('payload', 'secret-a')
    const b = await computeHmacSha256('payload', 'secret-b')
    expect(a).not.toBe(b)
  })

  it('matches a known HMAC-SHA256 value', async () => {
    // Verified against: https://www.devglan.com/online-tools/hmac-sha256-online
    // key: "secret", data: "Hello World" => 82ce0d2f821fa0ce5447b21306f214c99240fecc6387779d7515148bbdd0c415
    const result = await computeHmacSha256('Hello World', 'secret')
    expect(result).toBe('82ce0d2f821fa0ce5447b21306f214c99240fecc6387779d7515148bbdd0c415')
  })
})

describe('constantTimeCompare', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeCompare('abc', 'abc')).toBe(true)
  })

  it('returns false for strings that differ in content', () => {
    expect(constantTimeCompare('abc', 'abd')).toBe(false)
  })

  it('returns false when first string is longer', () => {
    expect(constantTimeCompare('abcd', 'abc')).toBe(false)
  })

  it('returns false when second string is longer', () => {
    expect(constantTimeCompare('abc', 'abcd')).toBe(false)
  })

  it('returns false for completely different strings of same length', () => {
    expect(constantTimeCompare('aaa', 'bbb')).toBe(false)
  })

  it('returns true for empty strings', () => {
    expect(constantTimeCompare('', '')).toBe(true)
  })
})
