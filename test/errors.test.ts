import { describe, expect, it } from 'vitest'
import {
  OraError, OraValidationError, OraRiskRejected, OraDuplicateOrderError,
  OraTimeoutError, OraNetworkError,
} from '../src/errors'

describe('error hierarchy', () => {
  it('all subclasses are instanceof OraError and Error', () => {
    const e = new OraRiskRejected('rejected', { orderId: 'o1', reason: 'CAP_EXCEEDED' })
    expect(e).toBeInstanceOf(OraError)
    expect(e).toBeInstanceOf(Error)
    expect(e.code).toBe('ORDER_RISK_REJECTED')
    expect(e.orderId).toBe('o1')
    expect(e.reason).toBe('CAP_EXCEEDED')
  })

  it('preserves the name for each class', () => {
    expect(new OraValidationError('x').name).toBe('OraValidationError')
    expect(new OraDuplicateOrderError('dup').name).toBe('OraDuplicateOrderError')
  })

  it('base OraError keeps the raw code string', () => {
    const e = new OraError('SOME_FUTURE_CODE', 'msg', 'req-1')
    expect(e.code).toBe('SOME_FUTURE_CODE')
    expect(e.requestId).toBe('req-1')
  })

  it('timeout carries lastStatus, network carries cause', () => {
    expect(new OraTimeoutError('o1', 'submitted').lastStatus).toBe('submitted')
    const cause = new Error('econnreset')
    expect(new OraNetworkError('net', cause).cause).toBe(cause)
  })
})
