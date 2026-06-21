import type { OraClient } from '../client'
import type { SdkOrder, OrderAck, CancelResult, BulkCancelResult } from '../contracts/entities'
import type { OrderStatus } from '../contracts/order-status'
import { isTerminal } from '../contracts/order-status'
import type { OrderIntent, Outcome, TimeInForce } from '../contracts/order-intent'
import { OrderIntentSchema } from '../contracts/order-intent'
import type { Reason } from '../contracts/reason'
import { POLYMARKET_CAPABILITIES, validateOrderForVenue } from '../contracts/venue-capabilities'
import { randomUUID } from 'node:crypto'
import { OraValidationError, OraVenueUnsupportedError, OraOrderRejected, OraRiskRejected, OraTimeoutError, OraDuplicateOrderError } from '../errors'

export class OrdersResource {
  constructor(private readonly client: OraClient) {}

  /** List your fund's orders, newest first. Optionally filter by status. */
  async list(opts: { status?: OrderStatus } = {}): Promise<SdkOrder[]> {
    const fundId = await this.client.resolveFundId()
    return this.client.http.request<SdkOrder[]>('GET', `/agent/bot/funds/${fundId}/orders`, {
      query: { status: opts.status },
    })
  }

  /** Fetch a single order by id, including its event timeline. */
  get(orderId: string): Promise<SdkOrder> {
    return this.client.http.request<SdkOrder>('GET', `/agent/bot/orders/${orderId}`)
  }

  /**
   * Submit a full order intent. Prefer the typed helpers
   * ({@link limitBuy}/{@link limitSell}/{@link marketBuy}/{@link marketSell})
   * unless you need an unusual combination. The intent is validated locally
   * before any request is sent; a missing `clientOrderId` is generated for you.
   * On a duplicate, throws {@link OraDuplicateOrderError} carrying your id.
   */
  async submit(intent: Omit<OrderIntent, 'clientOrderId'> & { clientOrderId?: string }): Promise<OrderAck> {
    const full: OrderIntent = { ...intent, clientOrderId: intent.clientOrderId ?? randomUUID() }

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
      // the 409 body carries no clientOrderId — re-attach the one we sent
      // so callers can correlate the duplicate against their own id.
      if (err instanceof OraDuplicateOrderError && err.clientOrderId === undefined) {
        throw new OraDuplicateOrderError(err.message, { clientOrderId: full.clientOrderId, requestId: err.requestId })
      }
      throw err
    }
  }

  /** Good-till-cancelled limit buy. `price` and `size` are decimal strings. */
  limitBuy(p: { conditionId: string; outcome: Outcome; price: string; size: string; reason: Reason; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'buy', orderType: 'limit', timeInForce: 'gtc', price: p.price, size: p.size, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  /** Good-till-cancelled limit sell. `price` and `size` are decimal strings. */
  limitSell(p: { conditionId: string; outcome: Outcome; price: string; size: string; reason: Reason; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'sell', orderType: 'limit', timeInForce: 'gtc', price: p.price, size: p.size, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  /**
   * Market buy sized by `amountUsdc` (your USDC spend cap). Defaults to `'ioc'`
   * (fill now, cancel the rest; pass `'fok'` for all-or-nothing). NOTE: the
   * resulting order's `size` is a worst-case ceiling until it settles — read
   * `amountUsdc` and `filledSize` for true progress, not `size`.
   */
  marketBuy(p: { conditionId: string; outcome: Outcome; amountUsdc: string; reason: Reason; timeInForce?: TimeInForce; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'buy', orderType: 'market', timeInForce: p.timeInForce ?? 'ioc', price: null, amountUsdc: p.amountUsdc, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  /** Market sell sized by `size` (shares, a decimal string). Defaults to `'ioc'`. */
  marketSell(p: { conditionId: string; outcome: Outcome; size: string; reason: Reason; timeInForce?: TimeInForce; clientOrderId?: string }): Promise<OrderAck> {
    return this.submit({ side: 'sell', orderType: 'market', timeInForce: p.timeInForce ?? 'ioc', price: null, size: p.size, conditionId: p.conditionId, outcome: p.outcome, reason: p.reason, clientOrderId: p.clientOrderId })
  }

  /** Cancel a single open order. */
  async cancel(orderId: string): Promise<CancelResult> {
    return this.client.http.request<CancelResult>('POST', `/agent/bot/orders/${orderId}/cancel`)
  }

  /** Cancel 1–100 orders at once. Returns which ids cancelled and which failed. */
  async cancelMany(orderIds: string[]): Promise<BulkCancelResult> {
    if (orderIds.length < 1 || orderIds.length > 100) {
      throw new OraValidationError('cancelMany requires 1-100 orderIds', { issues: { length: orderIds.length } })
    }
    return this.client.http.request<BulkCancelResult>('POST', '/agent/bot/orders/cancel-bulk', { body: { orderIds } })
  }

  /**
   * Poll an order until it reaches a terminal status. Resolves on
   * `filled`/`partially_filled`/`cancelled`/`timeout` (always branch on
   * `order.status` — a resolved promise is not proof of a fill) and throws
   * {@link OraOrderRejected}/{@link OraRiskRejected} on rejection. If your local
   * `timeoutMs` (default 30s) elapses while still polling, throws
   * {@link OraTimeoutError} — distinct from an `order.status === 'timeout'`.
   */
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
          // A rejected order surfaces a free-text reject string rather than a
          // structured reason code, so expose it as `detail` (not `reason`) to
          // avoid implying it's a typed value.
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

  /**
   * {@link submit} then {@link waitForFill} in one call. Branch on the returned
   * `order.status`. If the submit hits a duplicate `clientOrderId`, recovers by
   * looking the order up — but only while it's still in the recent-orders
   * window; after a long gap the duplicate error propagates.
   */
  async submitAndWait(
    intent: Omit<OrderIntent, 'clientOrderId'> & { clientOrderId?: string },
    opts: { timeoutMs?: number; pollMs?: number } = {},
  ): Promise<SdkOrder> {
    const clientOrderId = intent.clientOrderId ?? randomUUID()
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
