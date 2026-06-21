import { describe, expect, it } from 'vitest'
import type { SdkOrder, SdkPosition } from '../src/contracts/entities'

describe('entity read shapes', () => {
  it('a minimal SdkOrder fixture compiles and reads back', () => {
    const o: SdkOrder = {
      id: 'o1', clientOrderId: 'c1', venue: 'polymarket', instrument: 'Will X win?',
      side: 'buy', orderType: 'market', timeInForce: 'ioc', price: null,
      conditionId: '0x' + 'a'.repeat(64), outcome: 'YES', size: null, amountUsdc: '25',
      status: 'submitted', filledSize: null, avgFillPrice: null, reservedUsdc: '25',
      rejectReason: null, venueOrderId: null, metadata: null,
      createdAt: '2026-06-19T00:00:00.000Z', updatedAt: '2026-06-19T00:00:00.000Z',
    }
    expect(o.amountUsdc).toBe('25')
  })

  it('a minimal SdkPosition fixture compiles', () => {
    const p: SdkPosition = {
      instrument: 'Will X win?', quantity: '10', avgEntryPrice: '0.4',
      currentMarkPrice: '0.5', unrealizedPnl: '1', costBasisUsdc: '4',
      realizedPnl: null, marketStatus: 'active',
    }
    expect(p.marketStatus).toBe('active')
  })
})
