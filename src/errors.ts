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

interface ErrorEnvelope {
  code: string
  message: string
  requestId?: string
  issues?: unknown
  /** Field-level validation issues; the server sends these under `errors`. */
  errors?: unknown
  /** Field-level validation issues for non-schema checks. */
  details?: unknown
  detail?: unknown
  available?: string
  required?: string
  orderId?: string
  reason?: string
  rawReason?: string
  status?: string
  venueReason?: string
  clientOrderId?: string
  retryAfterMs?: number
  [k: string]: unknown
}

export function toOraError(status: number, body: unknown, headers?: Headers): OraError {
  const err = (body as { error?: ErrorEnvelope } | undefined)?.error
  const code = err?.code ?? statusToCode(status)
  const message = err?.message ?? code
  const requestId = err?.requestId
  const mapped = mapByCode(code, message, err, requestId, headers)
  mapped.httpStatus = status // retry decisions branch on the real HTTP status
  return mapped
}

function mapByCode(
  code: string,
  message: string,
  err: ErrorEnvelope | undefined,
  requestId: string | undefined,
  headers: Headers | undefined,
): OraError {
  switch (code) {
    case 'ORDER_RISK_REJECTED':
      return new OraRiskRejected(message, { orderId: err?.orderId, reason: err?.reason, detail: err?.detail, requestId })
    case 'INSUFFICIENT_AVAILABLE_BALANCE':
      return new OraInsufficientBalance(message, { available: err?.available, required: err?.required, requestId })
    case 'ORDER_REJECTED':
      return new OraOrderRejected(message, { orderId: err?.orderId, reason: err?.reason, rawReason: err?.rawReason, requestId })
    case 'DUPLICATE_CLIENT_ORDER_ID':
      // the body has no clientOrderId; submit() re-attaches the local one.
      return new OraDuplicateOrderError(message, { requestId })
    case 'ORDER_NOT_CANCELLABLE':
    case 'ORDER_NOT_AT_VENUE':
    case 'CANCEL_REFUSED':
      return new OraOrderStateError(code, message, { status: err?.status, venueReason: err?.venueReason, requestId })
    case 'ORDER_NOT_SUPPORTED_ON_VENUE':
    case 'VENUE_NOT_SUPPORTED':
      return new OraVenueUnsupportedError(message, { code, issues: pickIssues(err), requestId })
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return new OraAuthError(code, message, requestId)
    case 'NOT_FOUND':
    case 'ORDER_NOT_FOUND':
    case 'FUND_NOT_FOUND':
      return new OraNotFoundError(message, { code, requestId })
    case 'RATE_LIMITED':
      // retryAfterMs isn't in the body; read it from the Retry-After header.
      return new OraRateLimitError(message, { retryAfterMs: parseRetryAfterMs(headers), requestId })
    case 'EMPTY_ORDER_IDS':
    case 'VALIDATION_ERROR':
      return new OraValidationError(message, { code, issues: pickIssues(err), requestId })
    default:
      return new OraError(code, message, requestId)
  }
}

// Field-level validation detail can arrive under any of three keys depending on
// the source: `errors` (schema validation), `details` (non-schema checks), or
// the legacy `issues`. Surface whichever is present on a single `.issues`.
function pickIssues(err: ErrorEnvelope | undefined): unknown {
  return err?.issues ?? err?.errors ?? err?.details
}

function parseRetryAfterMs(headers?: Headers): number | undefined {
  const raw = headers?.get('retry-after')
  if (!raw) return undefined
  const secs = Number(raw)
  return Number.isFinite(secs) ? Math.round(secs * 1000) : undefined
}

function statusToCode(status: number): string {
  switch (status) {
    case 400: return 'VALIDATION_ERROR'
    case 401: return 'UNAUTHORIZED'
    case 403: return 'FORBIDDEN'
    case 404: return 'NOT_FOUND'
    case 422: return 'VALIDATION_ERROR'
    case 429: return 'RATE_LIMITED'
    default: return status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR'
  }
}
