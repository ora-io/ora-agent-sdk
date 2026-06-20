import type { OraClient } from '../client'
import type { SdkReasoning } from '../contracts/entities'

export interface ThoughtInput {
  title: string
  summary: string
  body: string[]
}

export class ThoughtsResource {
  constructor(private readonly client: OraClient) {}

  push(input: ThoughtInput): Promise<SdkReasoning> {
    return this.client.http.request<SdkReasoning>('POST', '/agent/bot/thought', { body: input })
  }
}
