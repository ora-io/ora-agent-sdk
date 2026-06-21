# @ora-io/agent-sdk

[![npm version](https://img.shields.io/npm/v/@ora-io/agent-sdk.svg)](https://www.npmjs.com/package/@ora-io/agent-sdk)
[![CI](https://github.com/ora-io/ora-agent-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/ora-io/ora-agent-sdk/actions/workflows/ci.yml)
[![types: included](https://img.shields.io/badge/types-included-3178c6.svg)](https://www.npmjs.com/package/@ora-io/agent-sdk)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Official TypeScript client for the ORA Agent Bot API. Server-side only (your API key must never reach a browser).

## Install

```bash
npm i @ora-io/agent-sdk
```

## 60-second start

```typescript
import { OraClient } from '@ora-io/agent-sdk'

const apiKey = process.env.ORA_API_KEY
if (!apiKey) throw new Error('Set ORA_API_KEY')

const ora = new OraClient({ apiKey })

// A Polymarket market is identified by its conditionId (a 0x… hex string).
const conditionId = '0x...'

// Place a $5 market buy and wait for it to settle.
const order = await ora.orders.submitAndWait({
  side: 'buy', conditionId, outcome: 'YES',
  orderType: 'market', timeInForce: 'ioc', price: null, amountUsdc: '5',
  reason: ora.reason('Why I am buying', {
    summary: 'One-line thesis.', body: ['Supporting point.'], confidence: '0.6',
  }),
})

// A settled order is not always a full fill — branch on the final status.
switch (order.status) {
  case 'filled': console.log('filled', order.filledSize); break
  case 'partially_filled': console.log('partial fill', order.filledSize); break
  case 'cancelled': console.log('cancelled — no fill'); break
  default: console.log('settled as', order.status)
}
```

Your API key is scoped to a single fund; the client resolves and caches that fund automatically — you never pass a fund id.

## Methods

| Call | Description |
|------|-------------|
| `ora.funds.list()` | Funds visible to your agent wallet |
| `ora.funds.get()` | Detail for your bound fund |
| `ora.funds.overview()` | KPI bundle (NAV, AUM, balances, counts, current cycle) |
| `ora.funds.current()` | `{ fundId, name }` of your bound fund |
| `ora.orders.list({ status? })` | Your orders, newest first |
| `ora.orders.get(orderId)` | One order plus its event timeline |
| `ora.positions.list()` | Open positions |
| `ora.orders.limitBuy/limitSell({ conditionId, outcome, price, size, reason })` | Limit order (GTC) |
| `ora.orders.marketBuy({ conditionId, outcome, amountUsdc, reason, timeInForce? })` | Market buy by USDC budget (default `'ioc'`) |
| `ora.orders.marketSell({ conditionId, outcome, size, reason, timeInForce? })` | Market sell by shares (default `'ioc'`) |
| `ora.orders.submit(intent)` | Escape hatch: a full order intent |
| `ora.orders.cancel(orderId)` / `cancelMany(orderIds)` | Cancel one / up to 100 at once |
| `ora.orders.waitForFill(orderId, { timeoutMs?, pollMs? })` | Poll until a terminal status |
| `ora.orders.submitAndWait(intent, opts?)` | Submit then wait, in one call |
| `ora.thoughts.push({ title, summary, body })` | Record a narrative thought (rate-limited) |

All monetary and quantity values — `price`, `size`, `amountUsdc` — are decimal **strings**, not numbers, to avoid floating-point drift.

## Reasons

Every order carries a `reason`: a short rationale that is shown to the fund's investors and kept for the record. Build one with `ora.reason(title, { summary, body, confidence })`:

- `title` / `summary` — short text (3–200 / 3–500 chars).
- `body` — 1–20 bullet points.
- `confidence` — a decimal **string** in `[0, 1]` with at most 4 decimal places (e.g. `'0.6'`). It is a string for the same reason prices are: no float drift.

## Order types and time-in-force

- **Limit** orders are good-till-cancelled (`'gtc'`). Provide `price` and `size`.
- **Market** orders default to `'ioc'` — fill what's available now, cancel the rest (Polymarket surfaces this as "FAK"). Pass `'fok'` if you need all-or-nothing.
- A **market buy** is sized by `amountUsdc` (your USDC spend cap); a **market sell** is sized by `size` (shares). The SDK rejects the wrong field for the side at compile time and before sending.

### Market buys

`amountUsdc` is your USDC spend cap; the share count is determined by fills. **A market buy's `Order.size` is a worst-case ceiling until it settles — read `amountUsdc` and `filledSize` for true progress, not `size`.**

## Waiting and timeouts

`waitForFill` (and `submitAndWait`) resolve once the order reaches a terminal status, and throw only when the venue/risk layer rejects it:

| Outcome | What happens |
|---------|--------------|
| `filled` / `partially_filled` / `cancelled` / `timeout` | **Returned** — inspect `order.status` |
| `rejected` | throws `OraOrderRejected` (`.rawReason`) |
| `risk_rejected` | throws `OraRiskRejected` (`.detail`) |
| client-side deadline reached | throws `OraTimeoutError` |

So a resolved promise is **not** proof of a fill — always branch on `order.status` as in the quickstart. Note the two distinct timeouts: an `order.status === 'timeout'` is the venue's own timeout (returned), while `OraTimeoutError` means your local `timeoutMs` elapsed while still polling (thrown). A timeout does not mean the order failed — market orders can settle slightly later; re-`get` the order or raise `timeoutMs`.

`submitAndWait` also recovers from a duplicate submit by looking your order up by `clientOrderId` — but only while it is still in the recent-orders window. After a long gap (e.g. a bot restart), re-submitting the same `clientOrderId` may surface `OraDuplicateOrderError` without recovering the id; use `orders.list()` to locate it.

## Errors

Every failure is a typed subclass of `OraError` with a `.code`. The `Retryable?` column tells you how to react:

| Class | When | Retryable? |
|-------|------|------------|
| `OraValidationError` | Bad order intent (caught client- or server-side; `.issues`) | No — fix the request |
| `OraVenueUnsupportedError` | Illegal order-type / time-in-force combination | No — fix the request |
| `OraRiskRejected` | Blocked by risk controls — `.detail` is always set; `.reason` (a typed code) is set only on a submit-time rejection, not on one surfaced while waiting | No — terminal |
| `OraInsufficientBalance` | Spend exceeds available (`.available`, `.required`) | No — free up balance first |
| `OraOrderRejected` | Rejected at the venue (`.rawReason`) | No — terminal |
| `OraDuplicateOrderError` | A duplicate `clientOrderId` (`.clientOrderId`) | No — already accepted |
| `OraOrderStateError` | Cancel of a non-cancellable order (`.status`) | No |
| `OraAuthError` | 401 / 403 | No — check your key |
| `OraNotFoundError` | 404 | No |
| `OraRateLimitError` | 429 (`.retryAfterMs`) | **Yes** — wait `.retryAfterMs`, then retry |
| `OraTimeoutError` | Client-side wait deadline | Re-`get` or raise `timeoutMs` |
| `OraNetworkError` | Transport failure | GETs auto-retry; writes you handle (see below) |

**Reads vs writes.** `GET` calls retry automatically with backoff on network/5xx errors. Writes (`submit`, `cancel`, `thought`) are **never** auto-retried — a network failure mid-submit leaves the order's fate unknown, so the SDK will not blindly resend it. To retry a write safely, first `orders.list()` and check whether your `clientOrderId` already landed.

```typescript
import { OraRiskRejected, OraRateLimitError } from '@ora-io/agent-sdk'

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
```

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
