import { describe, expect, it } from 'vitest'
import {
  ORDER_STATUSES as SHARED_STATUSES,
  OPEN_ORDER_STATUSES as SHARED_OPEN,
  TERMINAL_ORDER_STATUSES as SHARED_TERMINAL,
  POLYMARKET_CAPABILITIES as SHARED_CAPS,
  OrderIntentSchema as SharedOrderIntentSchema,
} from '@ora-io/shared'

import { ORDER_STATUSES, OPEN_ORDER_STATUSES, TERMINAL_ORDER_STATUSES } from '../src/contracts/order-status'
import { POLYMARKET_CAPABILITIES } from '../src/contracts/venue-capabilities'

const reason = { title: 'why now', summary: 'because the edge is real', body: ['point one'], confidence: '0.6' }
const cid = '0x' + 'a'.repeat(64)

describe('contract drift guard (SDK vs @ora-io/shared)', () => {
  it('status sets are value-equal', () => {
    expect([...ORDER_STATUSES]).toEqual([...SHARED_STATUSES])
    expect([...OPEN_ORDER_STATUSES]).toEqual([...SHARED_OPEN])
    expect([...TERMINAL_ORDER_STATUSES]).toEqual([...SHARED_TERMINAL])
  })

  it('polymarket capability matrix is value-equal', () => {
    expect(POLYMARKET_CAPABILITIES.sides).toEqual([...SHARED_CAPS.sides])
    // shared types the Record-property access as `readonly[] | undefined` under
    // noUncheckedIndexedAccess; coalesce so the spread typechecks. At runtime the
    // value is always present — if shared ever drops it, the SDK side won't equal
    // `[]` and this guard still fails (drift still caught).
    expect(POLYMARKET_CAPABILITIES.timeInForceByOrderType.limit).toEqual([...(SHARED_CAPS.timeInForceByOrderType.limit ?? [])])
    expect(POLYMARKET_CAPABILITIES.timeInForceByOrderType.market).toEqual([...(SHARED_CAPS.timeInForceByOrderType.market ?? [])])
  })

  it('every SDK-legal intent fixture parses under the shared schema', () => {
    const legal = [
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'limit', timeInForce: 'gtc', price: '0.5', size: '10', reason },
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'ioc', price: null, amountUsdc: '25', reason },
      { clientOrderId: 'c', side: 'sell', conditionId: cid, outcome: 'NO', orderType: 'market', timeInForce: 'fok', price: null, size: '10', reason },
    ]
    for (const intent of legal) {
      expect(SharedOrderIntentSchema.safeParse(intent).success).toBe(true)
    }
  })

  it('intents the SDK rejects are also rejected by the shared schema', () => {
    const illegal = [
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'gtc', price: null, amountUsdc: '25', reason }, // market+gtc
      { clientOrderId: 'c', side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'ioc', price: null, size: '10', amountUsdc: '25', reason }, // market buy + size
    ]
    for (const intent of illegal) {
      expect(SharedOrderIntentSchema.safeParse(intent).success).toBe(false)
    }
  })
})
