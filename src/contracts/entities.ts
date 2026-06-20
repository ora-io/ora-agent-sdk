import type { OrderSide, OrderType, Outcome, TimeInForce } from './order-intent'
import type { OrderStatus } from './order-status'

export interface SdkOrderEvent {
  eventType: 'submitted' | 'fill' | 'cancel' | 'reject'
  payload: Record<string, unknown> | null
  transactionHash: string | null
  confirmationLevel: 'matched' | 'mined' | 'confirmed' | null
  createdAt: string
}

export interface SdkOrder {
  id: string
  clientOrderId: string
  venue: string
  instrument: string
  side: OrderSide
  orderType: OrderType
  timeInForce: TimeInForce
  /** non-null for LIMIT orders */
  price: string | null
  conditionId: string
  outcome: Outcome
  /** For MARKET BUY this is a worst-case overfill ceiling until terminal,
   *  then backfilled to actual filled shares. Read `amountUsdc`/`filledSize`
   *  for true progress on a market buy — do not read `size`. */
  size: string | null
  /** non-null for MARKET BUY (USDC spend budget) */
  amountUsdc: string | null
  status: OrderStatus
  filledSize: string | null
  /** weighted avg of confirmed fills; null until any fill */
  avgFillPrice: string | null
  reservedUsdc: string | null
  rejectReason: string | null
  venueOrderId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  // listOrders enrichment (undefined on market-cache miss)
  marketQuestion?: string
  marketEndDate?: string
  polymarketUrl?: string
  // getOrder only
  events?: SdkOrderEvent[]
}

export interface SdkPosition {
  instrument: string
  quantity: string
  avgEntryPrice: string | null
  currentMarkPrice: string | null
  unrealizedPnl: string | null
  costBasisUsdc: string | null
  /** non-null once the market resolves */
  realizedPnl: string | null
  marketStatus: 'active' | 'resolved_win' | 'resolved_loss' | 'expired'
  /** finding-② spread visibility, optional */
  currentSpread?: string | null
  marketQuestion?: string
  marketEndDate?: string
  polymarketUrl?: string
  resolvedAt?: string | null
}

export interface SdkFundListItem {
  id: string
  name: string
  status: string
  strategyDescription: string
  strategyVersion: number
  navPerShare: string
  totalShares: string
  aum: string
  performanceFeeRate: string
  subscriptionOpen: boolean
  redemptionOpen: boolean
  agentName: string | null
  createdAt: string
}

export interface SdkFundDetail extends SdkFundListItem {
  positions?: SdkPosition[]
}

export interface SdkFundOverview {
  agentName: string
  fundName: string
  fundStatus: string
  navPerShare: string
  aum: string
  totalShares: string
  ordersCount: number
  filledCount: number
  rejectedCount: number
  positionsCount: number
  investorsCount: number
  availableBalance: number
  reservedBalance: number
}

export interface SdkReasoning {
  id: string
  ts: string
  fundId: string
  agentId: string
  kind: string
  title: string
  summary: string
  body: string[]
  confidence: string | null
  size: string | null
  orderRef: string | null
}

export interface OrderAck {
  orderId: string
  venueOrderId: string | null
}

export interface CancelResult {
  orderId: string
  status: 'cancelled'
}

export interface BulkCancelResult {
  cancelled: string[]
  failed: Array<{ orderId: string; reason: string }>
}
