import { OraHttpClient, type FetchLike } from './http'
import { OraError } from './errors'
import { FundsResource } from './resources/funds'
import type { Reason } from './contracts/reason'
import type { SdkFundListItem } from './contracts/entities'

const DEFAULT_BASE_URL = 'https://api.ora.io/api/v1'

export interface OraClientOptions {
  apiKey: string
  baseUrl?: string
  fetch?: FetchLike
  maxRetries?: number
}

export class OraClient {
  readonly http: OraHttpClient
  readonly funds: FundsResource
  private readonly fundPrefix: string
  private cachedFund?: SdkFundListItem

  constructor(opts: OraClientOptions) {
    if (!opts.apiKey || !opts.apiKey.startsWith('ora_live_')) {
      throw new OraError('SDK_BAD_API_KEY', 'apiKey must be an ora_live_ per-Fund API key')
    }
    const segments = opts.apiKey.split('_')
    // ora_live_<env>_<agentId6>_<fundId6>_<epoch>_<random> → index 4
    const fundPrefix = segments[4]
    if (!fundPrefix) {
      throw new OraError('SDK_BAD_API_KEY', 'apiKey is missing the fund prefix segment')
    }
    this.fundPrefix = fundPrefix

    const fetchImpl = opts.fetch ?? globalThis.fetch
    if (!fetchImpl) {
      throw new OraError('SDK_NO_FETCH', 'global fetch is unavailable; pass opts.fetch (Node 18+ required)')
    }
    this.http = new OraHttpClient({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
      fetch: fetchImpl,
      maxRetries: opts.maxRetries,
    })
    this.funds = new FundsResource(this)
  }

  /** Lazily resolve and cache the single fund this key is scoped to. */
  async resolveFundId(): Promise<string> {
    return (await this.resolveFund()).id
  }

  async currentFund(): Promise<{ fundId: string; name: string }> {
    const fund = await this.resolveFund()
    return { fundId: fund.id, name: fund.name }
  }

  private async resolveFund(): Promise<SdkFundListItem> {
    if (this.cachedFund) return this.cachedFund
    const funds = await this.http.request<SdkFundListItem[]>('GET', '/agent/bot/funds')
    const match = funds.find((f) => f.id.startsWith(this.fundPrefix))
    if (!match) {
      throw new OraError('FUND_SCOPE_UNRESOLVED', `FUND_SCOPE_UNRESOLVED: no fund returned by /funds matches the key fund prefix '${this.fundPrefix}'`)
    }
    this.cachedFund = match
    return match
  }

  /** Build a Reason scaffold for attaching to an order intent. */
  reason(title: string, opts: { summary: string; body: string[]; confidence: string }): Reason {
    return { title, summary: opts.summary, body: opts.body, confidence: opts.confidence }
  }
}
