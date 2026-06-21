import { describe, expect, it } from 'vitest'
import * as sdk from '../src/index'
import type { ThoughtInput, FetchLike } from '../src/index'

const ERROR_CLASSES = [
  'OraError', 'OraValidationError', 'OraVenueUnsupportedError', 'OraRiskRejected',
  'OraInsufficientBalance', 'OraOrderRejected', 'OraDuplicateOrderError',
  'OraOrderStateError', 'OraAuthError', 'OraNotFoundError', 'OraRateLimitError',
  'OraTimeoutError', 'OraNetworkError',
] as const

describe('public exports', () => {
  it('exports the client and contract values', () => {
    expect(typeof sdk.OraClient).toBe('function')
    expect(sdk.ORDER_STATUSES.length).toBe(9)
    expect(sdk.POLYMARKET_CAPABILITIES.sides).toEqual(['buy', 'sell'])
    expect(typeof sdk.validateOrderForVenue).toBe('function')
    expect(typeof sdk.OrderIntentSchema.safeParse).toBe('function')
    expect(typeof sdk.toOraError).toBe('function')
  })

  it('exports every error class', () => {
    for (const name of ERROR_CLASSES) {
      expect(typeof (sdk as Record<string, unknown>)[name], name).toBe('function')
    }
  })

  it('re-exports the input types used to annotate caller code', () => {
    // Compile-time check: these must be importable so callers can type their
    // own variables (a thought builder, a custom fetch). Erased at runtime.
    const thought: ThoughtInput = { title: 't', summary: 's', body: ['b'] }
    const customFetch: FetchLike = globalThis.fetch
    expect(thought.title).toBe('t')
    expect(typeof customFetch === 'function' || customFetch === undefined).toBe(true)
  })
})
