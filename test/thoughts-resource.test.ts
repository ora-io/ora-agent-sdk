import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef'

describe('thoughts resource', () => {
  it('posts a thought and returns the Reasoning row', async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(new URL(String(url)).pathname).toBe('/api/v1/agent/bot/thought')
      expect(JSON.parse(String(init?.body))).toEqual({ title: 't', summary: 's', body: ['line1'] })
      return new Response(JSON.stringify({ success: true, data: { id: 'r1', kind: 'thought', title: 't' } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    const ora = new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
    const r = await ora.thoughts.push({ title: 't', summary: 's', body: ['line1'] })
    expect(r.id).toBe('r1')
  })
})
