import type { OrderSide, OrderType, TimeInForce } from './order-intent'

export interface VenueOrderCapabilities {
  sides: readonly OrderSide[]
  timeInForceByOrderType: Record<OrderType, readonly TimeInForce[]>
}

export const POLYMARKET_CAPABILITIES: VenueOrderCapabilities = {
  sides: ['buy', 'sell'],
  timeInForceByOrderType: {
    limit: ['gtc', 'gtd'],
    market: ['fok', 'ioc'],
  },
}

export interface VenueValidationIssue {
  field: string
  code: string
  message: string
}

export function validateOrderForVenue(
  intent: { side: OrderSide; orderType: OrderType; timeInForce: TimeInForce },
  caps: VenueOrderCapabilities,
): VenueValidationIssue[] {
  const issues: VenueValidationIssue[] = []

  if (!caps.sides.includes(intent.side)) {
    issues.push({ field: 'side', code: 'SIDE_NOT_SUPPORTED_ON_VENUE', message: `side '${intent.side}' is not supported on this venue` })
  }

  const tifs = caps.timeInForceByOrderType[intent.orderType]
  if (!tifs) {
    issues.push({ field: 'orderType', code: 'ORDER_TYPE_NOT_SUPPORTED_ON_VENUE', message: `orderType '${intent.orderType}' is not supported on this venue` })
  } else if (!tifs.includes(intent.timeInForce)) {
    issues.push({ field: 'timeInForce', code: 'TIF_NOT_SUPPORTED_FOR_ORDER_TYPE', message: `timeInForce '${intent.timeInForce}' is not allowed for orderType '${intent.orderType}'` })
  }

  return issues
}
