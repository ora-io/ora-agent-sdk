import { describe, expect, it, vi } from 'vitest'
import { OraClient } from '../src/client'
import { OraValidationError, OraOrderStateError } from '../src/errors'

const KEY = 'ora_live_dev_agent1_fundAB_42_deadbeef'

function client(handler: (path: string, body: unknown) => { status: number; data: unknown }) {
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const { status, data } = handler(path, body)
    const payload = status < 400 ? { success: true, data } : { success: false, error: data }
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return new OraClient({ apiKey: KEY, baseUrl: 'https://api.test/api/v1', fetch: fetchImpl })
}

describe('orders cancel', () => {
  it('cancel returns the cancelled ack', async () => {
    const ora = client((path) => {
      expect(path).toBe('/api/v1/agent/bot/orders/o1/cancel')
      return { status: 200, data: { orderId: 'o1', status: 'cancelled' } }
    })
    expect(await ora.orders.cancel('o1')).toEqual({ orderId: 'o1', status: 'cancelled' })
  })

  it('cancel on a terminal order surfaces OraOrderStateError', async () => {
    const ora = client(() => ({ status: 400, data: { code: 'ORDER_NOT_CANCELLABLE', message: 'too late', status: 'filled' } }))
    await expect(ora.orders.cancel('o1')).rejects.toBeInstanceOf(OraOrderStateError)
  })

  it('cancelMany posts the id list', async () => {
    const ora = client((path, body) => {
      expect(path).toBe('/api/v1/agent/bot/orders/cancel-bulk')
      expect(body).toEqual({ orderIds: ['o1', 'o2'] })
      return { status: 200, data: { cancelled: ['o1'], failed: [{ orderId: 'o2', reason: 'ORDER_NOT_CANCELLABLE' }] } }
    })
    const res = await ora.orders.cancelMany(['o1', 'o2'])
    expect(res.cancelled).toEqual(['o1'])
  })

  it('cancelMany rejects an empty list client-side (no HTTP)', async () => {
    await expect(client(() => ({ status: 200, data: {} })).orders.cancelMany([])).rejects.toBeInstanceOf(OraValidationError)
  })

  it('cancelMany rejects > 100 ids client-side', async () => {
    await expect(client(() => ({ status: 200, data: {} })).orders.cancelMany(Array(101).fill('x'))).rejects.toBeInstanceOf(OraValidationError)
  })
})
