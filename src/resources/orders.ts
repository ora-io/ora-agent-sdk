import type { OraClient } from '../client'
import type { SdkOrder } from '../contracts/entities'
import type { OrderStatus } from '../contracts/order-status'

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
}
