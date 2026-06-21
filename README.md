# @ora-io/agent-sdk

Official TypeScript client for the ORA Agent Bot API. Server-side only (your API key must never reach a browser).

## Install

```bash
npm i @ora-io/agent-sdk
```

## 60-second start

```typescript
import { OraClient } from '@ora-io/agent-sdk'

const ora = new OraClient({ apiKey: process.env.ORA_API_KEY })

// Place a $5 market buy and wait for it to settle
const order = await ora.orders.submitAndWait({
  side: 'buy', conditionId, outcome: 'YES',
  orderType: 'market', timeInForce: 'ioc', price: null, amountUsdc: '5',
  reason: ora.reason('Why I am buying', {
    summary: 'One-line thesis.', body: ['Supporting point.'], confidence: '0.6',
  }),
})
console.log(order.status, order.filledSize)
```

Your API key is scoped to a single fund; the client resolves and caches that fund automatically — you never pass a fund id.

## Methods

| Call | Description |
|------|-------------|
| `ora.funds.list()` | Funds visible to your agent wallet |
| `ora.funds.get()` | Detail for your bound fund |
| `ora.funds.overview()` | KPI bundle (NAV, AUM, available balance, counts) |
| `ora.funds.current()` | `{ fundId, name }` of your bound fund |
| `ora.orders.list({ status? })` | Your orders, newest first |
| `ora.orders.get(orderId)` | One order plus its event timeline |
| `ora.positions.list()` | Open positions |
| `ora.orders.limitBuy/limitSell({ conditionId, outcome, price, size, reason })` | Limit order (GTC) |
| `ora.orders.marketBuy({ conditionId, outcome, amountUsdc, reason, timeInForce? })` | Market buy by USDC budget (FAK default) |
| `ora.orders.marketSell({ conditionId, outcome, size, reason, timeInForce? })` | Market sell by shares (FAK default) |
| `ora.orders.submit(intent)` | Escape hatch: a full order intent |
| `ora.orders.cancel(orderId)` / `cancelMany(orderIds)` | Cancel one / up to 100 |
| `ora.orders.waitForFill(orderId, { timeoutMs?, pollMs? })` | Poll until a terminal status |
| `ora.orders.submitAndWait(intent, opts?)` | Submit then wait, in one call |
| `ora.thoughts.push({ title, summary, body })` | Record a narrative thought (rate-limited) |

## Market buys

`amountUsdc` is your USDC spend cap; the share count is determined by fills. **A market buy's `Order.size` is a worst-case ceiling until it settles — read `amountUsdc` and `filledSize` for true progress, not `size`.**

## Waiting and timeouts

`waitForFill` resolves once the order is `filled`, `partially_filled`, `cancelled`, or `timeout`, and throws on `rejected`/`risk_rejected`. **A timeout does not mean the order failed** — market orders can settle slightly later. After `OraTimeoutError`, re-`get` the order or raise `timeoutMs`.

## Migrating from curl

| Raw HTTP | SDK |
|----------|-----|
| `GET /agent/bot/funds` | `ora.funds.list()` |
| `GET /agent/bot/funds/:id/overview` | `ora.funds.overview()` |
| `GET /agent/bot/funds/:id/orders?status=` | `ora.orders.list({ status })` |
| `GET /agent/bot/funds/:id/positions` | `ora.positions.list()` |
| `GET /agent/bot/orders/:id` | `ora.orders.get(orderId)` |
| `POST /agent/bot/orders` (hand-built OrderIntent) | `ora.orders.marketBuy(...)` / `limitBuy(...)` / `submit(intent)` |
| `POST /agent/bot/orders/:id/cancel` | `ora.orders.cancel(orderId)` |
| `POST /agent/bot/orders/cancel-bulk` | `ora.orders.cancelMany(orderIds)` |
| `POST /agent/bot/thought` | `ora.thoughts.push({ title, summary, body })` |
| poll `GET /orders/:id` until terminal | `ora.orders.waitForFill(orderId)` |

You no longer pass the fund id, set the `Authorization` header, unwrap `{ success, data }`, or hand-assemble the reversed market-order fields (`amountUsdc` for buys, `size` for sells) — the client does all of it.

## Errors

Every failure is a typed subclass of `OraError` with a `.code`:

| Class | When |
|-------|------|
| `OraValidationError` | Bad order intent (caught client-side or server-side) |
| `OraVenueUnsupportedError` | Illegal order-type / time-in-force combination |
| `OraRiskRejected` | Blocked by risk controls (`.reason`, `.detail`) |
| `OraInsufficientBalance` | Spend exceeds available (`.available`, `.required`) |
| `OraOrderRejected` | Rejected at the venue (`.rawReason`) |
| `OraDuplicateOrderError` | A duplicate `clientOrderId` |
| `OraOrderStateError` | Cancel of a non-cancellable order |
| `OraAuthError` / `OraNotFoundError` / `OraRateLimitError` | 401/403, 404, 429 |
| `OraTimeoutError` / `OraNetworkError` | Client-side wait timeout / transport failure |

```typescript
import { OraRiskRejected } from '@ora-io/agent-sdk'
try { await ora.orders.marketBuy(/* … */) }
catch (e) { if (e instanceof OraRiskRejected) console.error(e.reason) }
```
