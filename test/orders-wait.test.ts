import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'
import { OraOrderRejected, OraRiskRejected, OraTimeoutError, OraDuplicateOrderError } from '../src/errors'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef'

// A fetch that returns a scripted sequence of order statuses for GET /orders/:id.
function client(statuses: string[], extraOrderFields: Record<string, unknown> = {}) {
  let i = 0
  const fetchImpl = vi.fn(async (url: string | URL) => {
    const path = new URL(String(url)).pathname
    if (path === '/api/v1/agent/bot/funds') return ok([{ id: 'fundAB-x', name: 'Mine' }])
    const status = statuses[Math.min(i, statuses.length - 1)]
    i++
    return ok({ id: 'o1', clientOrderId: 'c1', status, ...extraOrderFields })
  }) as unknown as typeof fetch
  return new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
}
function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } })
}

const fastSeams = { pollMs: 1, sleep: async () => {} }

describe('waitForFill', () => {
  it('returns the order once it reaches filled', async () => {
    const ora = client(['submitted', 'filling', 'filled'])
    const order = await ora.orders.waitForFill('o1', fastSeams)
    expect(order.status).toBe('filled')
  })

  it('returns on partially_filled (terminal)', async () => {
    const ora = client(['filling', 'partially_filled'])
    expect((await ora.orders.waitForFill('o1', fastSeams)).status).toBe('partially_filled')
  })

  it('throws OraOrderRejected on rejected, carrying rejectReason', async () => {
    const ora = client(['submitted', 'rejected'], { rejectReason: 'liquidity' })
    await expect(ora.orders.waitForFill('o1', fastSeams)).rejects.toBeInstanceOf(OraOrderRejected)
  })

  it('throws OraTimeoutError if it never reaches terminal before deadline', async () => {
    const fakeNow = (() => { let t = 0; return () => (t += 10000) })() // jumps 10s per call
    const ora = client(['submitted'])
    await expect(ora.orders.waitForFill('o1', { timeoutMs: 5000, pollMs: 1, sleep: async () => {}, now: fakeNow }))
      .rejects.toBeInstanceOf(OraTimeoutError)
  })

  it('throws OraRiskRejected on risk_rejected', async () => {
    const ora = client(['filling', 'risk_rejected'], { rejectReason: 'blocked by limits' })
    await expect(ora.orders.waitForFill('o1', fastSeams)).rejects.toBeInstanceOf(OraRiskRejected)
  })

  it('submitAndWait recovers from a 409 by finding the order via list, then waits to terminal', async () => {
    const cid = '0x' + 'a'.repeat(64)
    const reason = { title: 'why now', summary: 'because the edge is real', body: ['p'], confidence: '0.6' }
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = new URL(String(url)).pathname
      if (path === '/api/v1/agent/bot/funds') return ok([{ id: 'fundAB-x', name: 'Mine' }])
      if (path === '/api/v1/agent/bot/orders' && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: false, error: { code: 'DUPLICATE_CLIENT_ORDER_ID', message: 'dup' } }), { status: 409, headers: { 'content-type': 'application/json' } })
      }
      if (path === '/api/v1/agent/bot/funds/fundAB-x/orders') return ok([{ id: 'o7', clientOrderId: 'dup-1', status: 'submitted', venueOrderId: 'v7' }])
      if (path === '/api/v1/agent/bot/orders/o7') return ok({ id: 'o7', clientOrderId: 'dup-1', status: 'filled' })
      throw new Error(`unexpected ${path}`)
    }) as unknown as typeof fetch
    const ora = new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
    const order = await ora.orders.submitAndWait(
      { side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'ioc', price: null, amountUsdc: '5', reason, clientOrderId: 'dup-1' },
      { pollMs: 1 },
    )
    expect(order.id).toBe('o7')
    expect(order.status).toBe('filled')
  })

  it('submitAndWait rethrows OraDuplicateOrderError when the order is not in the list window', async () => {
    const cid = '0x' + 'a'.repeat(64)
    const reason = { title: 'why now', summary: 'because the edge is real', body: ['p'], confidence: '0.6' }
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = new URL(String(url)).pathname
      if (path === '/api/v1/agent/bot/funds') return ok([{ id: 'fundAB-x', name: 'Mine' }])
      if (path === '/api/v1/agent/bot/orders' && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: false, error: { code: 'DUPLICATE_CLIENT_ORDER_ID', message: 'dup' } }), { status: 409, headers: { 'content-type': 'application/json' } })
      }
      if (path === '/api/v1/agent/bot/funds/fundAB-x/orders') return ok([])
      throw new Error(`unexpected ${path}`)
    }) as unknown as typeof fetch
    const ora = new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
    await expect(
      ora.orders.submitAndWait({ side: 'buy', conditionId: cid, outcome: 'YES', orderType: 'market', timeInForce: 'ioc', price: null, amountUsdc: '5', reason, clientOrderId: 'dup-1' }, { pollMs: 1 }),
    ).rejects.toBeInstanceOf(OraDuplicateOrderError)
  })
})
