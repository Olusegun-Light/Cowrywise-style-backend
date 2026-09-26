# Cowrywise-style Backend

[![CI](https://github.com/Olusegun-Light/Cowrywise-style-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Olusegun-Light/Cowrywise-style-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-20%2B-339933)](https://nodejs.org)

A fintech backend that clones the core product surface of [Cowrywise](https://cowrywise.com) — accounts, wallets, savings, investments, group savings — built end-to-end on the same stack Cowrywise's own engineering team runs in production.

## Table of contents

- [Why this exists](#why-this-exists)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [What it does](#what-it-does)
- [Key flows](#key-flows)
- [Architecture at a glance](#architecture-at-a-glance)
- [Design principles](#design-principles)
- [Notable engineering decisions](#notable-engineering-decisions)
- [API docs](#api-docs)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)
- [What's next](#whats-next)
- [License](#license)

## Why this exists

Cowrywise publishes their engineering stack on [StackShare](https://stackshare.io/cowrywise-dev-team/cowrywise). This project started as a from-scratch clone of their core product surface — accounts, wallets, savings, KYC — and once that core was solid, I went back and compared what I'd built against that public stack listing. Four gaps stood out: a message broker, a metrics/observability layer, a reverse proxy, and a search engine. Each became its own build: RabbitMQ for event-driven side effects, Prometheus + Grafana for metrics, NGINX as the only path into the app, and Elasticsearch for admin search.

The goal wasn't "use the same technology" as a checkbox — it was building each piece for a real reason it would actually be needed inside this app, then finding out what breaks when you do. A lot did. Some of the more interesting failures are documented in [Notable engineering decisions](#notable-engineering-decisions) below.

This is a learning/portfolio project, not a production system. Real money never moves — Paystack runs in test mode throughout.

## Tech stack

| Layer | Tool |
|---|---|
| Language / runtime | TypeScript, Node.js |
| Web framework | Express |
| Database | PostgreSQL, via Prisma ORM |
| Cache / sessions / rate limiting | Redis |
| Background jobs | BullMQ (backed by Redis) |
| Event messaging | RabbitMQ |
| Search | Elasticsearch |
| Metrics | Prometheus + Grafana |
| Logging | Pino (structured JSON), Loki + Promtail for aggregation |
| Reverse proxy | NGINX |
| Payments | Paystack (test mode) |
| Auth | JWT (access + refresh), argon2 password hashing |
| Validation | Zod |
| API docs | OpenAPI 3, served live via Swagger UI |
| Testing | Jest + Supertest, against a real Postgres/Redis |
| Error tracking | Sentry (optional, no-ops without a DSN) |

## Prerequisites

- **Node.js 20+** and npm
- **PostgreSQL** and **Redis**, running locally (native install recommended — see [Getting started](#getting-started))
- **RabbitMQ**, running locally
- **Docker + Docker Compose**, only needed for the optional observability/search stack (NGINX, Elasticsearch, Prometheus, Grafana, Loki)
- A **[Paystack](https://paystack.com)** account, for a test secret key (no real card details needed — Paystack's test mode uses fixed test card numbers)
- A **[Mailtrap](https://mailtrap.io)** account, for a sandboxed SMTP inbox (emails never reach a real address, even by typo)

## Getting started

```bash
git clone git@github.com:Olusegun-Light/Cowrywise-style-backend.git
cd Cowrywise-style-backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, PAYSTACK_SECRET_KEY, MAILTRAP_*
```

**Day-to-day development** (Postgres, Redis, and RabbitMQ run natively via Homebrew):

```bash
make start        # starts Postgres, Redis, RabbitMQ, then the dev server
npx prisma migrate dev   # first run only — creates the schema
npx ts-node prisma/seed.ts   # first run only — seeds sample investment funds
```

The API is now at `http://localhost:3000`, docs at `http://localhost:3000/api/v1/docs`.

**Full stack with search + observability** (NGINX, Elasticsearch, Prometheus, Grafana, Loki, and the app itself, all in Docker):

```bash
make obs-up
```

The app is now reachable only through NGINX, at `http://localhost:4000` (this mirrors real production topology — the app has no direct host port). Grafana is at `http://localhost:3032`.

Other useful commands: `make stop` (stops the native services), `make db-shell` (opens `psql` on the dev database), `make search-backfill` (bulk-reindexes Elasticsearch from Postgres), `npm test` (runs the suite against a separate `cowrywise_test` database).

## What it does

**Core banking**
- **Auth & accounts** — signup with OTP email verification, JWT access/refresh tokens, password reset, role-based access (user/admin).
- **KYC** — BVN/NIN submission, admin review (approve/reject with a reason), resubmission after rejection.
- **Wallet** — a single NGN wallet per user, funded and withdrawn via Paystack, with every movement recorded as a signed ledger entry (`+` credit, `-` debit) so the balance is always reconstructable from history, not just trusted as a cached number.
- **Savings** — Flex (withdraw anytime), Fixed (locked until maturity, early withdrawal forfeits some interest), and Recurring (auto-debited from the wallet on a schedule) plans, each accruing interest via a daily background job.
- **Investments** — buy/redeem units of admin-seeded mutual funds at a NAV that moves over time, so the same wallet ledger captures gains and losses from a completely different asset type.
- **Circles** — rotating group savings (Ajo/Esusu-style): members contribute on a schedule, one member is paid the full pot each round, position in the queue determines payout order.

**Money-adjacent**
- **Referrals** — both referrer and referred earn a reward, triggered the first time the referred user successfully funds their wallet.
- **Statements & receipts** — PDF exports of wallet history and single-transaction receipts.
- **Notifications** — email + in-app feed, triggered by real events (KYC decisions, circle payouts) via a message queue, not called synchronously inline.

**Ops & infrastructure**
- **Admin/backoffice** — KYC review queue, freeze/unfreeze accounts, broadcast notifications, an audit log of every admin action, and free-text search over users and transactions.
- **Observability** — structured logs, request tracing, Prometheus metrics, and a Grafana stack, all running in Docker alongside the app.
- **Event messaging** — RabbitMQ decouples side effects (a KYC approval publishes an event; notifications and search indexing consume it independently) instead of every write path doing everything inline.

## Key flows

**1. Onboarding**
Signup → OTP emailed → verify → account active; unverified users can't log in. KYC (BVN/NIN) can be submitted any time after; an admin approves or rejects with a reason, and a rejected user can resubmit.

**2. Funding and spending**
A funding request hits Paystack; confirmation arrives either via webhook or by the client polling a verify endpoint — whichever happens first wins, and the other is a safe no-op. The wallet only credits on confirmed success; a withdrawal debits immediately, inside the same row lock as the balance check, so two concurrent withdrawal requests can't both see a "sufficient" balance and over-pay.

**3. Group savings (Circles)**
A user creates a circle with a contribution amount and member cap; others join up to that cap. Each round, members contribute; once everyone has, the next member in position order is paid the full pot from the wallet ledger, and the round advances.

**4. Admin review**
An admin approves/rejects pending KYC or freezes a compromised account. Each action writes an audit log row in the same transaction as the change itself (never after, never best-effort) and publishes an event — the affected user's notification and their entry in the search index both update independently, off the request path.

**5. Investing**
Admin-seeded funds carry a NAV per unit that moves over time (via an admin NAV-update endpoint, simulating real market movement). Buying debits the wallet and credits fund units at the current NAV; redeeming does the reverse. Same wallet ledger, same reconciliation guarantee, completely different asset shape (fractional units, not whole kobo).

**6. Referrals**
A new user can sign up with someone else's referral code. The reward — for both sides — doesn't fire at signup; it fires the first time the referred user's wallet is *successfully funded*, whether that confirmation arrives via Paystack's webhook or the client's own verify-poll, whichever lands first.

**7. Notifications & search, off the request path**
Nothing in the request path calls the notification service or the search indexer directly. A KYC decision or circle payout publishes an event to RabbitMQ; a notification consumer and (for KYC/freeze/unfreeze events) a search-indexing consumer each pick it up independently. If Elasticsearch is down, search indexing dead-letters and retries — the KYC decision itself already succeeded and returned to the admin.

## Architecture at a glance

```
Client → NGINX (only path in) → Express app → Postgres (Prisma)
                                             → Redis (sessions, OTP, rate limits)
                                             → RabbitMQ (events: KYC, circle payouts, search sync)
                                             → Elasticsearch (admin search)
                                             → Prometheus/Grafana (metrics)
```

**Native vs. Docker.** Postgres, Redis, and RabbitMQ run natively (Homebrew) for day-to-day development — they're core to every request, so they need to be up whenever the app is. NGINX, Elasticsearch, and the observability stack (Loki/Promtail/Prometheus/Grafana) are opt-in via Docker Compose — they're infrastructure layered on top, not things a single developer needs running just to hit an endpoint locally.

**Bounded, non-blocking external calls.** Every optional dependency (RabbitMQ, Elasticsearch) connects with a timeout, and every publish/search call has one too. If RabbitMQ or Elasticsearch is down, the app still boots and still serves requests — the only thing that degrades is the specific feature that depended on it (a notification doesn't fire, a search returns a clean error). This was learned the hard way: an earlier version of the rate limiter blocked the entire app from booting because it tried to talk to Redis before Redis had finished connecting — see [Notable engineering decisions](#notable-engineering-decisions).

**Event-driven side effects.** A single RabbitMQ topic exchange carries domain events (`kyc.approved`, `circle.payout`, `search.user.upsert`); each consumer (Notifications, Search) reads independently with manual ack and its own dead-letter queue, so a bug in one consumer can't lose events for the other, and a poison message doesn't loop forever. RabbitMQ over Kafka here specifically — a single-service system with two consumers doesn't exercise Kafka's actual strengths (high-throughput, replayable streams for many independent consumers).

**Money never floats.** Every amount is Prisma `BigInt` kobo, never a JS `number` — `Int`'s ~₦21.4M ceiling was judged too risky for a wallet balance, and floating point has no place representing money at all. `Transaction.amount` is *signed* (credit positive, debit negative), which makes `SUM(amount)` over successful transactions equal the wallet's cached balance by construction — a reconciliation check that falls out of the schema for free, and one that's already caught a real drift bug once.

**Testing is integration-first.** Tests hit a real Postgres/Redis, driven through the actual HTTP layer via Supertest — not mocked-everything unit tests. The only things globally mocked are genuinely external services (Paystack, the email provider, RabbitMQ's publish calls) so a test run never makes a real network call. Coverage is deliberately scoped to the money-invariant-critical paths (auth, wallet, one full multi-step flow) rather than every endpoint — an explicit, stated tradeoff, not an oversight.

## Design principles

Rules the money-handling code was built around from day one, not a later cleanup pass:

1. **Money is an integer, never a float.** Amounts are stored in kobo (the smallest NGN unit) as `BigInt`. Floating-point arithmetic on money causes silent rounding errors that compound over thousands of transactions.
2. **Every balance change is a ledger row, not just a balance update.** `Wallet.balance` is a cached, derivable value — `Transaction` is the source of truth. If they ever disagree, the ledger wins.
3. **Webhooks and any "credit money" endpoint are idempotent.** The payment provider's reference ID carries a unique database constraint, rejecting duplicates at the DB level — not just in application logic, where a race between concurrent requests could slip past an app-level check.
4. **Concurrent debits use row-level locking.** Two simultaneous withdrawal requests against the same wallet can't both succeed if only one can be covered — enforced with `SELECT ... FOR UPDATE` inside a transaction, not just an app-level balance check.
5. **State transitions live in the schema, not just in code.** `SavingsPlan.status` is a Postgres enum; a plan can't go from `WITHDRAWN` back to `ACTIVE` because a request replayed.
6. **Interest accrual is idempotent per period.** A cron job that crashes and reruns can't double-credit interest for the same day — enforced with a unique `(planId, accrualDate)` constraint.
7. **Authentication identity is separated from financial identity.** `User` and `Wallet` are the same row for now, related 1:1 by foreign key, specifically so it's easy to split later (e.g. multiple wallets per user) without a redesign.
8. **Anything that touches money or OTPs is rate-limited.** Login, OTP requests, and withdrawals are the first things an attacker probes.

## Notable engineering decisions

A sample of real bugs found and fixed along the way — not a changelog, just the ones that were actually interesting:

- **A missing balance check would have let anyone overdraw their wallet.** An early version of `withdraw` went straight from "wallet exists" to decrementing the balance, with no check that it held enough. `npm run build` passed fine — TypeScript has no way to know a business rule is missing entirely, only that the types line up. Caught in review, not by the compiler.
- **A duplicate line doubled every circle payout.** The same wallet-credit statement appeared twice, back to back, surviving a first pass of fixes. It would have silently paid out double while the audit log still showed the correct single amount — a permanent, undetectable drift between the cached balance and the transaction history. Only caught by re-reading the file a second time after it looked "done."
- **`z.coerce.boolean()` is not what it looks like.** It's `Boolean(value)` under the hood — so the literal string `"false"` coerces to `true`. Hit once on a query-string filter (`?isActive=false` returning *everyone*), then deliberately avoided on a later, security-relevant boolean (whether to trust a reverse proxy's headers).
- **The rate limiter once broke every request in the app, including unauthenticated ones.** A Redis-backed limiter tried to connect at *import time* — before the async startup sequence had actually connected Redis. Not a type error; only showed up by starting the server and hitting it. Switched to an in-memory limiter (correct given this ships as a single process) rather than restructuring the whole import order to fix a problem that didn't need to exist.
- **A dead-letter exchange fanned out to the wrong queue.** Two RabbitMQ consumers shared one dead-letter exchange; because it was `fanout` instead of `direct`, a message that failed processing in *either* consumer got duplicated into *both* consumers' dead-letter queues. Confirmed live against the running broker (published one message, watched both queues increment) before fixing it — a bug that had been silently latent since the day the second consumer was added.
- **A stale DNS cache made NGINX proxy to a dead container.** `proxy_pass` with a literal hostname resolves once, at NGINX startup, and never again — so rebuilding the app container during normal iteration left NGINX silently talking to an IP that no longer existed. Fixed by routing through an NGINX variable with an explicit resolver, forcing re-resolution on every request.

## API docs

Full OpenAPI docs are served live from the running app at `/api/v1/docs` (Swagger UI) — every endpoint, request/response shape, and auth requirement, generated from the same Zod schemas that validate requests.

## Testing

```bash
npm test
```

Runs the full suite (Jest + Supertest) against a dedicated `cowrywise_test` Postgres database and Redis keyspace — real integration tests, not mocked-out unit tests. Coverage focuses on Auth and Wallet (the money-invariant-critical core) plus Circles as one full multi-step flow, rather than every endpoint; see [Architecture at a glance](#architecture-at-a-glance).

## Project structure

```
src/
  Features/<Name>/
    controller.ts   # HTTP layer — request/response shape
    service.ts       # business logic
    router.ts         # route definitions
    validation.ts     # Zod schemas + OpenAPI registration
  Config/             # env, database, Redis, RabbitMQ, Elasticsearch setup
  Jobs/               # BullMQ background jobs (interest accrual, recurring debits, search sync)
  Middlewares/         # auth, rate limiting, error handling, metrics
  Utils/               # shared helpers (JWT, logger, response envelope, etc.)
```

Organized by feature, not by technical layer — everything about `Wallet` lives in one folder, rather than its controller, service, and routes being split across three parallel directory trees. Changing one feature rarely means touching files scattered across the codebase.

## Known limitations

Honest gaps, left as-is deliberately rather than by oversight:

- **Real KYC verification isn't wired up.** BVN/NIN are stored and reviewed manually by an admin; no real verification provider is integrated — that needs a business account with a provider like VerifyMe or Smile ID, which is out of scope for a learning project.
- **Push notifications and SMS OTP are deferred.** Both need real external accounts (a Firebase project, an SMS provider) that only an end user of this project could create.
- **The rate limiter is in-memory**, not shared across instances — correct for how this ships (a single process), but would need a distributed store to run multiple instances behind a load balancer.
- **If Elasticsearch is down when a user's data changes, that update doesn't automatically retry once it comes back** — it dead-letters, and `make search-backfill` is the recovery path. Acceptable for a single-admin learning project; a production system would want automatic replay.
- **RabbitMQ metrics read zero under the Docker observability stack** — the Dockerized app can't reach the natively-running RabbitMQ instance without widening RabbitMQ's network exposure beyond localhost, which wasn't judged worth it for two metric series.

## What's next

Deliberately deferred, not forgotten — the next things worth building if this continues:

- **TLS/HTTPS termination on NGINX** — skipped for now since this runs on localhost with no external audience; would be the first thing added before deploying anywhere reachable by anyone but the developer.
- **Alerting** (Alertmanager) and **purpose-built Grafana dashboards** — Prometheus/Grafana currently prove the data flows correctly; turning that into actual on-call-style alerting and curated dashboards is the natural next step.
- **Search highlighting, faceted filters, and autocomplete** on top of the existing Elasticsearch indices.
- **Automatic DLQ replay** for the search-indexing consumer, instead of the manual `make search-backfill` recovery path.
- **Multi-currency wallets** — the current `User`↔`Wallet` 1:1 assumption would need revisiting if this ever supported more than NGN.
- **Kafka**, if a real second, differently-shaped consumer of the same domain events ever shows up (a durable audit/event-log stream, for example).
- **Load balancing / multiple app instances** — would also require moving the in-memory rate limiter to a shared store (see [Known limitations](#known-limitations)).

## License

[MIT](./LICENSE)
