import { z } from 'zod'
import { ReasonSchema } from './reason'

export type OrderSide = 'buy' | 'sell'
export type Outcome = 'YES' | 'NO'
export type OrderType = 'limit' | 'market'
export type TimeInForce = 'gtc' | 'gtd' | 'fok' | 'ioc'

export interface OrderIntent {
  clientOrderId: string
  side: OrderSide
  conditionId: string
  outcome: Outcome
  orderType: OrderType
  timeInForce: TimeInForce
  price: string | null
  size?: string
  amountUsdc?: string
  reason: import('./reason').Reason
  metadata?: Record<string, unknown>
}

const decimalString = z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/, 'must be a decimal string')
const positiveDecimalString = decimalString.refine((v) => Number(v) > 0, 'must be > 0')
const bytes32Hex = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'must be 0x + 64 hex chars')

export const OrderIntentSchema = z
  .object({
    clientOrderId: z.string().min(1).max(128),
    side: z.enum(['buy', 'sell']),
    conditionId: bytes32Hex,
    outcome: z.enum(['YES', 'NO']),
    orderType: z.enum(['limit', 'market']),
    timeInForce: z.enum(['gtc', 'gtd', 'fok', 'ioc']),
    price: decimalString.nullable(),
    size: positiveDecimalString.optional(),
    amountUsdc: positiveDecimalString.optional(),
    reason: ReasonSchema,
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })

    if (v.orderType === 'market' && v.timeInForce === 'gtc') {
      issue('timeInForce', 'market orders cannot use gtc')
    }

    if (v.orderType === 'limit') {
      if (v.price === null) issue('price', 'limit orders require price')
      if (v.size === undefined) issue('size', 'limit orders require size')
      if (v.amountUsdc !== undefined) issue('amountUsdc', 'limit orders must not set amountUsdc')
    }

    if (v.orderType === 'market' && v.side === 'buy') {
      if (v.amountUsdc === undefined) issue('amountUsdc', 'market buy requires amountUsdc')
      if (v.size !== undefined) issue('size', 'market buy must not set size')
      if (v.price !== null) issue('price', 'market buy requires null price')
    }

    if (v.orderType === 'market' && v.side === 'sell') {
      if (v.size === undefined) issue('size', 'market sell requires size')
      if (v.amountUsdc !== undefined) issue('amountUsdc', 'market sell must not set amountUsdc')
      if (v.price !== null) issue('price', 'market sell requires null price')
    }
  })
