import { describe, expect, it } from 'vitest'
import {
  ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  isOpen,
  isTerminal,
} from '../src/contracts/order-status'

describe('order-status', () => {
  it('has exactly the 9 canonical statuses', () => {
    expect([...ORDER_STATUSES]).toEqual([
      'pending_submission', 'submitted', 'filling', 'partially_filled',
      'filled', 'cancelled', 'rejected', 'risk_rejected', 'timeout',
    ])
  })

  it('partitions open vs terminal correctly', () => {
    expect([...OPEN_ORDER_STATUSES]).toEqual(['pending_submission', 'submitted', 'filling'])
    expect([...TERMINAL_ORDER_STATUSES]).toEqual([
      'partially_filled', 'filled', 'cancelled', 'rejected', 'risk_rejected', 'timeout',
    ])
  })

  it('classifies partially_filled as terminal and filling as open', () => {
    expect(isTerminal('partially_filled')).toBe(true)
    expect(isTerminal('filling')).toBe(false)
    expect(isOpen('filling')).toBe(true)
    expect(isOpen('filled')).toBe(false)
  })
})
