import { OraError, OraNetworkError, toOraError } from './errors'

export type FetchLike = typeof fetch

export interface OraHttpClientOptions {
  apiKey: string
  baseUrl: string
  fetch: FetchLike
  maxRetries?: number
  /** test seam; defaults to a real backoff timer */
  sleep?: (ms: number) => Promise<void>
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
  private readonly sleep: (ms: number) => Promise<void>

  constructor(opts: OraHttpClientOptions) {
    this.apiKey = opts.apiKey
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.fetchImpl = opts.fetch
    this.maxRetries = opts.maxRetries ?? 3
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const retryable = method.toUpperCase() === 'GET'
    let lastErr: unknown
    for (let attempt = 0; attempt <= (retryable ? this.maxRetries : 0); attempt++) {
      try {
        return await this.send<T>(method, path, opts)
      } catch (err) {
        lastErr = err
        const isNetwork = !(err instanceof OraError)
        const is5xx = err instanceof OraError && (err.httpStatus ?? 0) >= 500
        if (!retryable || !(isNetwork || is5xx) || attempt === this.maxRetries) {
          if (isNetwork) throw new OraNetworkError(`network request failed: ${String((err as Error).message ?? err)}`, err)
          throw err
        }
        const backoff = Math.min(2000, 100 * 2 ** attempt)
        const jitter = backoff * 0.25 * attemptJitter(attempt)
        await this.sleep(backoff + jitter)
      }
    }
    throw lastErr
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

// Deterministic, seed-free pseudo-jitter keyed on attempt (avoids Math.random
// for reproducibility; spreads retries without a true RNG).
function attemptJitter(attempt: number): number {
  return ((attempt * 2654435761) % 1000) / 1000
}
