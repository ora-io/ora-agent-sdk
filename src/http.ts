import { OraError, toOraError } from './errors'

export type FetchLike = typeof fetch

export interface OraHttpClientOptions {
  apiKey: string
  baseUrl: string
  fetch: FetchLike
  maxRetries?: number
}

export interface RequestOptions {
  query?: Record<string, string | undefined>
  body?: unknown
}

export class OraHttpClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike
  protected readonly maxRetries: number

  constructor(opts: OraHttpClientOptions) {
    this.apiKey = opts.apiKey
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.fetchImpl = opts.fetch
    this.maxRetries = opts.maxRetries ?? 3
  }

  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    return this.send<T>(method, path, opts)
  }

  protected buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const url = new URL(this.baseUrl + path)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, v)
      }
    }
    return url.toString()
  }

  protected async send<T>(method: string, path: string, opts: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, opts.query)
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}` }
    let bodyInit: string | undefined
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json'
      bodyInit = JSON.stringify(opts.body)
    }

    const res = await this.fetchImpl(url, { method, headers, body: bodyInit })
    const text = await res.text()
    const payload: unknown = text.length > 0 ? safeJson(text) : undefined

    if (res.ok) {
      if (payload === undefined) return null as T
      const env = payload as { success?: boolean; data?: T }
      if (env && env.success === true) return env.data as T
      // Non-enveloped 2xx (defensive): return raw payload.
      return payload as T
    }

    throw toOraError(res.status, payload, res.headers)
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new OraError('SDK_BAD_RESPONSE', `non-JSON response body: ${text.slice(0, 200)}`)
  }
}
