# Mini SMS Gateway

A bulk SMS REST API: it accepts send requests, charges credits, pushes each
message through mock providers and falls over to the next route when one
fails. Credits that cannot be delivered anywhere are refunded.

Built with **Node.js + TypeScript + Express 5 + Sequelize + MySQL (InnoDB)**.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Architecture](#architecture)
3. [File structure](#file-structure)
4. [Database schema](#database-schema)
5. [API reference](#api-reference)
6. [Shared rules: segments and phone numbers](#shared-rules-segments-and-phone-numbers)
7. [How credits stay correct](#how-credits-stay-correct)
8. [Failover and refunds](#failover-and-refunds)
9. [Route health formula](#route-health-formula)
10. [Testing](#testing)
11. [Decisions](#decisions)
12. [What I would improve](#what-i-would-improve)

---

## Quick start

### Requirements

- Node.js 20+
- MySQL 8 (InnoDB — the gateway relies on transactions and `SELECT ... FOR UPDATE`)

### 1. Install

```bash
git clone <repo-url>
cd mini-sms-gateway
npm install
```

### 2. Create the database

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS \`mini-sms-gateway\`;"
```

### 3. Configure

```bash
cp .env.example .env
```

Then edit `.env`:

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL address |
| `DB_USER` / `DB_PASSWORD` | `root` / — | MySQL credentials |
| `DB_DATABASE` | `mini-sms-gateway` | Database name |
| `DB_SOCKET_PATH` | _(unset)_ | Only if MySQL is reached over a unix socket |
| `JWT_SECRET` | — | Signing secret. **Change this.** |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `SIGNUP_CREDITS` | `100` | Credits given to a new account |
| `RATE_LIMIT_PER_MINUTE` | `60` | Requests per user per minute |
| `HEALTHY_PROVIDER_BALANCE` | `1000` | Balance that counts as "fully stocked" in the health score |

### 4. Seed the providers

```bash
npm run seed
```

Creates the tables (if missing) and inserts the three mock routes:

| Route | Priority | Balance | Failure rate |
| --- | --- | --- | --- |
| `ROUTE_A` | 1 | 1000 | 30% |
| `ROUTE_B` | 2 | 1000 | 10% |
| `ROUTE_C` | 3 | 500 | 5% |

Run `npm run seed:reset` at any time to put the routes back to these values
(useful between demo runs, once balances have been spent).

### 5. Run

```bash
npm run dev     # development, reloads on change
npm run build && npm start   # production
```

Check it is alive:

```bash
curl http://localhost:3000/api/health
```

### Other scripts

```bash
npm test         # unit tests
npm run typecheck
```

---

## Architecture

The request path is one direction only, each layer with a single job:

```
HTTP request
    |
    v
routes/          URL -> middleware chain -> controller
    |
    v
middlewares/     authenticate (JWT) -> rate limit -> validate (zod)
    |
    v
controllers/     read the parsed input, call a service, shape the response
    |
    v
services/        all the business rules and all the transactions
    |
    +--> providers/   failover policy + the mock routes
    |
    v
models/          Sequelize models (the only place that talks to MySQL)
    |
    v
MySQL (InnoDB)
```

Rules that keep it readable:

- **Controllers hold no logic.** They unwrap the request and hand over to a service.
- **Services own transactions.** If credits move, it happens inside a service.
- **Providers know nothing about wallets.** A route only reports success or failure; the service decides what that means for the user's credits.
- **Errors go to one place.** Anything thrown is an `ApiError` caught by `middlewares/error.middleware.ts`, so every failure response has the same shape.

### The send flow, step by step

```
POST /sms/send  { to: [...], message }
  |
  1. normalise + validate every number          utils/phone.ts
  |     any invalid number -> 400, nothing charged
  |
  2. count parts once (same text for everyone)  utils/segment.ts
  |     totalCost = parts x recipients
  |
  3. TRANSACTION
  |     SELECT ... FOR UPDATE on the wallet row
  |     credits < totalCost ? -> 402, rolled back
  |     deduct credits
  |     insert one `pending` message per recipient
  |     insert the `debit` ledger entry
  |   COMMIT
  |
  4. for each message (outside the transaction):
  |     try routes in priority order             providers/failover.ts
  |     first route that accepts -> status `sent`
  |     every route failed -> TRANSACTION: refund + status `failed`
  |
  5. respond with the per-message outcome
```

Step 3 is deliberately short: it only touches rows. The slow part — calling
providers — happens in step 4, outside the lock, so one user's send never
blocks another's wallet.

---

## File structure

```
src/
  server.ts                  entry point: connect DB, then listen
  app.ts                     express app: json parser, routes, error handlers

  config/
    env.ts                   typed, validated environment variables

  dbconnection/
    db.ts                    Sequelize instance + model registration

  models/                    database tables
    user.model.ts            accounts
    wallet.model.ts          one credit balance per user
    provider.model.ts        mock route config (priority, balance, failure rate)
    message.model.ts         one row per recipient
    sendAttempt.model.ts     one row per provider call (feeds route health)
    creditTransaction.model.ts  append-only credit ledger
    index.ts                 barrel export

  providers/                 the mock SMS routes
    mockProvider.ts          a fake route: failure simulation + balance spend
    providerRegistry.ts      loads active routes in priority order
    failover.ts              pure "try routes until one works" policy

  services/                  business logic, owns all transactions
    auth.service.ts          register, login, profile
    sms.service.ts           validate -> charge -> dispatch -> refund
    report.service.ts        message logs + route health

  controllers/               thin HTTP adapters
    auth.controller.ts
    sms.controller.ts
    route.controller.ts

  routes/                    URL wiring
    index.ts                 mounts /auth, /sms, /routes under /api
    auth.route.ts
    sms.route.ts
    routeHealth.route.ts

  middlewares/
    auth.middleware.ts       JWT verification
    validate.middleware.ts   zod validation for body and query
    rateLimit.middleware.ts  per-user rate limit
    error.middleware.ts      404 + single error handler

  validators/                zod request schemas
    auth.validator.ts
    sms.validator.ts

  utils/
    phone.ts                 Nepali number normalisation
    segment.ts               GSM-7 / Unicode part counting
    jwt.ts                   sign and verify tokens
    apiError.ts              typed HTTP errors
    asyncHandler.ts          forwards async errors to the error handler

  seed/
    seedProviders.ts         inserts / resets the mock routes

  types/
    express.d.ts             adds `req.user` to the Express request

tests/
  segment.test.ts            part counting
  phone.test.ts              number validation
  failover.test.ts           route selection and failover
```

---

## Database schema

```
users 1---1 wallets
  |
  +---* messages *---1 providers
          |
          +---* send_attempts *---1 providers
  |
  +---* credit_transactions
```

| Table | Purpose |
| --- | --- |
| `users` | account + bcrypt password hash |
| `wallets` | `credits` balance, one row per user. Every credit change locks this row. |
| `providers` | mock route config: `code`, `priority`, `balance`, `failureRate`, `isActive` |
| `messages` | one row per recipient: `recipient`, `body`, `encoding`, `parts`, `cost`, `status`, `providerId`, `failureReason`, `refunded`, `batchId` |
| `send_attempts` | one row per provider call: `success`, `error`. The raw data behind route health. |
| `credit_transactions` | append-only ledger: `signup` / `debit` / `refund`, with `balanceAfter` |

The ledger is not strictly required, but it is how you prove the wallet is
right: replaying every entry for a user must land on their current balance.

Tables are created automatically by `sequelize.sync({ alter: true })` when the
app or the seed starts, so there is no separate migration step.

---

## API reference

Base URL: `http://localhost:3000/api`

All routes except `/health`, `/auth/register` and `/auth/login` need:

```
Authorization: Bearer <token>
```

### `GET /health`

```json
{ "success": true, "message": "Mini SMS Gateway is running" }
```

### `POST /auth/register`

```json
{ "name": "Ashok", "email": "ashok@test.com", "password": "secret123" }
```

`201` with a token, the user and their starting credits.

### `POST /auth/login`

```json
{ "email": "ashok@test.com", "password": "secret123" }
```

### `GET /auth/me`

Current user and credit balance.

### `POST /sms/send`

```json
{
  "to": ["9841234567", "+9779801122334", "9779761234567"],
  "message": "Hello from Nest SMS"
}
```

Response:

```json
{
  "success": true,
  "batchId": "8f214121-3dcf-44f8-b230-4543499cb9d1",
  "encoding": "GSM-7",
  "partsPerMessage": 1,
  "recipients": 3,
  "costPerMessage": 1,
  "totalCharged": 3,
  "totalRefunded": 0,
  "creditsRemaining": 97,
  "summary": { "sent": 3, "failed": 0 },
  "results": [
    {
      "messageId": 3,
      "to": "9761234567",
      "status": "sent",
      "provider": "ROUTE_B",
      "refunded": false,
      "attempts": [
        { "route": "ROUTE_A", "attempted": true, "success": false,
          "error": "ROUTE_A rejected the message (simulated 30% failure)" },
        { "route": "ROUTE_B", "attempted": true, "success": true, "error": null }
      ]
    }
  ]
}
```

Errors:

| Status | When |
| --- | --- |
| `400` | one or more numbers invalid, or the body failed validation |
| `402` | not enough credits (nothing is charged) |
| `429` | rate limit exceeded |

A `400` for bad numbers lists every offender:

```json
{
  "success": false,
  "message": "2 of 2 number(s) are invalid",
  "details": {
    "invalid": [
      { "number": "9612345678", "reason": "Number must start with 97 or 98" },
      { "number": "984123456", "reason": "Number must be 10 digits after the optional +977 prefix, got 9" }
    ]
  }
}
```

### `GET /sms/logs`

Paginated message history for the logged-in user, newest first.

| Query | Default | Notes |
| --- | --- | --- |
| `status` | — | `pending` \| `sent` \| `failed` |
| `number` | — | any accepted format; normalised before matching |
| `from` | — | ISO date or `YYYY-MM-DD` |
| `to` | — | ISO date or `YYYY-MM-DD` (a plain date includes the whole day) |
| `page` | `1` | |
| `limit` | `20` | max `100` |

```bash
curl "localhost:3000/api/sms/logs?status=sent&number=%2B9779841234567&from=2026-10-01&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 },
  "data": [
    {
      "id": 5, "batchId": "...", "to": "9841234567", "body": "Hello",
      "encoding": "GSM-7", "parts": 1, "cost": 1, "status": "sent",
      "provider": "ROUTE_A", "failureReason": null, "refunded": false,
      "sentAt": "2026-10-26T09:26:05.000Z", "createdAt": "2026-10-26T09:26:05.000Z"
    }
  ]
}
```

### `GET /routes/health`

```json
{
  "success": true,
  "routes": [
    {
      "code": "ROUTE_A",
      "name": "Route A (primary, flaky)",
      "priority": 1,
      "isActive": true,
      "balance": 995,
      "configuredFailureRate": 0.3,
      "last24h": { "attempts": 5, "succeeded": 4, "failed": 1, "successRate": 80 },
      "balanceScore": 100,
      "health": 86
    }
  ]
}
```

---

## Shared rules: segments and phone numbers

### Part counting (`src/utils/segment.ts`)

| Encoding | When | 1 SMS | Longer messages |
| --- | --- | --- | --- |
| GSM-7 | every character is in the GSM 03.38 set | 160 chars | parts of 153 |
| Unicode | anything else (Nepali, emoji, …) | 70 chars | parts of 67 |

One non-GSM character anywhere forces the **whole** message to Unicode.

Two details beyond the headline rule:

- The GSM **extension table** characters — `^ { } \ [ ~ ] | €` — cost two
  septets each, which is how real gateways bill them. So 81 `€` is 2 parts.
- Unicode is billed in UTF-16 code units, so an emoji outside the basic plane
  counts as 2. `"Hello 😀"` is 8 units, not 7.

Worked examples (all covered by tests):

| Message | Encoding | Parts |
| --- | --- | --- |
| 200 English characters | GSM-7 | 2 (153 + 47) |
| 100 Nepali characters | Unicode | 2 (67 + 33) |
| `Hello 😀` | Unicode | 1 |

### Phone numbers (`src/utils/phone.ts`)

A valid number is **10 digits starting with 97 or 98**. An optional `+977` or
`977` prefix is stripped. Spaces, dashes and brackets are ignored.

| Input | Result |
| --- | --- |
| `9841234567` | `9841234567` |
| `+9779801122334` | `9801122334` |
| `9779761234567` | `9761234567` |
| `+977 984-123-4567` | `9841234567` |
| `9612345678` | invalid — does not start with 97 or 98 |
| `984123456` | invalid — only 9 digits |

The country code is stripped **only** when what remains is a full 10 digits, so
a local number that happens to begin with `977` (like `9771234567`) is not
damaged.

---

## How credits stay correct

This is the core of the task: never lose or double-spend a credit.

**1 credit = 1 SMS part.** Credits are integers, never floats, so no rounding
can drift.

### Deduction is one transaction

`chargeAndCreateMessages()` in `src/services/sms.service.ts`:

```ts
sequelize.transaction(async (tx) => {
  const wallet = await Wallet.findOne({
    where: { userId },
    lock: Transaction.LOCK.UPDATE,   // SELECT ... FOR UPDATE
    transaction: tx,
  });

  if (wallet.credits < totalCost) throw ApiError.paymentRequired(...);

  await wallet.update({ credits: wallet.credits - totalCost }, { transaction: tx });
  // ... create the pending messages and the debit ledger entry
});
```

`lock: Transaction.LOCK.UPDATE` issues `SELECT ... FOR UPDATE`, which takes an
exclusive row lock on that wallet. A second request for the same user **blocks
on that read** until the first one commits — so it can never read a stale
balance and spend the same credit twice.

The balance check, the deduction and the message rows all commit together. If
anything throws, the whole thing rolls back and the caller is charged nothing.

### Why the provider call is outside the transaction

Sending is network I/O and can take seconds. Holding a row lock across it would
serialise every user behind the slowest route. So the transaction ends the
moment the credits and the `pending` messages are durable, and the routes are
called afterwards.

### The parallel test

The brief's check — 20 parallel sends at a wallet that can afford 10 — passes
consistently:

```
credits before: 10
accepted (200): 10
rejected (402): 10
total charged: 10   total refunded: 0
credits after: 0
```

A variant with 20 parallel requests of 2 recipients each (cost 2) against the
same 10 credits settles at exactly 5 accepted and 15 rejected.

### Provider balances too

A route's balance is spent with a conditional update, not a read-then-write:

```sql
UPDATE providers SET balance = balance - :parts
WHERE id = :id AND balance >= :parts
```

If it affects zero rows, the route did not have the capacity and the send is
reported as a failure, which triggers failover. Two parallel sends can never
push a route below zero.

---

## Failover and refunds

`src/providers/failover.ts` holds the policy, and it is deliberately pure — it
takes a list of routes and returns what happened, with no database access. That
is what makes it directly unit-testable.

```
for each route, in priority order (1, 2, 3):
    balance < parts ?  -> skip it, do not call it, do not count it as a failure
    call it
    success          -> mark the message `sent`, record which route, stop
    failure          -> record the attempt, continue to the next route

every route failed   -> refund the message and mark it `failed`
```

A skipped route is reported in the response (`attempted: false`) but is **not**
written to `send_attempts`, so an empty route does not drag down the success
rate it is judged on. Its empty balance is already visible in the health score.

### Refunds are idempotent

`refundMessage()` runs in its own transaction and re-reads the message under a
row lock:

```ts
const message = await Message.findByPk(messageId, {
  lock: Transaction.LOCK.UPDATE,
  transaction: tx,
});

if (!message || message.refunded) return false;   // already refunded, stop
```

The `refunded` flag is read and written inside the same locked transaction as
the wallet credit, so a message can never be refunded twice even if the refund
path is somehow entered concurrently.

Every refund also writes a `refund` row to `credit_transactions`, so the
history shows the debit and the matching credit back:

```
id  type    amount  balanceAfter  reference
5   debit   1       93            Batch 081ad021-...
6   refund  1       94            All routes failed
```

---

## Route health formula

Implemented in `getRouteHealth()` in `src/services/report.service.ts`.

```
successRate  = successful attempts / all attempts in the last 24 h
               (a route with no traffic is treated as 1.0 — it has not failed)

balanceScore = min(balance / HEALTHY_PROVIDER_BALANCE, 1)

health %     = round((0.7 * successRate + 0.3 * balanceScore) * 100)

if the route is inactive or its balance is 0  ->  health = 0
```

**Why these weights.** A route is useful when it delivers and when it still has
capacity, but the two are not equally important. A route that is accepting
messages is doing its job right now, so reliability gets **0.7**. Stock is a
*leading* indicator — a route at 10% balance is fine this minute but will stop
soon — so it gets **0.3**: enough to make a draining route visibly amber well
before it fails, not enough to mark a perfectly reliable route unhealthy just
because it is half full.

**Why the hard zero.** A route that is switched off or out of balance cannot
send anything, no matter how good its 24-hour record was. Averaging would leave
such a route showing ~70% health while delivering nothing, which is worse than
useless on a dashboard.

**Why 24 hours.** It is long enough to smooth out a short burst of bad luck
from a 30%-failure route, and short enough that yesterday's outage stops
counting once the route recovers.

**Why no-traffic counts as 1.0.** A brand new route has not failed. Starting it
at 0% would make it look broken and would be self-fulfilling if health were ever
used for routing.

Worked example — `ROUTE_A` with 4 of 5 attempts succeeded and a full balance:

```
successRate  = 4/5 = 0.8
balanceScore = min(995/1000, 1) = 1.0
health       = round((0.7 x 0.8 + 0.3 x 1.0) x 100) = round(86) = 86
```

---

## Testing

```bash
npm test
```

26 unit tests over the three things most likely to be quietly wrong:

- **`tests/segment.test.ts`** — GSM-7 vs Unicode selection, the 160/153 and
  70/67 boundaries, extension-table characters costing 2 septets, and an emoji
  forcing the whole message to Unicode.
- **`tests/phone.test.ts`** — the brief's examples, formatting noise, and the
  edge case where a valid local number begins with `977`.
- **`tests/failover.test.ts`** — delivery on the first route, falling over to
  the second and third, priority order, every route down, a low-balance route
  being skipped without being called, and an empty route list.

The failover tests use plain fake route objects, so they need no database and
no mocking framework.

### Manual check of the parallel case

```bash
npm run seed:reset
npm run dev
# register a user, set their wallet to 10 credits, then fire 20 parallel sends
```

---

## Decisions

**MySQL with InnoDB.** The task requires real transactions and row-level
locking. `SELECT ... FOR UPDATE` on the wallet row is the whole concurrency
story, and InnoDB gives it directly.

**A separate `wallets` table instead of a `credits` column on `users`.** The
wallet row is locked on every send. Keeping it separate means a send does not
lock the user record that authentication reads.

**An append-only `credit_transactions` ledger.** The wallet balance is a cached
running total; the ledger is the audit trail. It makes "no credit was lost"
something you can verify rather than assert.

**One `messages` row per recipient, grouped by `batchId`.** Each recipient
succeeds or fails independently and gets refunded independently, so each needs
its own status. `batchId` keeps the original request recoverable.

**The whole request is rejected if any number is invalid.** Partially accepting
a batch means the caller has to diff what they sent against what was charged.
Rejecting with a per-number reason list is easier to act on, and nothing is
charged.

**The failover policy is a pure function.** `runFailover()` takes routes and
returns an outcome; persistence happens in the service around it. This is what
makes the failover logic testable without a database, and it keeps the
"which route?" decision in one readable place.

**Provider calls happen outside the wallet transaction.** Credits and the
`pending` rows are committed first, then the routes are called. Holding a lock
across slow I/O would serialise unrelated users.

**Skipped routes are not recorded as attempts.** A route with no balance was
never called, so counting it as a failure would misreport its reliability.

**`sequelize.sync({ alter: true })` instead of migration files.** The brief
asks for "migrations or schema"; for a project this size, letting Sequelize
create the tables keeps setup to one command. A real deployment would use
versioned migrations — see below.

**Two tsconfig changes.** `useDefineForClassFields` is forced to `false`
(otherwise ES class fields shadow Sequelize's prototype getters and every model
property reads `undefined`), and `experimentalDecorators` is on, which
`sequelize-typescript` requires. Every `@Column` declares its type explicitly
rather than relying on `emitDecoratorMetadata`, because the dev runner (`tsx`)
uses esbuild, which does not emit that metadata.

---

## What I would improve

**Queue the sending (bonus B1).** Right now `POST /sms/send` waits for every
provider call before responding, so a 100-recipient batch holds the connection
open. The right shape is: commit the debit and the `pending` rows, return
`202 Accepted` with the `batchId` immediately, and let a BullMQ worker do the
dispatch and the refunds. Everything needed for that is already in place — the
messages are persisted as `pending` before any route is called.

**Sweep stranded `pending` messages.** If the process dies between the debit
and the dispatch, the credits are spent and the message sits at `pending`
forever. A periodic job should pick up messages that have been `pending` for
more than a few minutes and either retry them or refund them. The `refunded`
flag already makes that safe to run repeatedly.

**Versioned migrations.** `sync({ alter: true })` is convenient but it infers
schema changes. Umzug migrations would make every schema change reviewable and
reversible.

**Delivery reports (bonus B3).** A `POST /webhooks/delivery` endpoint so a
provider can move a message from `sent` to `delivered` or `undelivered`, with
signature verification and a `delivered` status in the model.

**Docker Compose (bonus B5).** The setup is currently "install MySQL yourself".
One `docker compose up` for API + MySQL + Redis would remove that step.

**Parallel dispatch within a batch.** Recipients are dispatched sequentially
for predictable logs. With a queue in place, they would fan out instead.

**Integration tests.** The unit tests cover the pure logic. The transactional
behaviour — the 20-vs-10 parallel case, refunds — is currently verified by
hand; it should run against a test database in CI.

**Operational hardening.** Structured logging with request ids, `helmet` and
CORS, refresh tokens, and an admin endpoint to top up credits (today a new
account just gets `SIGNUP_CREDITS`).
