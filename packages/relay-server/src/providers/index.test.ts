import { describe, expect, it } from 'vitest'
import { githubProvider } from './github'
import { asanaProvider } from './asana'
import { resolveProvider } from './index'

describe('resolveProvider', () => {
  it('returns githubProvider for "github"', () => {
    expect(resolveProvider('github')).toBe(githubProvider)
  })

  it('returns asanaProvider for "asana"', () => {
    expect(resolveProvider('asana')).toBe(asanaProvider)
  })

  it('throws a descriptive error for an unknown provider name', () => {
    expect(() => resolveProvider('unknown')).toThrow(
      'Unknown provider "unknown". Valid providers: asana, github',
    )
  })

  it('throws an error for an empty string', () => {
    expect(() => resolveProvider('')).toThrow(
      'Unknown provider "". Valid providers: asana, github',
    )
  })
})
