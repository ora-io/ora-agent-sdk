import { describe, expect, it } from 'vitest'
import { VERSION } from '../src/index'

describe('package smoke', () => {
  it('exports a version string', () => {
    expect(typeof VERSION).toBe('string')
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
