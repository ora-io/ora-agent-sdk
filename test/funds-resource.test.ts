import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef'

function router(routes: Record<string, unknown>) {
  return vi.fn(async (url: string | URL) => {
    const path = new URL(String(url)).pathname
    const data = routes[path]
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

const ora = () => new OraClient({
  apiKey: KEY, baseUrl: 'https://api.test/api/v1',
  fetch: router({
    '/api/v1/agent/bot/funds': [{ id: 'fundAB-x', name: 'Mine' }],
    '/api/v1/agent/bot/funds/fundAB-x': { id: 'fundAB-x', name: 'Mine', status: 'active' },
    '/api/v1/agent/bot/funds/fundAB-x/overview': { fundName: 'Mine', aum: '100' },
  }),
})

describe('funds resource', () => {
  it('list returns FundListItem[]', async () => {
    expect(await ora().funds.list()).toEqual([{ id: 'fundAB-x', name: 'Mine' }])
  })
  it('get hits the resolved fundId path', async () => {
    expect((await ora().funds.get()).id).toBe('fundAB-x')
  })
  it('overview hits the overview path', async () => {
    expect((await ora().funds.overview()).fundName).toBe('Mine')
  })
  it('current returns the cached identity', async () => {
    expect(await ora().funds.current()).toEqual({ fundId: 'fundAB-x', name: 'Mine' })
  })

  it('overview surfaces the cycle widget and balance breakdown', async () => {
    const client = new OraClient({
      apiKey: KEY, baseUrl: 'https://api.test/api/v1',
      fetch: router({
        '/api/v1/agent/bot/funds': [{ id: 'fundAB-x', name: 'Mine' }],
        '/api/v1/agent/bot/funds/fundAB-x/overview': {
          fundName: 'Mine', bindingStatus: 'active', totalBalance: 500,
          pendingCarryBalance: 12, navReturn30d: '0.08', netFlow30d: 40, topHolderPct: 33,
          currentCycle: { id: 'c1', cycleNumber: 7, status: 'collecting', cutoffTime: '2026-06-22T00:00:00Z', pendingSubscriptionCount: 2, pendingRedemptionCount: 1 },
        },
      }),
    })
    const ov = await client.funds.overview()
    expect(ov.currentCycle?.status).toBe('collecting')
    expect(ov.currentCycle?.pendingRedemptionCount).toBe(1)
    expect(ov.totalBalance).toBe(500)
    expect(ov.pendingCarryBalance).toBe(12)
    expect(ov.bindingStatus).toBe('active')
  })
})
