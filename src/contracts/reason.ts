import { z } from 'zod'

const nonBlank = (min: number, max: number) =>
  z.string().min(min).max(max).refine((v) => v.trim().length >= min, {
    message: `must be ${min}-${max} non-blank characters`,
  })

export const ReasonSchema = z.object({
  title: nonBlank(3, 200),
  summary: nonBlank(3, 500),
  body: z.array(nonBlank(1, 500)).min(1).max(20),
  confidence: z
    .string()
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/, 'must be a decimal string')
    .refine((v) => Number(v) >= 0 && Number(v) <= 1, 'must be in [0,1]')
    .refine((v) => {
      const frac = v.split('.')[1]
      return frac === undefined || frac.length <= 4
    }, 'at most 4 decimal places'),
})

export type Reason = {
  title: string
  summary: string
  body: string[]
  confidence: string
}
