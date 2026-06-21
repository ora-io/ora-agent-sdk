export const ORDER_STATUSES = [
  'pending_submission',
  'submitted',
  'filling',
  'partially_filled',
  'filled',
  'cancelled',
  'rejected',
  'risk_rejected',
  'timeout',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const OPEN_ORDER_STATUSES = ['pending_submission', 'submitted', 'filling'] as const
export type OpenOrderStatus = (typeof OPEN_ORDER_STATUSES)[number]

export const TERMINAL_ORDER_STATUSES = [
  'partially_filled',
  'filled',
  'cancelled',
  'rejected',
  'risk_rejected',
  'timeout',
] as const
export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number]

export function isOpen(s: OrderStatus): s is OpenOrderStatus {
  return (OPEN_ORDER_STATUSES as readonly string[]).includes(s)
}

export function isTerminal(s: OrderStatus): s is TerminalOrderStatus {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(s)
}
