import { describe, expect, it } from 'vitest'
import * as sdk from '../src/index'

describe('public exports', () => {
  it('exports the client, errors, and contract values', () => {
    expect(typeof sdk.OraClient).toBe('function')
    expect(typeof sdk.OraError).toBe('function')
    expect(typeof sdk.OraRiskRejected).toBe('function')
    expect(typeof sdk.OraDuplicateOrderError).toBe('function')
    expect(sdk.ORDER_STATUSES.length).toBe(9)
    expect(sdk.POLYMARKET_CAPABILITIES.sides).toEqual(['buy', 'sell'])
    expect(typeof sdk.validateOrderForVenue).toBe('function')
    expect(typeof sdk.OrderIntentSchema.safeParse).toBe('function')
  })
})
