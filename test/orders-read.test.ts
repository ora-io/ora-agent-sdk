import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef'

function client(handler: (path: string, search: string) => unknown) {
  const fetchImpl = vi.fn(async (url: string | URL) => {
    const u = new URL(String(url))
    return new Response(JSON.stringify({ success: true, data: handler(u.pathname, u.search) }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
}

describe('orders resource reads', () => {
  it('list passes the status filter to the resolved fund path', async () => {
    const ora = client((path, search) => {
      if (path === '/api/v1/agent/bot/funds') return [{ id: 'fundAB-x', name: 'Mine' }]
      expect(path).toBe('/api/v1/agent/bot/funds/fundAB-x/orders')
      expect(search).toBe('?status=filled')
      return [{ id: 'o1', status: 'filled' }]
    })
    const orders = await ora.orders.list({ status: 'filled' })
    expect(orders[0]!.id).toBe('o1')
  })

  it('get hits /orders/:id (no fundId in path)', async () => {
    const ora = client((path) => {
      if (path === '/api/v1/agent/bot/funds') return [{ id: 'fundAB-x', name: 'Mine' }]
      expect(path).toBe('/api/v1/agent/bot/orders/o9')
      return { id: 'o9', status: 'submitted', events: [] }
    })
    expect((await ora.orders.get('o9')).id).toBe('o9')
  })
})
