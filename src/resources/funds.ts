import type { OraClient } from '../client'
import type { SdkFundDetail, SdkFundListItem, SdkFundOverview } from '../contracts/entities'

export class FundsResource {
  constructor(private readonly client: OraClient) {}

  list(): Promise<SdkFundListItem[]> {
    return this.client.http.request<SdkFundListItem[]>('GET', '/agent/bot/funds')
  }

  async get(): Promise<SdkFundDetail> {
    const fundId = await this.client.resolveFundId()
    return this.client.http.request<SdkFundDetail>('GET', `/agent/bot/funds/${fundId}`)
  }

  async overview(): Promise<SdkFundOverview> {
    const fundId = await this.client.resolveFundId()
    return this.client.http.request<SdkFundOverview>('GET', `/agent/bot/funds/${fundId}/overview`)
  }

  current(): Promise<{ fundId: string; name: string }> {
    return this.client.currentFund()
  }
}
