import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'
import { OraValidationError, OraVenueUnsupportedError, OraDuplicateOrderError } from '../src/errors'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef'
const reason = { title: 'why', summary: 'because the edge is real', body: ['point one'], confidence: '0.6' }
const cid = '0x' + 'a'.repeat(64)

function client(capture: { body?: unknown }) {
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname
    if (path === '/api/v1/agent/bot/funds') return new Response(JSON.stringify({ success: true, data: [{ id: 'fundAB-x', name: 'Mine' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    capture.body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ success: true, data: { orderId: 'o1', venueOrderId: 'v1' } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
}

describe('orders submit + constructors', () => {
  it('marketBuy produces orderType=market, price=null, amountUsdc, ioc; auto clientOrderId', async () => {
    const cap: { body?: unknown } = {}
    const ack = await client(cap).orders.marketBuy({ conditionId: cid, outcome: 'YES', amountUsdc: '25', reason })
    expect(ack).toEqual({ orderId: 'o1', venueOrderId: 'v1' })
    expect(cap.body).toMatchObject({ orderType: 'market', side: 'buy', price: null, amountUsdc: '25', timeInForce: 'ioc' })
    expect(typeof (cap.body as { clientOrderId: string }).clientOrderId).toBe('string')
  })

  it('marketSell produces size, null price, no amountUsdc', async () => {
    const cap: { body?: unknown } = {}
    await client(cap).orders.marketSell({ conditionId: cid, outcome: 'NO', size: '10', reason })
    expect(cap.body).toMatchObject({ orderType: 'market', side: 'sell', price: null, size: '10', timeInForce: 'ioc' })
    expect((cap.body as Record<string, unknown>).amountUsdc).toBeUndefined()
  })

  it('limitBuy defaults tif=gtc and carries price+size', async () => {
    const cap: { body?: unknown } = {}
    await client(cap).orders.limitBuy({ conditionId: cid, outcome: 'YES', price: '0.5', size: '10', reason })
    expect(cap.body).toMatchObject({ orderType: 'limit', side: 'buy', price: '0.5', size: '10', timeInForce: 'gtc' })
  })

  it('prevalidation rejects a bad intent client-side (no HTTP call)', async () => {
    // market buy carrying size → structural refine fails
    await expect(
      client({}).orders.submit({ side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'ioc', price: null, size: '10', amountUsdc: '25', reason }),
    ).rejects.toBeInstanceOf(OraValidationError)
  })

  it('prevalidation rejects venue-illegal tif client-side', async () => {
    await expect(
      client({}).orders.submit({ side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'limit', timeInForce: 'ioc', price: '0.5', size: '10', reason }),
    ).rejects.toBeInstanceOf(OraVenueUnsupportedError)
  })

  it('market+gtc is rejected as OraValidationError (structural refine runs before venue check)', async () => {
    await expect(
      client({}).orders.submit({ side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'gtc', price: null, amountUsdc: '25', reason }),
    ).rejects.toBeInstanceOf(OraValidationError)
  })

  it('a 409 from submit surfaces OraDuplicateOrderError carrying the local clientOrderId', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const path = new URL(String(url)).pathname
      if (path === '/api/v1/agent/bot/funds') return new Response(JSON.stringify({ success: true, data: [{ id: 'fundAB-x', name: 'Mine' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ success: false, error: { code: 'DUPLICATE_CLIENT_ORDER_ID', message: 'dup' } }), { status: 409, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    const ora = new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
    await expect(
      ora.orders.marketBuy({ conditionId: cid, outcome: 'YES', amountUsdc: '25', reason, clientOrderId: 'mine-1' }),
    ).rejects.toMatchObject({ name: 'OraDuplicateOrderError', clientOrderId: 'mine-1' })
  })
})
