import type { OraClient } from '../client'
import type { SdkPosition } from '../contracts/entities'

export class PositionsResource {
  constructor(private readonly client: OraClient) {}

  async list(): Promise<SdkPosition[]> {
    const fundId = await this.client.resolveFundId()
    return this.client.http.request<SdkPosition[]>('GET', `/agent/bot/funds/${fundId}/positions`)
  }
}
