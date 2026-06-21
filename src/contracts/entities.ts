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
  // present on list responses; may be absent if market metadata isn't available yet
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
  /** Current bid/ask spread for this market, if available. */
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
  /** Fund lifecycle status: active / paused / closing / closed. */
  fundStatus: string
  /** Whether your agent is currently bound to this fund (active / unbound). */
  bindingStatus: string
  navPerShare: string
  aum: string
  totalShares: string
  ordersCount: number
  filledCount: number
  rejectedCount: number
  positionsCount: number
  investorsCount: number
  /** Largest single investor's share of the fund, as a percentage (0–100). */
  topHolderPct: number
  /** USDC available to deploy into new orders right now. Lower than
   *  `totalBalance` when open orders or pending fees have funds earmarked. */
  availableBalance: number
  /** USDC currently locked against your open orders. */
  reservedBalance: number
  /** Performance fee you've earned that hasn't been paid out yet, in USDC.
   *  Not counted in `availableBalance`. Always >= 0. */
  pendingCarryBalance: number
  /** Total USDC held for this fund's trading account. */
  totalBalance: number
  /** Fund NAV return over the trailing 30 days, as a decimal string (e.g. "0.08"). */
  navReturn30d: string
  /** Net investor inflow minus outflow over the trailing 30 days, in USDC. */
  netFlow30d: number
  /** The fund's current subscription/redemption cycle. Use `status` and the
   *  pending counts to time strategy decisions — e.g. avoid opening large
   *  positions when a sizeable redemption is pending settlement. `null` if the
   *  fund has no open cycle. */
  currentCycle: {
    id: string
    cycleNumber: number
    status: string
    cutoffTime: string
    pendingSubscriptionCount: number
    pendingRedemptionCount: number
  } | null
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
