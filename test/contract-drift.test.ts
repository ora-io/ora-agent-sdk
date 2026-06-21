import { describe, expect, it } from 'vitest'
import { ORDER_STATUSES, OPEN_ORDER_STATUSES, TERMINAL_ORDER_STATUSES } from '../src/contracts/order-status'
import { POLYMARKET_CAPABILITIES } from '../src/contracts/venue-capabilities'
import { OrderIntentSchema } from '../src/contracts/order-intent'

// Frozen snapshot of the order/venue contract this SDK exposes. This guard is a
// tripwire — if you change a contract value, update the matching snapshot below
// so the change is always a deliberate, reviewed one.

const EXPECTED_STATUSES = [
  'pending_submission', 'submitted', 'filling', 'partially_filled',
  'filled', 'cancelled', 'rejected', 'risk_rejected', 'timeout',
]
const EXPECTED_OPEN = ['pending_submission', 'submitted', 'filling']
const EXPECTED_TERMINAL = ['partially_filled', 'filled', 'cancelled', 'rejected', 'risk_rejected', 'timeout']

const reason = { title: 'why now', summary: 'because the edge is real', body: ['point one'], confidence: '0.6' }
const cid = '0x' + 'a'.repeat(64)

describe('order/venue contract conformance (frozen baseline)', () => {
  it('status sets match the frozen snapshot', () => {
    expect([...ORDER_STATUSES]).toEqual(EXPECTED_STATUSES)
    expect([...OPEN_ORDER_STATUSES]).toEqual(EXPECTED_OPEN)
    expect([...TERMINAL_ORDER_STATUSES]).toEqual(EXPECTED_TERMINAL)
  })

  it('polymarket capability matrix matches the frozen snapshot', () => {
    expect(POLYMARKET_CAPABILITIES.sides).toEqual(['buy', 'sell'])
    expect(POLYMARKET_CAPABILITIES.timeInForceByOrderType.limit).toEqual(['gtc', 'gtd'])
    expect(POLYMARKET_CAPABILITIES.timeInForceByOrderType.market).toEqual(['fok', 'ioc'])
  })

  it('accepts the canonical legal intent fixtures', () => {
    const legal = [
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'limit', timeInForce: 'gtc', price: '0.5', size: '10', reason },
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'ioc', price: null, amountUsdc: '25', reason },
      { clientOrderId: 'c', side: 'sell', conditionId: cid, outcome: 'NO', orderType: 'market', timeInForce: 'fok', price: null, size: '10', reason },
    ]
    for (const intent of legal) {
      expect(OrderIntentSchema.safeParse(intent).success).toBe(true)
    }
  })

  it('rejects the canonical illegal intent fixtures', () => {
    const illegal = [
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'gtc', price: null, amountUsdc: '25', reason }, // market+gtc
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'ioc', price: null, size: '10', amountUsdc: '25', reason }, // market buy + size
    ]
    for (const intent of illegal) {
      expect(OrderIntentSchema.safeParse(intent).success).toBe(false)
    }
  })
})
