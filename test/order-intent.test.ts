import { describe, expect, it } from 'vitest'
import { OrderIntentSchema } from '../src/contracts/order-intent'
import type { OrderIntent } from '../src/contracts/order-intent'

const reason = {
  title: 'Edge on YES',
  summary: 'Market underpricing the YES outcome after the news.',
  body: ['Polls moved 4pts', 'Liquidity is thin on NO'],
  confidence: '0.75',
}
const cid = '0x' + 'a'.repeat(64)

function base(over: Partial<OrderIntent>): unknown {
  return {
    clientOrderId: 'c1', side: 'buy', conditionId: cid, outcome: 'YES',
    orderType: 'limit', timeInForce: 'gtc', price: '0.5', size: '10',
    reason, ...over,
  }
}

describe('OrderIntentSchema', () => {
  it('accepts a valid limit buy', () => {
    expect(OrderIntentSchema.safeParse(base({})).success).toBe(true)
  })

  it('accepts a valid market buy (amountUsdc, null price, ioc)', () => {
    const r = OrderIntentSchema.safeParse(base({
      orderType: 'market', timeInForce: 'ioc', price: null, size: undefined, amountUsdc: '25',
    }))
    expect(r.success).toBe(true)
  })

  it('accepts a valid market sell (size, null price, fok)', () => {
    const r = OrderIntentSchema.safeParse(base({
      side: 'sell', orderType: 'market', timeInForce: 'fok', price: null, size: '10',
    }))
    expect(r.success).toBe(true)
  })

  it('rejects market + gtc', () => {
    const r = OrderIntentSchema.safeParse(base({ orderType: 'market', timeInForce: 'gtc', price: null, size: undefined, amountUsdc: '25' }))
    expect(r.success).toBe(false)
  })

  it('rejects limit without price', () => {
    expect(OrderIntentSchema.safeParse(base({ price: null })).success).toBe(false)
  })

  it('rejects market buy carrying size', () => {
    const r = OrderIntentSchema.safeParse(base({ orderType: 'market', timeInForce: 'ioc', price: null, size: '10', amountUsdc: '25' }))
    expect(r.success).toBe(false)
  })

  it('rejects market sell carrying amountUsdc', () => {
    const r = OrderIntentSchema.safeParse(base({ side: 'sell', orderType: 'market', timeInForce: 'ioc', price: null, size: '10', amountUsdc: '25' }))
    expect(r.success).toBe(false)
  })

  it('rejects size of "0"', () => {
    expect(OrderIntentSchema.safeParse(base({ size: '0' })).success).toBe(false)
  })

  it('rejects a blank reason title and >20 body items', () => {
    expect(OrderIntentSchema.safeParse(base({ reason: { ...reason, title: '   ' } })).success).toBe(false)
    expect(OrderIntentSchema.safeParse(base({ reason: { ...reason, body: Array(21).fill('x') } })).success).toBe(false)
  })

  it('rejects confidence > 1 and > 4 decimal places', () => {
    expect(OrderIntentSchema.safeParse(base({ reason: { ...reason, confidence: '1.5' } })).success).toBe(false)
    expect(OrderIntentSchema.safeParse(base({ reason: { ...reason, confidence: '0.12345' } })).success).toBe(false)
  })
})
