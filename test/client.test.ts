import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef' // fundId6 = 'fundAB'

function fetchReturning(funds: Array<{ id: string; name: string }>) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ success: true, data: funds }), { status: 200, headers: { 'content-type': 'application/json' } }),
  ) as unknown as typeof fetch
}

describe('OraClient', () => {
  it('rejects a non-ora_live key', () => {
    expect(() => new OraClient({ apiKey: 'bad' })).toThrow()
  })

  it('resolves the bound fund by matching the key fundId6 prefix, and caches it', async () => {
    const fetchImpl = fetchReturning([{ id: 'fundXY-other', name: 'Other' }, { id: 'fundAB-cuid-rest', name: 'Mine' }])
    const ora = new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
    expect(await ora.resolveFundId()).toBe('fundAB-cuid-rest')
    expect(await ora.resolveFundId()).toBe('fundAB-cuid-rest') // cached
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
    expect(await ora.currentFund()).toEqual({ fundId: 'fundAB-cuid-rest', name: 'Mine' })
  })

  it('throws when no fund matches the key prefix', async () => {
    const ora = new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchReturning([{ id: 'zzzzzz-x', name: 'No' }]) })
    await expect(ora.resolveFundId()).rejects.toThrow(/FUND_SCOPE_UNRESOLVED/)
  })

  it('builds a Reason scaffold', () => {
    const ora = new OraClient({ apiKey: KEY, fetch: fetchReturning([]) })
    expect(ora.reason('t', { summary: 's', body: ['a'], confidence: '0.5' })).toEqual({
      title: 't', summary: 's', body: ['a'], confidence: '0.5',
    })
  })
})
