import { OraClient, OraRiskRejected, OraTimeoutError } from '../src/index'

async function main() {
  const ora = new OraClient({ apiKey: process.env.ORA_API_KEY ?? '' })

  const overview = await ora.funds.overview()
  console.log(`Fund ${overview.fundName} — available ${overview.availableBalance} USDC`)

  const conditionId = process.env.CONDITION_ID ?? ''
  try {
    const order = await ora.orders.submitAndWait(
      {
        side: 'buy',
        conditionId,
        outcome: 'YES',
        orderType: 'market',
        timeInForce: 'ioc',
        price: null,
        amountUsdc: '5',
        reason: ora.reason('Testing a small market buy', {
          summary: 'Probing fill behavior with a tiny notional.',
          body: ['Small size to validate the end-to-end loop.'],
          confidence: '0.5',
        }),
      },
      { timeoutMs: 30_000 },
    )
    console.log(`Order ${order.id} → ${order.status}, filled ${order.filledSize ?? '0'} shares`)

    await ora.thoughts.push({
      title: 'Probe complete',
      summary: `Market buy settled as ${order.status}.`,
      body: [`filledSize=${order.filledSize ?? '0'}`],
    })
  } catch (err) {
    if (err instanceof OraRiskRejected) console.error(`Risk rejected: ${err.reason}`)
    else if (err instanceof OraTimeoutError) console.error(`Timed out (last status: ${err.lastStatus}); GET later to confirm.`)
    else throw err
  }
}

void main()
