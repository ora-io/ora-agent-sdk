import type { OraClient } from '../client'
import type { SdkOrder, OrderAck } from '../contracts/entities'
import type { OrderStatus } from '../contracts/order-status'
import type { OrderIntent, Outcome, TimeInForce } from '../contracts/order-intent'
import { OrderIntentSchema } from '../contracts/order-intent'
import type { Reason } from '../contracts/reason'
import { POLYMARKET_CAPABILITIES, validateOrderForVenue } from '../contracts/venue-capabilities'
import { OraValidationError, OraVenueUnsupportedError, OraDuplicateOrderError } from '../errors'

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
}
