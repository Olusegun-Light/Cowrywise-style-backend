# RabbitMQ Event Messaging for Notifications — Design

**Status:** Approved, not yet implemented
**Date:** 2026-09-23

## 1. Why

The user's goal is to work through the same technologies Cowrywise's own
engineering team uses (per their public StackShare listing at
`stackshare.io/cowrywise-dev-team/cowrywise`), to build familiarity with each
one, not just to add features for their own sake.

Comparing that stack against this project surfaced four backend-relevant gaps
with no overlap in either reference project (`living-backend`,
`new-ductour-backend`): a reverse proxy (NGINX), full-text search
(Elasticsearch), a message broker (RabbitMQ/Kafka), and APM/metrics (New
Relic-equivalent). Each is an independent subsystem large enough to warrant
its own design pass. This spec covers the first one, chosen by the user: a
real message broker, using RabbitMQ specifically (Cowrywise's stack lists
both RabbitMQ and Kafka; RabbitMQ was chosen as the natural first step for a
single-service monolith — Kafka's value proposition, high-throughput
replayable streams for multiple independent consumers, doesn't apply yet
with only one consumer in the picture. Kafka remains a candidate for a later
pass if/when that changes).

This project currently has BullMQ (Redis-backed) for background jobs
(interest accrual, recurring debits), but nothing resembling pub/sub event
messaging between features. Notifications is the concrete use case: Circles
(circle payout), and Admin (KYC approve/reject) currently call
`notificationsService.createNotification` directly, each wrapped in its own
try/catch so a notification failure never breaks the parent action (see
PLAN.md decisions log, 2026-08-22). This spec replaces those three direct
calls with publish-and-forget events, consumed by a new Notifications
consumer — same safety guarantee, genuinely decoupled, and a real,
end-to-end demonstration of the pub/sub pattern grafted onto code that
already exists rather than a toy example.

## 2. Scope

**In scope:**
- RabbitMQ running natively via Homebrew, alongside Postgres/Redis, for
  day-to-day `make dev` (matches how the project's other core dependencies
  already run — this is core app behavior, not opt-in observability tooling
  like the Loki/Grafana stack).
- One topic exchange, one queue, one dead-letter queue.
- A generic publisher utility any feature can use.
- A single consumer process (in-process, same pattern as BullMQ jobs — no
  separate worker process) that turns three specific events into
  notifications.
- Migrating the three existing direct `createNotification` call sites to
  publish events instead.
- Global test mocking of the publisher, matching the existing
  `Utils/mailer.ts` / `Utils/paystack.ts` pattern.

**Out of scope (explicitly deferred):**
- Kafka.
- NGINX, Elasticsearch, APM/metrics — separate gaps, separate design passes.
- Any new event types beyond the three that already have a direct-call
  equivalent today. Adding more events later is a small, additive change
  once this pattern is proven, not part of this pass.
- A management UI (RabbitMQ ships its own at `:15672`; no custom dashboard
  needed).
- Cross-service/cross-instance messaging — this is still a single-process
  app; the broker sits between features within that one process, not
  between separate services.

## 3. Decisions

| Decision | Rationale |
|---|---|
| RabbitMQ over Kafka for this pass | Single consumer, single process — Kafka's throughput/replay/multi-consumer strengths aren't exercised yet. Kafka stays a candidate once there's a real second consumer or an analytics use case. |
| Native via Homebrew, not Docker-only | Matches Postgres/Redis (core deps run natively for `make dev`); the observability stack (Loki/Grafana) is Docker-only because it's optional tooling layered on top, not because Docker is the default — event messaging is core app behavior and needs to run in normal day-to-day dev, not just under `make obs-up`. |
| `amqp-connection-manager` (wraps `amqplib`) over raw `amqplib` | This project has twice been bitten by hand-rolled reconnect logic done wrong (the BullMQ/Redis bootstrap-ordering bug and the rate-limiter infinite-reconnect-loop bug, both in the PLAN.md decisions log for 2026-08-16 and 2026-08-22). A maintained reconnect wrapper removes that whole failure class rather than re-deriving it a third time. |
| Manual ack + dead-letter exchange, not auto-ack | Auto-ack would silently drop an event forever the moment the consumer throws (e.g. a transient DB error). Manual ack + DLX means a failed message lands in `notifications.events.dlq` instead of vanishing, and a genuinely broken message doesn't hot-loop the consumer either. Matches this project's established bias toward explicit correctness over convenience (Zod fail-fast env validation, `FOR UPDATE` row locking, etc.). |
| One topic exchange (`cowrywise.events`), not one exchange per event type | A topic exchange with routing keys (`circle.payout`, `kyc.approved`, `kyc.rejected`) gives room to add more event types later via routing-key pattern bindings, without provisioning new exchanges each time. |
| Publisher lives in `Utils/eventBus.ts`, generic — not Notifications-specific | Circles and Admin publish events; Notifications only consumes. A Notifications-owned publisher would be a backwards dependency. Mirrors how `Utils/mailer.ts` and `Utils/paystack.ts` are already generic utilities any feature imports. |
| Consumer lives in `Notifications/consumer.ts`, not a generic `Events/` folder | Right now Notifications is the only consumer. The side effect it produces (a notification row) belongs to that feature, matching how `Admin`'s broadcast endpoint already lives in `Admin` rather than `Notifications` (PLAN.md, 2026-08-22 decisions log) — code lives with the feature that owns the resulting effect, not with the transport mechanism. |
| Connection/consumer bootstrap in `index.ts`, same process as BullMQ | This is a single-process app by existing deliberate choice (PLAN.md, 2026-08-22: rate limiters moved to in-memory specifically because "cross-instance shared rate-limit state was never actually a requirement"). A separate worker process would be new operational complexity this project has already decided it doesn't need. |

## 4. Architecture

### 4.1 Infra & connection

- `brew install rabbitmq`, added to the Makefile's dependency-check/setup
  targets alongside Postgres/Redis.
- New env var `RABBITMQ_URL` (default `amqp://guest:guest@localhost:5672`),
  Zod-validated in `Config/env.ts` exactly like `DATABASE_URL`/`REDIS_URL`.
- New `Config/rabbitmq.ts`: creates an `amqp-connection-manager` connection
  manager, asserts the exchange/queues/bindings idempotently (safe to run on
  every boot), and exports `getChannel()` for the publisher/consumer to use.
  Shape mirrors `Config/redis.ts`'s `startRedisClient()` — a `startRabbitMQ()`
  function called from `index.ts`.

### 4.2 Topology

- Exchange: `cowrywise.events`, type `topic`, durable.
- Dead-letter exchange: `cowrywise.events.dlx`, type `fanout`, durable.
- Queue: `notifications.events`, durable, arguments set to route nacked
  messages to `cowrywise.events.dlx`. Bound to `cowrywise.events` with
  routing keys `circle.payout`, `kyc.approved`, `kyc.rejected`.
- Dead-letter queue: `notifications.events.dlq`, durable, bound to
  `cowrywise.events.dlx`.

### 4.3 Publisher — `Utils/eventBus.ts`

- `publishEvent(routingKey: string, payload: Record<string, unknown>)`:
  gets the channel via `Config/rabbitmq.ts`, publishes to `cowrywise.events`
  with the given routing key, `persistent: true`, JSON-serialized body.
- No return value the caller needs to act on — same fire-and-forget shape as
  today's `createNotification` calls.

### 4.4 Consumer — `Notifications/consumer.ts`

- `startNotificationEventConsumer()`: subscribes to `notifications.events`
  with manual ack (`noAck: false`).
- On each message: switch on routing key, map payload to the existing
  `notificationsService.createNotification(userId, type, title, body)`
  call, `ack()` on success.
- On a thrown error: log it via the existing `logger`, `nack(msg, false,
  false)` (no requeue — goes to the DLQ instead of looping).
- Started from `index.ts`, called alongside `startCronService()`, after
  `startRabbitMQ()`.

### 4.5 Event payloads

| Routing key | Payload | Maps to |
|---|---|---|
| `circle.payout` | `{ userId, circleId, round }` (`round` = `circle.currentRound` at contribution time) | `createNotification(userId, "CIRCLE", "Circle payout received", "Your circle round has completed and the payout has been credited to your wallet.")` |
| `kyc.approved` | `{ userId }` | `createNotification(userId, "KYC", "KYC approved", "Your identity verification has been approved.")` |
| `kyc.rejected` | `{ userId, reason }` | `createNotification(userId, "KYC", "KYC rejected", \`Your identity verification was rejected: ${reason}\`)` |

The notification title/body text itself moves from the call site into the
consumer — the call site now only knows "this event happened," not "here is
the exact user-facing copy for it." This is the actual decoupling the whole
exercise is for.

### 4.6 Migrating the three call sites

- `Circles/controller.ts` (`contribute` method, payout block): replace the
  `try { createNotification(...) } catch` block with
  `try { await publishEvent("circle.payout", { userId: result.recipientUserId, ... }) } catch`.
- `Admin/service.ts` (`approveKyc`): same swap, `kyc.approved`.
- `Admin/service.ts` (`rejectKyc`): same swap, `kyc.rejected`, payload
  includes `reason`.
- Each site keeps its existing try/catch and `console.error`/logger call —
  publish failures get the exact same non-fatal handling notification
  creation failures got before.

### 4.7 Testing

- `Utils/eventBus.ts` mocked globally in `tests/setup.ts`, same mechanism as
  `Utils/mailer.ts`/`Utils/paystack.ts` (so no test ever needs a real broker
  running).
- The mock is a Jest spy; tests assert `publishEvent` was called with the
  expected routing key and payload shape at the three call sites — the same
  boundary the current Circles/Auth/Wallet tests already draw around
  external side effects.
- The consumer itself (`Notifications/consumer.ts`) is testable separately
  and directly: call its message handler function with a fabricated payload
  and assert `notificationsService.createNotification` was called correctly
  — no real queue needed for that either.

## 5. Out-of-scope follow-ups (not part of this pass)

- Kafka, once there's a real second consumer or a streaming/analytics use
  case for the same events.
- Extending the event set beyond the three existing notification triggers
  (e.g. referral events, savings/investment events) — natural next step
  once this lands, but deliberately left out here to keep the first pass
  small and provable.
- The other three original stack gaps: NGINX, Elasticsearch, APM/metrics —
  each gets its own design pass.
