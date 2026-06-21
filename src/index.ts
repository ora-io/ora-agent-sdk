export const VERSION = '0.1.0'

export { OraClient } from './client'
export type { OraClientOptions } from './client'
export type { FetchLike } from './http'
export type { ThoughtInput } from './resources/thoughts'

export {
  OraError,
  OraValidationError,
  OraVenueUnsupportedError,
  OraRiskRejected,
  OraInsufficientBalance,
  OraOrderRejected,
  OraDuplicateOrderError,
  OraOrderStateError,
  OraAuthError,
  OraNotFoundError,
  OraRateLimitError,
  OraTimeoutError,
  OraNetworkError,
  toOraError,
} from './errors'

export {
  ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  isOpen,
  isTerminal,
} from './contracts/order-status'
export type { OrderStatus, OpenOrderStatus, TerminalOrderStatus } from './contracts/order-status'

export { ReasonSchema } from './contracts/reason'
export type { Reason } from './contracts/reason'

export { OrderIntentSchema } from './contracts/order-intent'
export type { OrderIntent, OrderSide, Outcome, OrderType, TimeInForce } from './contracts/order-intent'

export { POLYMARKET_CAPABILITIES, validateOrderForVenue } from './contracts/venue-capabilities'
export type { VenueOrderCapabilities, VenueValidationIssue } from './contracts/venue-capabilities'

export type {
  SdkOrder,
  SdkOrderEvent,
  SdkPosition,
  SdkFundListItem,
  SdkFundDetail,
  SdkFundOverview,
  SdkReasoning,
  OrderAck,
  CancelResult,
  BulkCancelResult,
} from './contracts/entities'
