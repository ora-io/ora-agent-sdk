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
})
