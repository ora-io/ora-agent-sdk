import type { OrderStatus } from './contracts/order-status'

export class OraError extends Error {
  readonly code: string
  readonly requestId?: string
  /** HTTP status that produced this error, if any (stamped by toOraError). */
  httpStatus?: number
  constructor(code: string, message: string, requestId?: string) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.requestId = requestId
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class OraValidationError extends OraError {
  readonly issues?: unknown
  constructor(message: string, opts: { code?: string; issues?: unknown; requestId?: string } = {}) {
    super(opts.code ?? 'VALIDATION_ERROR', message, opts.requestId)
    this.issues = opts.issues
  }
}

export class OraVenueUnsupportedError extends OraError {
  readonly issues?: unknown
  constructor(message: string, opts: { code?: string; issues?: unknown; requestId?: string } = {}) {
    super(opts.code ?? 'ORDER_NOT_SUPPORTED_ON_VENUE', message, opts.requestId)
    this.issues = opts.issues
  }
}

export class OraRiskRejected extends OraError {
  readonly orderId?: string
  readonly reason?: string
  readonly detail?: unknown
  constructor(message: string, opts: { orderId?: string; reason?: string; detail?: unknown; requestId?: string } = {}) {
    super('ORDER_RISK_REJECTED', message, opts.requestId)
    this.orderId = opts.orderId
    this.reason = opts.reason
    this.detail = opts.detail
  }
}

export class OraInsufficientBalance extends OraError {
  readonly available?: string
  readonly required?: string
  constructor(message: string, opts: { available?: string; required?: string; requestId?: string } = {}) {
    super('INSUFFICIENT_AVAILABLE_BALANCE', message, opts.requestId)
    this.available = opts.available
    this.required = opts.required
  }
}

export class OraOrderRejected extends OraError {
  readonly orderId?: string
  readonly reason?: string
  readonly rawReason?: string
  constructor(message: string, opts: { orderId?: string; reason?: string; rawReason?: string; requestId?: string } = {}) {
    super('ORDER_REJECTED', message, opts.requestId)
    this.orderId = opts.orderId
    this.reason = opts.reason
    this.rawReason = opts.rawReason
  }
}

export class OraDuplicateOrderError extends OraError {
  readonly clientOrderId?: string
  constructor(message: string, opts: { clientOrderId?: string; requestId?: string } = {}) {
    super('DUPLICATE_CLIENT_ORDER_ID', message, opts.requestId)
    this.clientOrderId = opts.clientOrderId
  }
}

export class OraOrderStateError extends OraError {
  readonly status?: string
  readonly venueReason?: string
  constructor(code: string, message: string, opts: { status?: string; venueReason?: string; requestId?: string } = {}) {
    super(code, message, opts.requestId)
    this.status = opts.status
    this.venueReason = opts.venueReason
  }
}

export class OraAuthError extends OraError {}

export class OraNotFoundError extends OraError {
  constructor(message: string, opts: { code?: string; requestId?: string } = {}) {
    super(opts.code ?? 'NOT_FOUND', message, opts.requestId)
  }
}

export class OraRateLimitError extends OraError {
  readonly retryAfterMs?: number
  constructor(message: string, opts: { retryAfterMs?: number; requestId?: string } = {}) {
    super('RATE_LIMITED', message, opts.requestId)
    this.retryAfterMs = opts.retryAfterMs
  }
}

export class OraTimeoutError extends OraError {
  readonly orderId: string
  readonly lastStatus: OrderStatus
  constructor(orderId: string, lastStatus: OrderStatus) {
    super('SDK_TIMEOUT', `timed out waiting for order ${orderId} to reach a terminal status (last: ${lastStatus})`)
    this.orderId = orderId
    this.lastStatus = lastStatus
  }
}

export class OraNetworkError extends OraError {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super('SDK_NETWORK_ERROR', message)
    this.cause = cause
  }
}
