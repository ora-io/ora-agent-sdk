import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef'

const fetchImpl = vi.fn(async (url: string | URL) => {
  const path = new URL(String(url)).pathname
  const data = path === '/api/v1/agent/bot/funds'
    ? [{ id: 'fundAB-x', name: 'Mine' }]
    : [{ instrument: 'Will X win?', quantity: '10', marketStatus: 'active' }]
  return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } })
}) as unknown as typeof fetch

describe('positions resource', () => {
  it('lists open positions at the resolved fund path', async () => {
    const ora = new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
    const positions = await ora.positions.list()
    expect(positions).toHaveLength(1)
    expect(positions[0]!.instrument).toBe('Will X win?')
  })
})
