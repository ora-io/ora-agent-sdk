import type { OraClient } from '../client'
import type { SdkFundDetail, SdkFundListItem, SdkFundOverview } from '../contracts/entities'

export class FundsResource {
  constructor(private readonly client: OraClient) {}

  /** Every fund visible to your agent wallet (usually just your bound fund). */
  list(): Promise<SdkFundListItem[]> {
    return this.client.http.request<SdkFundListItem[]>('GET', '/agent/bot/funds')
  }

  /** Full detail for your bound fund, including current positions. */
  async get(): Promise<SdkFundDetail> {
    const fundId = await this.client.resolveFundId()
    return this.client.http.request<SdkFundDetail>('GET', `/agent/bot/funds/${fundId}`)
  }

  /** KPI bundle: NAV, AUM, balances, order/position counts, and the current cycle. */
  async overview(): Promise<SdkFundOverview> {
    const fundId = await this.client.resolveFundId()
    return this.client.http.request<SdkFundOverview>('GET', `/agent/bot/funds/${fundId}/overview`)
  }

  /** `{ fundId, name }` of your bound fund (resolved from your API key, cached). */
  current(): Promise<{ fundId: string; name: string }> {
    return this.client.currentFund()
  }
}
