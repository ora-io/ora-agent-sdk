import { describe, expect, it } from 'vitest'
import { POLYMARKET_CAPABILITIES, validateOrderForVenue } from '../src/contracts/venue-capabilities'

const ok = { side: 'buy', orderType: 'limit', timeInForce: 'gtc' } as const

describe('validateOrderForVenue (polymarket)', () => {
  it('accepts limit+gtc and market+ioc', () => {
    expect(validateOrderForVenue(ok, POLYMARKET_CAPABILITIES)).toEqual([])
    expect(validateOrderForVenue({ side: 'sell', orderType: 'market', timeInForce: 'ioc' }, POLYMARKET_CAPABILITIES)).toEqual([])
  })

  it('rejects limit+ioc with TIF_NOT_SUPPORTED_FOR_ORDER_TYPE', () => {
    const issues = validateOrderForVenue({ ...ok, timeInForce: 'ioc' }, POLYMARKET_CAPABILITIES)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ field: 'timeInForce', code: 'TIF_NOT_SUPPORTED_FOR_ORDER_TYPE' })
  })

  it('rejects market+gtd with TIF_NOT_SUPPORTED_FOR_ORDER_TYPE', () => {
    const issues = validateOrderForVenue({ side: 'buy', orderType: 'market', timeInForce: 'gtd' }, POLYMARKET_CAPABILITIES)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('TIF_NOT_SUPPORTED_FOR_ORDER_TYPE')
  })

  it('rejects unsupported side with SIDE_NOT_SUPPORTED_ON_VENUE', () => {
    const issues = validateOrderForVenue({ side: 'short' as never, orderType: 'limit', timeInForce: 'gtc' }, POLYMARKET_CAPABILITIES)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('SIDE_NOT_SUPPORTED_ON_VENUE')
  })

  it('rejects unknown orderType with ORDER_TYPE_NOT_SUPPORTED_ON_VENUE', () => {
    const issues = validateOrderForVenue({ side: 'buy', orderType: 'stop' as never, timeInForce: 'gtc' }, POLYMARKET_CAPABILITIES)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('ORDER_TYPE_NOT_SUPPORTED_ON_VENUE')
  })

  it('exposes the canonical matrix', () => {
    expect(POLYMARKET_CAPABILITIES.sides).toEqual(['buy', 'sell'])
    expect(POLYMARKET_CAPABILITIES.timeInForceByOrderType.limit).toEqual(['gtc', 'gtd'])
    expect(POLYMARKET_CAPABILITIES.timeInForceByOrderType.market).toEqual(['fok', 'ioc'])
  })
})
