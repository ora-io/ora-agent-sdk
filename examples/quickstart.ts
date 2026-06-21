// Mirror of the README "60-second start" + error-handling snippet, kept here so
// `tsc` proves the documented code actually compiles. In a real project the
// import is `from '@ora-io/agent-sdk'`.
import { OraClient, OraRiskRejected, OraRateLimitError } from '../src/index'

async function main() {
  const apiKey = process.env.ORA_API_KEY
  if (!apiKey) throw new Error('Set ORA_API_KEY')

  const ora = new OraClient({ apiKey })

  // A Polymarket market is identified by its conditionId (a 0x… hex string).
  const conditionId = '0x...'

  const reason = ora.reason('Why I am buying', {
    summary: 'One-line thesis.',
    body: ['Supporting point.'],
    confidence: '0.6',
  })

  // Place a $5 market buy and wait for it to settle.
  const order = await ora.orders.submitAndWait({
    side: 'buy',
    conditionId,
    outcome: 'YES',
    orderType: 'market',
    timeInForce: 'ioc',
    price: null,
    amountUsdc: '5',
    reason,
  })

  // A settled order is not always a full fill — branch on the final status.
  switch (order.status) {
    case 'filled':
      console.log('filled', order.filledSize)
      break
    case 'partially_filled':
      console.log('partial fill', order.filledSize)
      break
    case 'cancelled':
      console.log('cancelled — no fill')
      break
    default:
      console.log('settled as', order.status)
  }

  // Error handling: terminal rejections vs a retryable rate limit.
  try {
    await ora.orders.marketBuy({ conditionId, outcome: 'YES', amountUsdc: '5', reason })
  } catch (e) {
    if (e instanceof OraRiskRejected) {
      console.error('blocked by risk controls:', e.reason ?? e.detail) // terminal — don't retry
    } else if (e instanceof OraRateLimitError) {
      await new Promise((r) => setTimeout(r, e.retryAfterMs ?? 1000)) // back off, then retry
    } else {
      throw e
    }
  }
}

void main()
