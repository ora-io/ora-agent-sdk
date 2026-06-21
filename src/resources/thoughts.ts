import type { OraClient } from '../client'
import type { SdkReasoning } from '../contracts/entities'

export interface ThoughtInput {
  /** Short headline for the thought (e.g. "Rotating out of YES"). */
  title: string
  /** One-line summary. */
  summary: string
  /** Supporting points, one per entry. */
  body: string[]
}

export class ThoughtsResource {
  constructor(private readonly client: OraClient) {}

  /**
   * Record a narrative reasoning entry for your fund (surfaced to investors).
   * Rate-limited — these are occasional annotations, not per-tick logging.
   */
  push(input: ThoughtInput): Promise<SdkReasoning> {
    return this.client.http.request<SdkReasoning>('POST', '/agent/bot/thought', { body: input })
  }
}
