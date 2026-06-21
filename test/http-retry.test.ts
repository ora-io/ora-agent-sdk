import { describe, expect, it, vi } from 'vitest'
import { OraHttpClient } from '../src/http'
import { OraNetworkError } from '../src/errors'

const ok = () => new Response(JSON.stringify({ success: true, data: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } })
const boom = () => new Response('', { status: 503 })

function client(fetchImpl: typeof fetch) {
  return new OraHttpClient({
    apiKey: 'k', baseUrl: 'https://api.test/api/v1', fetch: fetchImpl,
    maxRetries: 3,
    // test seam: zero-delay backoff
    sleep: async () => {},
  } as never)
}

describe('GET retry', () => {
  it('retries a GET on 5xx then succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(boom()).mockResolvedValueOnce(ok()) as unknown as typeof fetch
    const data = await client(fetchImpl).request<string>('GET', '/x')
    expect(data).toBe('ok')
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
  })

  it('retries a GET on network throw then succeeds', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('econnreset')).mockResolvedValueOnce(ok()) as unknown as typeof fetch
    expect(await client(fetchImpl).request<string>('GET', '/x')).toBe('ok')
  })

  it('throws OraNetworkError after exhausting GET retries', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch
    await expect(client(fetchImpl).request('GET', '/x')).rejects.toBeInstanceOf(OraNetworkError)
  })

  it('does NOT retry a POST', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch
    await expect(client(fetchImpl).request('POST', '/x', { body: {} })).rejects.toBeInstanceOf(OraNetworkError)
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
  })
})
