import { describe, expect, it } from 'vitest'
import {
  toOraError, OraRiskRejected, OraInsufficientBalance, OraDuplicateOrderError,
  OraOrderStateError, OraVenueUnsupportedError, OraAuthError, OraNotFoundError,
  OraRateLimitError, OraValidationError,
} from '../src/errors'

const env = (code: string, extra: Record<string, unknown> = {}) => ({ success: false, error: { code, message: code, ...extra } })

describe('toOraError', () => {
  it('maps ORDER_RISK_REJECTED (422) to OraRiskRejected with reason+detail', () => {
    const e = toOraError(422, env('ORDER_RISK_REJECTED', { orderId: 'o1', reason: 'CAP_EXCEEDED', detail: { x: 1 } }))
    expect(e).toBeInstanceOf(OraRiskRejected)
    expect((e as OraRiskRejected).reason).toBe('CAP_EXCEEDED')
  })

  it('maps INSUFFICIENT_AVAILABLE_BALANCE with available/required', () => {
    const e = toOraError(400, env('INSUFFICIENT_AVAILABLE_BALANCE', { available: '5', required: '10' }))
    expect(e).toBeInstanceOf(OraInsufficientBalance)
    expect((e as OraInsufficientBalance).required).toBe('10')
  })

  it('maps DUPLICATE_CLIENT_ORDER_ID (409)', () => {
    expect(toOraError(409, env('DUPLICATE_CLIENT_ORDER_ID'))).toBeInstanceOf(OraDuplicateOrderError)
  })

  it('maps the three cancel-state codes to OraOrderStateError', () => {
    for (const c of ['ORDER_NOT_CANCELLABLE', 'ORDER_NOT_AT_VENUE', 'CANCEL_REFUSED']) {
      const e = toOraError(400, env(c, { status: 'filled', venueReason: 'too late' }))
      expect(e).toBeInstanceOf(OraOrderStateError)
      expect(e.code).toBe(c)
    }
  })

  it('maps venue, auth, not-found, rate-limit, and validation codes', () => {
    expect(toOraError(400, env('ORDER_NOT_SUPPORTED_ON_VENUE', { issues: [] }))).toBeInstanceOf(OraVenueUnsupportedError)
    expect(toOraError(401, env('UNAUTHORIZED'))).toBeInstanceOf(OraAuthError)
    expect(toOraError(403, env('FORBIDDEN'))).toBeInstanceOf(OraAuthError)
    expect(toOraError(404, env('ORDER_NOT_FOUND'))).toBeInstanceOf(OraNotFoundError)
    expect(toOraError(429, env('RATE_LIMITED'))).toBeInstanceOf(OraRateLimitError)
    expect(toOraError(422, env('VALIDATION_ERROR', { issues: [] }))).toBeInstanceOf(OraValidationError)
  })

  it('maps EMPTY_ORDER_IDS to OraValidationError', () => {
    expect(toOraError(400, env('EMPTY_ORDER_IDS'))).toBeInstanceOf(OraValidationError)
  })

  it('surfaces server-side validation issues sent under the `errors` key', () => {
    // The backend reports DTO validation failures with the zod issue list under
    // `errors` (not `issues`); the SDK must still expose them on `.issues`.
    const issues = [{ code: 'invalid_type', path: ['size'], message: 'Required' }]
    const e = toOraError(400, env('VALIDATION_ERROR', { errors: issues }))
    expect(e).toBeInstanceOf(OraValidationError)
    expect((e as OraValidationError).issues).toEqual(issues)
  })

  it('surfaces server-side validation issues sent under the `details` key', () => {
    const details = [{ field: 'amountUsdc', message: 'must be a positive decimal string' }]
    const e = toOraError(422, env('VALIDATION_ERROR', { details }))
    expect((e as OraValidationError).issues).toEqual(details)
  })

  it('still reads the legacy `issues` key when present', () => {
    const e = toOraError(400, env('VALIDATION_ERROR', { issues: [{ path: ['x'] }] }))
    expect((e as OraValidationError).issues).toEqual([{ path: ['x'] }])
  })

  it('reads the Retry-After header into retryAfterMs for 429', () => {
    const e = toOraError(429, env('RATE_LIMITED'), new Headers({ 'retry-after': '2' }))
    expect(e).toBeInstanceOf(OraRateLimitError)
    expect((e as OraRateLimitError).retryAfterMs).toBe(2000)
  })

  it('stamps httpStatus on the mapped error', () => {
    expect(toOraError(503, undefined).httpStatus).toBe(503)
  })

  it('falls back to base OraError for unknown codes, preserving the code', () => {
    const e = toOraError(400, env('SOME_FUTURE_CODE'))
    expect(e.code).toBe('SOME_FUTURE_CODE')
  })
})
