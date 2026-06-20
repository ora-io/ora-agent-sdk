import type { OraClient } from '../client'
import type { SdkOrder, OrderAck, CancelResult, BulkCancelResult } from '../contracts/entities'
import type { OrderStatus } from '../contracts/order-status'
import { isTerminal } from '../contracts/order-status'
import type { OrderIntent, Outcome, TimeInForce } from '../contracts/order-intent'
import { OrderIntentSchema } from '../contracts/order-intent'
import type { Reason } from '../contracts/reason'
import { POLYMARKET_CAPABILITIES, validateOrderForVenue } from '../contracts/venue-capabilities'
import { OraValidationError, OraVenueUnsupportedError, OraOrderRejected, OraRiskRejected, OraTimeoutError, OraDuplicateOrderError } from '../errors'

export class OrdersResource {
  constructor(private readonly client: OraClient) {}

  async list(opts: { status?: OrderStatus } = {}): Promise<SdkOrder[]> {
    const fundId = await this.client.resolveFundId()
    return this.client.http.request<SdkOrder[]>('GET', `/agent/bot/funds/${fundId}/orders`, {
      query: { status: opts.status },
    })
  }

  get(orderId: string): Promise<SdkOrder> {
    return this.client.http.request<SdkOrder>('GET', `/agent/bot/orders/${orderId}`)
  }

  async submit(intent: Omit<OrderIntent, 'clientOrderId'> & { clientOrderId?: string }): Promise<OrderAck> {
    const full: OrderIntent = { ...intent, clientOrderId: intent.clientOrderId ?? crypto.randomUUID() }

    const parsed = OrderIntentSchema.safeParse(full)
    if (!parsed.success) {
      throw new OraValidationError('order intent failed client-side validation', { issues: parsed.error.issues })
    }
    const venueIssues = validateOrderForVenue(full, POLYMARKET_CAPABILITIES)
    if (venueIssues.length > 0) {
      throw new OraVenueUnsupportedError('order not supported on venue (client-side)', { issues: venueIssues })
    }

    try {
      return await this.client.http.request<OrderAck>('POST', '/agent/bot/orders', { body: full })
    } catch (err) {
      // S3: the 409 body carries no clientOrderId — re-attach the one we sent
      // so callers can correlate the duplicate against their own id.
      if (err instanceof OraDuplicateOrderError && err.clientOrderId === undefined) {
        throw new OraDuplicateOrderError(err.message, { clientOrderId: full.clientOrderId, requestId: err.requestId })
      }
      throw err
    }
  }

  limitBuy(p: { conditionId: string; outcome: Outcome; price: string; size: string; reason: Reason; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'buy', orderType: 'limit', timeInForce: 'gtc', price: p.price, size: p.size, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  limitSell(p: { conditionId: string; outcome: Outcome; price: string; size: string; reason: Reason; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'sell', orderType: 'limit', timeInForce: 'gtc', price: p.price, size: p.size, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  marketBuy(p: { conditionId: string; outcome: Outcome; amountUsdc: string; reason: Reason; timeInForce?: TimeInForce; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'buy', orderType: 'market', timeInForce: p.timeInForce ?? 'ioc', price: null, amountUsdc: p.amountUsdc, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  marketSell(p: { conditionId: string; outcome: Outcome; size: string; reason: Reason; timeInForce?: TimeInForce; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'sell', orderType: 'market', timeInForce: p.timeInForce ?? 'ioc', price: null, size: p.size, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  async cancel(orderId: string): Promise<CancelResult> {
    return this.client.http.request<CancelResult>('POST', `/agent/bot/orders/${orderId}/cancel`)
  }

  async cancelMany(orderIds: string[]): Promise<BulkCancelResult> {
    if (orderIds.length < 1 || orderIds.length > 100) {
      throw new OraValidationError('cancelMany requires 1-100 orderIds', { issues: { length: orderIds.length } })
    }
    return this.client.http.request<BulkCancelResult>('POST', '/agent/bot/orders/cancel-bulk', { body: { orderIds } })
  }

  async waitForFill(
    orderId: string,
    opts: { timeoutMs?: number; pollMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
  ): Promise<SdkOrder> {
    const timeoutMs = opts.timeoutMs ?? 30_000
    const pollMs = opts.pollMs ?? 1_000
    const now = opts.now ?? (() => Date.now())
    const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
    const deadline = now() + timeoutMs

    for (;;) {
      const order = await this.get(orderId)
      if (isTerminal(order.status)) {
        if (order.status === 'rejected') {
          throw new OraOrderRejected(`order ${orderId} was rejected by the venue`, { orderId, rawReason: order.rejectReason ?? undefined })
        }
        if (order.status === 'risk_rejected') {
          // S7: the polled row carries a free-text reject string, not the typed
          // risk enum, so surface it as `detail` (not `reason`) to avoid
          // implying it's one of the typed risk-reason values.
          throw new OraRiskRejected(`order ${orderId} was rejected by risk controls`, { orderId, detail: order.rejectReason ?? undefined })
        }
        return order // filled / partially_filled / cancelled / timeout
      }
      if (now() >= deadline) {
        throw new OraTimeoutError(orderId, order.status)
      }
      await sleep(pollMs)
    }
  }

  async submitAndWait(
    intent: Omit<OrderIntent, 'clientOrderId'> & { clientOrderId?: string },
    opts: { timeoutMs?: number; pollMs?: number } = {},
  ): Promise<SdkOrder> {
    const clientOrderId = intent.clientOrderId ?? crypto.randomUUID()
    let ack: OrderAck
    try {
      ack = await this.submit({ ...intent, clientOrderId })
    } catch (err) {
      if (err instanceof OraDuplicateOrderError) {
        const existing = (await this.list()).find((o) => o.clientOrderId === clientOrderId)
        if (!existing) throw err // outside the recent-orders window
        ack = { orderId: existing.id, venueOrderId: existing.venueOrderId }
      } else {
        throw err
      }
    }
    return this.waitForFill(ack.orderId, opts)
  }
}
