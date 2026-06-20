import { describe, expect, it, vi } from 'vitest'
import { OraHttpClient } from '../src/http'
import { OraRiskRejected } from '../src/errors'

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

function client(fetchImpl: typeof fetch) {
  return new OraHttpClient({ apiKey: 'ora_live_dev_aaaaaa_bbbbbb_1_xyz', baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
}

describe('OraHttpClient.request (single attempt)', () => {
  it('injects the bearer token and unwraps data on success', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.test/api/v1/agent/bot/funds')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer ora_live_dev_aaaaaa_bbbbbb_1_xyz')
      return jsonResponse(200, { success: true, data: [{ id: 'f1' }] })
    }) as unknown as typeof fetch
    const data = await client(fetchImpl).request<Array<{ id: string }>>('GET', '/agent/bot/funds')
    expect(data).toEqual([{ id: 'f1' }])
  })

  it('appends query params, skipping undefined', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(String(url)).toBe('https://api.test/api/v1/agent/bot/funds/f1/orders?status=filled')
      return jsonResponse(200, { success: true, data: [] })
    }) as unknown as typeof fetch
    await client(fetchImpl).request('GET', '/agent/bot/funds/f1/orders', { query: { status: 'filled', cursor: undefined } })
  })

  it('throws the mapped typed error on {success:false}', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, { success: false, error: { code: 'ORDER_RISK_REJECTED', message: 'no', reason: 'CAP_EXCEEDED' } }),
    ) as unknown as typeof fetch
    await expect(client(fetchImpl).request('POST', '/agent/bot/orders', { body: {} })).rejects.toBeInstanceOf(OraRiskRejected)
  })

  it('returns null for an empty 2xx body', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch
    expect(await client(fetchImpl).request('POST', '/agent/bot/orders/o1/cancel')).toBeNull()
  })
})
