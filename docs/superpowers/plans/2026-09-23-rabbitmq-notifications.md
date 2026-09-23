# RabbitMQ Event Messaging for Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note for this project specifically:** this repo's established convention is paste-and-verify, not direct Edit/Write of product code (see PLAN.md decisions log, 2026-09-05: "Future sessions default back to paste-and-verify unless told otherwise again"). Whoever executes this plan should treat every "write the code" step as "present the code for the human to paste in," then verify by reading the file back before running the step's test/build command — not as an instruction to call Edit/Write directly on product source files.

**Goal:** Replace the three direct `notificationsService.createNotification` call sites (Circles payout, Admin KYC approve/reject) with a RabbitMQ topic-exchange publish, consumed by a new Notifications consumer — genuinely decoupled, same non-fatal-failure guarantee the direct calls already have today.

**Architecture:** One durable topic exchange (`cowrywise.events`) with a dead-letter exchange, one durable queue (`notifications.events`) bound to three routing keys, a generic publisher (`Utils/eventBus.ts`), and a Notifications-owned consumer (`Notifications/consumer.ts`) that turns each event back into the same `createNotification` call the direct sites make today. Runs in the same Node process as everything else (no separate worker), started from `index.ts` next to the existing BullMQ cron service.

**Tech Stack:** `amqp-connection-manager` (wraps `amqplib`) for a self-reconnecting RabbitMQ client, RabbitMQ itself run natively via Homebrew.

**Spec:** `docs/superpowers/specs/2026-09-23-rabbitmq-notifications-design.md`

## Global Constraints

- Client library is `amqp-connection-manager` wrapping `amqplib` — never raw `amqplib` alone (spec §3: two prior reconnect-logic bugs in this codebase's history).
- Manual ack only (`noAck: false`); a failed message is `nack(msg, false, false)` — never auto-ack, never requeued back onto the same queue.
- Exact names, no deviation: exchange `cowrywise.events` (topic, durable); dead-letter exchange `cowrywise.events.dlx` (fanout, durable); queue `notifications.events` (durable); dead-letter queue `notifications.events.dlq` (durable).
- Exact routing keys for this pass, no others: `circle.payout`, `kyc.approved`, `kyc.rejected`.
- RabbitMQ runs natively via Homebrew for day-to-day `make dev` — not Docker-only, not part of the opt-in `make obs-up` stack (spec §3).
- Publisher (`Utils/eventBus.ts`) is generic and feature-agnostic — Notifications may not import it as "its own"; Circles and Admin import it directly.
- Consumer lives in `Notifications/consumer.ts`, not a generic `Events/` folder.
- All bootstrap (`startRabbitMQ`, `startNotificationEventConsumer`) happens in `index.ts`, same process as `startCronService()` — no separate worker process.
- `Utils/eventBus.ts` is mocked globally in `tests/setup.ts`, exactly like `Utils/mailer.ts` and `Utils/paystack.ts` — no test may require a real broker.

## Review Focus

- **RabbitMQ down when the server boots** — `amqp-connection-manager` retries forever by default and never rejects; if `index.ts` awaits an unbounded connect, the entire API (including auth/wallet, which have nothing to do with messaging) never starts listening. Must be bounded and non-fatal.
- **RabbitMQ goes down mid-request** — `channelWrapper.publish()` from `Utils/eventBus.ts` will wait indefinitely for a channel if the broker is unreachable, which would hang the calling HTTP request (a circle contribution, a KYC decision) since both call sites `await` the publish inside their try/catch. Must be bounded so the existing try/catch actually catches something instead of hanging.
- **Consumer handler throws** (malformed payload, DB error inside `createNotification`) — must `nack` to the DLQ, not crash the consumer loop or silently drop the message via auto-ack.
- **Unrecognized routing key reaches the queue** (future misconfiguration, typo in a publish call) — must not crash the consumer; logged and acknowledged, not treated as a poison message needing DLQ retry.
- **Redelivery after an unacked message** (RabbitMQ's at-least-once delivery can redeliver the same message if the consumer disconnects before acking) — `createNotification` has no idempotency key tying it to a source event, so a redelivery creates a duplicate notification row. This is a known, accepted tradeoff for this pass (documented in Task 6), not a bug to silently fix with new machinery.

---

## Task 1: Local RabbitMQ + dependencies

**Files:**
- Modify: `Makefile`
- Modify: `src/Config/env.ts`
- Modify: `.env`, `.env.example`
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: `env.RABBITMQ_URL` (string, defaults to `amqp://guest:guest@localhost:5672`), available to every later task via `import { env } from "./env"` (or `"../Config/env"` from a feature folder).

- [ ] **Step 1: Install and start RabbitMQ, enable the management plugin**

```bash
brew install rabbitmq
brew services start rabbitmq
rabbitmq-plugins enable rabbitmq_management
```

- [ ] **Step 2: Verify it's actually running**

```bash
rabbitmqctl status | head -5
curl -s -u guest:guest http://localhost:15672/api/overview | head -c 200
```

Expected: `rabbitmqctl status` prints a running node; the `curl` prints a JSON blob starting with `{"management_version"...`. The management UI is also now reachable at `http://localhost:15672` (guest/guest) if you want to look at it in a browser as we go.

- [ ] **Step 3: Add Makefile targets, mirroring the existing `redis-up`/`redis-down` pattern**

Paste into `Makefile`, in the `REDIS` section (right after `redis-down`'s recipe, before the `BUILD` section comment):

```makefile
# ===============================
# RABBITMQ
# ===============================

rabbitmq-up:
	@rabbitmqctl status > /dev/null 2>&1 && echo "✅ RabbitMQ already running" || ( \
		echo "🐇 Starting RabbitMQ..." && \
		brew services start rabbitmq \
	)

rabbitmq-down:
	@echo "🐇 Stopping RabbitMQ..."
	@brew services stop rabbitmq || true
```

Then update three existing lines in the same file:
- `.PHONY:` line — add `rabbitmq-up rabbitmq-down` to the list.
- `start:` target — change `start: db-up redis-up dev` to `start: db-up redis-up rabbitmq-up dev`.
- `stop:` target — change `stop: db-down redis-down` to `stop: db-down redis-down rabbitmq-down`.
- `status:` target — add `@rabbitmqctl status > /dev/null 2>&1 && echo "✅ RabbitMQ up" || echo "❌ RabbitMQ down"` as a new line inside its recipe.

- [ ] **Step 4: Verify the Makefile changes**

```bash
make rabbitmq-up
make status
```

Expected: both print RabbitMQ as already running (from Step 1/2), no errors.

- [ ] **Step 5: Add `RABBITMQ_URL` to the Zod env schema**

In `src/Config/env.ts`, add this line inside `envSchema` (after `REDIS_URL: z.string().url(),`):

```typescript
  RABBITMQ_URL: z.string().url().default("amqp://guest:guest@localhost:5672"),
```

- [ ] **Step 6: Add the same var to `.env` and `.env.example`**

In `.env.example`, add after the `REDIS_URL` line:

```
RABBITMQ_URL="amqp://guest:guest@localhost:5672"
```

Add the identical line to your local `.env` (not committed, but needed for `make dev` to have an explicit value even though the schema default would cover it).

- [ ] **Step 7: Install the npm packages**

```bash
npm install amqp-connection-manager amqplib
npm install -D @types/amqplib
```

- [ ] **Step 8: Confirm the app still boots with the new env var in place**

```bash
npm run build
```

Expected: clean build, no TypeScript errors (nothing imports the new packages yet, this just confirms `env.ts`'s new field doesn't break the Zod schema or anything reading `env`).

- [ ] **Step 9: Commit**

```bash
git add Makefile src/Config/env.ts .env.example package.json package-lock.json
git commit -m "Add RabbitMQ (native via Homebrew) and client dependencies"
```

(`.env` is gitignored — nothing to add there.)

---

## Task 2: `Config/rabbitmq.ts` — connection and topology

**Files:**
- Create: `src/Config/rabbitmq.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `env.RABBITMQ_URL` (Task 1), `logger` from `src/Utils/logger.ts`.
- Produces: `channelWrapper: ChannelWrapper` (used by `Utils/eventBus.ts` in Task 3 and `Notifications/consumer.ts` in Task 4), `EXCHANGE: string`, `NOTIFICATIONS_QUEUE: string`, `startRabbitMQ(): Promise<void>` (used by `index.ts`, this task).

- [ ] **Step 1: Create `src/Config/rabbitmq.ts`**

```typescript
import amqp, { type ChannelWrapper } from "amqp-connection-manager";
import type { ConfirmChannel } from "amqplib";
import { env } from "./env";
import { logger } from "../Utils/logger";

export const EXCHANGE = "cowrywise.events";
export const DEAD_LETTER_EXCHANGE = "cowrywise.events.dlx";
export const NOTIFICATIONS_QUEUE = "notifications.events";
export const NOTIFICATIONS_DLQ = "notifications.events.dlq";
export const NOTIFICATION_ROUTING_KEYS = [
  "circle.payout",
  "kyc.approved",
  "kyc.rejected",
] as const;

const CONNECT_TIMEOUT_MS = 10_000;

const connection = amqp.connect([env.RABBITMQ_URL]);

connection.on("connectFailed", (err) =>
  logger.error({ err }, "RabbitMQ connection attempt failed"),
);
connection.on("disconnect", ({ err }) =>
  logger.warn({ err }, "RabbitMQ disconnected — will keep retrying"),
);

export const channelWrapper: ChannelWrapper = connection.createChannel({
  json: true,
  setup: async (channel: ConfirmChannel) => {
    await channel.assertExchange(EXCHANGE, "topic", { durable: true });
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, "fanout", {
      durable: true,
    });

    await channel.assertQueue(NOTIFICATIONS_DLQ, { durable: true });
    await channel.bindQueue(NOTIFICATIONS_DLQ, DEAD_LETTER_EXCHANGE, "");

    await channel.assertQueue(NOTIFICATIONS_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
      },
    });

    for (const key of NOTIFICATION_ROUTING_KEYS) {
      await channel.bindQueue(NOTIFICATIONS_QUEUE, EXCHANGE, key);
    }
  },
});

export const startRabbitMQ = async () => {
  try {
    await Promise.race([
      channelWrapper.waitForConnect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("RabbitMQ connect timed out")),
          CONNECT_TIMEOUT_MS,
        ),
      ),
    ]);
    logger.info("RabbitMQ is connected");
  } catch (err) {
    logger.error(
      { err },
      "RabbitMQ did not connect within the timeout — continuing startup without it; publishing/consuming will keep retrying in the background",
    );
  }
};
```

This is why `startRabbitMQ` never throws: a down broker must not block `app.listen()` (Review Focus, item 1) or crash the boot sequence — it logs and moves on, and `amqp-connection-manager`'s own background retry picks the connection back up whenever the broker becomes available.

- [ ] **Step 2: Wire it into `src/index.ts`**

Add the import near the top, with the other `Config` imports:

```typescript
import { startRabbitMQ } from "./Config/rabbitmq";
```

In the `start` function, add the call right after `await startRedisClient();`:

```typescript
  await startRedisClient();
  await startRabbitMQ();
```

- [ ] **Step 3: Verify live — topology gets created on boot**

```bash
npm run dev
```

Expected in the terminal: a log line `RabbitMQ is connected` shortly after boot (pino-pretty formatted). Leave it running, then in another terminal:

```bash
rabbitmqctl list_exchanges name type
rabbitmqctl list_queues name durable
rabbitmqctl list_bindings source_name routing_key destination_name
```

Expected: `cowrywise.events` (topic) and `cowrywise.events.dlx` (fanout) in the exchange list; `notifications.events` and `notifications.events.dlq` in the queue list, both `true` for durable; three bindings from `cowrywise.events` (routing keys `circle.payout`, `kyc.approved`, `kyc.rejected`) into `notifications.events`, plus one binding from `cowrywise.events.dlx` into `notifications.events.dlq`.

- [ ] **Step 4: Verify the bounded-timeout behavior (Review Focus item 1)**

```bash
make rabbitmq-down
npm run dev
```

Expected: the server still logs its normal "Server running at http://localhost:PORT" line and stays up — it should NOT hang waiting on RabbitMQ. You'll see the `RabbitMQ did not connect within the timeout...` warning around 10 seconds in, but `app.listen` already happened. Then:

```bash
make rabbitmq-up
```

Expected: within a few seconds, a `RabbitMQ is connected` (or reconnect) log line appears in the still-running `npm run dev` process — `amqp-connection-manager` picked the connection back up without a restart. Stop the dev server with Ctrl+C when done.

- [ ] **Step 5: Commit**

```bash
git add src/Config/rabbitmq.ts src/index.ts
git commit -m "Add RabbitMQ connection manager, topic exchange, and DLX topology"
```

---

## Task 3: `Utils/eventBus.ts` — generic publisher

**Files:**
- Create: `src/Utils/eventBus.ts`
- Create: `src/Utils/__mocks__/eventBus.ts`
- Modify: `tests/setup.ts`
- Test: `tests/Utils/eventBus.test.ts`

**Interfaces:**
- Consumes: `channelWrapper`, `EXCHANGE` from `src/Config/rabbitmq.ts` (Task 2).
- Produces: `publishEvent(routingKey: string, payload: Record<string, unknown>): Promise<void>` — used by Circles/Admin in Task 5, and by the mock in every test.

- [ ] **Step 1: Write the failing test first**

Create `tests/Utils/eventBus.test.ts`:

```typescript
jest.mock("../../src/Config/rabbitmq", () => ({
  channelWrapper: { publish: jest.fn() },
  EXCHANGE: "cowrywise.events",
}));

import { publishEvent } from "../../src/Utils/eventBus";
import { channelWrapper } from "../../src/Config/rabbitmq";

describe("publishEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("publishes to the shared exchange with the given routing key and a persistent, JSON payload", async () => {
    (channelWrapper.publish as jest.Mock).mockResolvedValue(true);

    await publishEvent("kyc.approved", { userId: "user-1" });

    expect(channelWrapper.publish).toHaveBeenCalledWith(
      "cowrywise.events",
      "kyc.approved",
      { userId: "user-1" },
      { persistent: true },
    );
  });

  it("rejects instead of hanging forever if the broker never responds", async () => {
    jest.useFakeTimers();
    (channelWrapper.publish as jest.Mock).mockReturnValue(new Promise(() => {}));

    const result = publishEvent("kyc.approved", { userId: "user-1" });
    const assertion = expect(result).rejects.toThrow(/timed out/);

    await jest.advanceTimersByTimeAsync(5_000);
    await assertion;
  });
});
```

This is Review Focus item 2 pinned directly to the publisher: a broker that never responds must make `publishEvent` reject within a bounded time, not hang.

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx jest tests/Utils/eventBus.test.ts
```

Expected: FAIL — `Cannot find module '../../src/Utils/eventBus'`.

- [ ] **Step 3: Create `src/Utils/eventBus.ts`**

```typescript
import { channelWrapper, EXCHANGE } from "../Config/rabbitmq";

const PUBLISH_TIMEOUT_MS = 5_000;

export const publishEvent = async (
  routingKey: string,
  payload: Record<string, unknown>,
) => {
  await Promise.race([
    channelWrapper.publish(EXCHANGE, routingKey, payload, {
      persistent: true,
    }),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `publishEvent timed out after ${PUBLISH_TIMEOUT_MS}ms (routingKey=${routingKey})`,
            ),
          ),
        PUBLISH_TIMEOUT_MS,
      ),
    ),
  ]);
};
```

No try/catch inside this function on purpose — matching how `createNotification` itself has none today. The caller (Circles, Admin) wraps the call in its own try/catch, exactly like it already does.

- [ ] **Step 4: Run the test again to confirm it passes**

```bash
npx jest tests/Utils/eventBus.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Add the global test mock, matching `Utils/mailer.ts`'s pattern**

Create `src/Utils/__mocks__/eventBus.ts`:

```typescript
export const publishEvent = jest.fn().mockResolvedValue(undefined);
```

In `tests/setup.ts`, add a line next to the existing two mocks at the top of the file:

```typescript
jest.mock("../src/Utils/mailer");
jest.mock("../src/Utils/paystack");
jest.mock("../src/Utils/eventBus");
```

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all existing suites still pass (auth, wallet, circles) — this mock doesn't change any current behavior since nothing calls `publishEvent` yet.

- [ ] **Step 7: Commit**

```bash
git add src/Utils/eventBus.ts src/Utils/__mocks__/eventBus.ts tests/setup.ts tests/Utils/eventBus.test.ts
git commit -m "Add generic RabbitMQ event publisher with bounded publish timeout"
```

---

## Task 4: `Notifications/consumer.ts`

**Files:**
- Create: `src/Features/Notifications/consumer.ts`
- Modify: `src/index.ts`
- Test: `tests/Features/notifications-consumer.test.ts`

**Interfaces:**
- Consumes: `channelWrapper`, `NOTIFICATIONS_QUEUE` from `src/Config/rabbitmq.ts` (Task 2); `createNotification` from `src/Features/Notifications/service.ts` (exists already).
- Produces: `handleMessage(routingKey: string, payload: unknown): Promise<void>` (exported for direct unit testing), `startNotificationEventConsumer(): Promise<void>` (used by `index.ts`, this task).

- [ ] **Step 1: Write the failing tests first**

Create `tests/Features/notifications-consumer.test.ts`:

```typescript
jest.mock("../../src/Features/Notifications/service");

import { handleMessage } from "../../src/Features/Notifications/consumer";
import * as notificationsService from "../../src/Features/Notifications/service";

describe("Notifications event consumer — handleMessage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("turns a circle.payout event into a CIRCLE notification", async () => {
    await handleMessage("circle.payout", {
      userId: "user-1",
      circleId: "circle-1",
      round: 2,
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-1",
      "CIRCLE",
      "Circle payout received",
      "Your circle round has completed and the payout has been credited to your wallet.",
    );
  });

  it("turns a kyc.approved event into a KYC notification", async () => {
    await handleMessage("kyc.approved", { userId: "user-2" });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-2",
      "KYC",
      "KYC approved",
      "Your identity verification has been approved.",
    );
  });

  it("turns a kyc.rejected event into a KYC notification carrying the reason", async () => {
    await handleMessage("kyc.rejected", {
      userId: "user-3",
      reason: "Selfie did not match ID photo",
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-3",
      "KYC",
      "KYC rejected",
      "Your identity verification was rejected: Selfie did not match ID photo",
    );
  });

  it("logs and does nothing for an unrecognized routing key, without throwing", async () => {
    await expect(
      handleMessage("some.future.event", { anything: true }),
    ).resolves.toBeUndefined();

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});
```

The last test pins Review Focus item 4: an unrecognized routing key must not throw (which would otherwise dead-letter a message that isn't actually broken, just not yet handled).

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/Features/notifications-consumer.test.ts
```

Expected: FAIL — `Cannot find module '../../src/Features/Notifications/consumer'`.

- [ ] **Step 3: Create `src/Features/Notifications/consumer.ts`**

```typescript
import type { ConsumeMessage } from "amqplib";
import { channelWrapper, NOTIFICATIONS_QUEUE } from "../../Config/rabbitmq";
import { logger } from "../../Utils/logger";
import * as notificationsService from "./service";

type CirclePayoutEvent = { userId: string; circleId: string; round: number };
type KycApprovedEvent = { userId: string };
type KycRejectedEvent = { userId: string; reason: string };

export const handleMessage = async (
  routingKey: string,
  payload: unknown,
): Promise<void> => {
  switch (routingKey) {
    case "circle.payout": {
      const { userId } = payload as CirclePayoutEvent;
      await notificationsService.createNotification(
        userId,
        "CIRCLE",
        "Circle payout received",
        "Your circle round has completed and the payout has been credited to your wallet.",
      );
      return;
    }
    case "kyc.approved": {
      const { userId } = payload as KycApprovedEvent;
      await notificationsService.createNotification(
        userId,
        "KYC",
        "KYC approved",
        "Your identity verification has been approved.",
      );
      return;
    }
    case "kyc.rejected": {
      const { userId, reason } = payload as KycRejectedEvent;
      await notificationsService.createNotification(
        userId,
        "KYC",
        "KYC rejected",
        `Your identity verification was rejected: ${reason}`,
      );
      return;
    }
    default:
      logger.warn({ routingKey }, "Unrecognized notification event routing key — acking without action");
      return;
  }
};

export const startNotificationEventConsumer = async () => {
  await channelWrapper.addSetup(async (channel) => {
    await channel.consume(
      NOTIFICATIONS_QUEUE,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          await handleMessage(msg.fields.routingKey, payload);
          channel.ack(msg);
        } catch (err) {
          logger.error(
            { err, routingKey: msg.fields.routingKey },
            "Failed to process notification event — dead-lettering",
          );
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  });
  logger.info("Notification event consumer started");
};
```

The `default` case in `handleMessage` returning normally (not throwing) is what makes the last test pass and satisfies Review Focus item 4 — an unrecognized key gets logged and acked, not dead-lettered. The `try/catch` around `handleMessage` inside the actual queue consumer is what satisfies Review Focus item 3 — any real failure (malformed JSON, `createNotification` throwing on a DB error) gets `nack(msg, false, false)`, landing it in `notifications.events.dlq` instead of crashing the consumer loop or looping forever.

- [ ] **Step 4: Run the tests again to confirm they pass**

```bash
npx jest tests/Features/notifications-consumer.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Wire the consumer into `src/index.ts`**

Add the import:

```typescript
import { startNotificationEventConsumer } from "./Features/Notifications/consumer";
```

In `start()`, right after `await startRabbitMQ();`:

```typescript
  await startRabbitMQ();
  await startNotificationEventConsumer();
```

- [ ] **Step 6: Live end-to-end verification — healthy path**

```bash
make rabbitmq-up
npm run dev
```

In another terminal, publish a test message directly (bypassing the app entirely, to test the consumer in isolation):

```bash
node -e '
const amqp = require("amqp-connection-manager");
const conn = amqp.connect(["amqp://guest:guest@localhost:5672"]);
const ch = conn.createChannel({ json: true });
ch.publish("cowrywise.events", "kyc.approved", { userId: "REPLACE_WITH_A_REAL_USER_ID" }, { persistent: true })
  .then(() => { console.log("published"); process.exit(0); });
'
```

(Grab a real `userId` first via `make db-shell` then `SELECT id FROM "User" LIMIT 1;`.)

Expected: the `npm run dev` terminal logs no errors; `rabbitmqctl list_queues name messages` shows `notifications.events` back at 0 messages (consumed and acked); a new row exists in the `Notification`/`NotificationRecipient` tables for that user (check via `make db-shell` → `SELECT * FROM "Notification" ORDER BY "createdAt" DESC LIMIT 1;`).

- [ ] **Step 7: Live end-to-end verification — dead-letter path**

Publish a message with a routing key the queue is bound to, but a payload that will make `createNotification` throw (an invalid/non-existent `userId` — Prisma will reject the foreign key):

```bash
node -e '
const amqp = require("amqp-connection-manager");
const conn = amqp.connect(["amqp://guest:guest@localhost:5672"]);
const ch = conn.createChannel({ json: true });
ch.publish("cowrywise.events", "kyc.approved", { userId: "not-a-real-user-id" }, { persistent: true })
  .then(() => { console.log("published"); process.exit(0); });
'
```

Expected: the `npm run dev` terminal logs a `Failed to process notification event — dead-lettering` error; `rabbitmqctl list_queues name messages` shows `notifications.events.dlq` at 1 message, `notifications.events` back at 0 (it didn't get stuck retrying). Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add src/Features/Notifications/consumer.ts src/index.ts tests/Features/notifications-consumer.test.ts
git commit -m "Add Notifications event consumer with manual ack and dead-lettering"
```

---

## Task 5: Migrate the three call sites

**Files:**
- Modify: `src/Features/Circles/service.ts:216` (the `contributeToCircle` return statement)
- Modify: `src/Features/Circles/controller.ts:48-70` (the `contribute` method's payout block)
- Modify: `src/Features/Admin/service.ts` (`approveKyc` and `rejectKyc`)
- Modify: `tests/Features/circles.test.ts`

**Interfaces:**
- Consumes: `publishEvent` from `src/Utils/eventBus.ts` (Task 3, mocked in tests via Task 3's Step 5).

- [ ] **Step 1: Add `round` to `contributeToCircle`'s return value**

In `src/Features/Circles/service.ts`, find the final line of `contributeToCircle`:

```typescript
    return { payoutTriggered, recipientUserId };
```

Replace it with:

```typescript
    return { payoutTriggered, recipientUserId, round: circle.currentRound };
```

This is needed because the controller doesn't currently receive which round the payout was for — the event payload needs it, so it has to come out of the transaction along with the other two fields.

- [ ] **Step 2: Update the existing circles test to assert the new field is present**

In `tests/Features/circles.test.ts`, the `bobRound1` assertion currently reads:

```typescript
    expect(bobRound1.body.data.payoutTriggered).toBe(true);
```

Leave that line as-is, and add directly after it:

```typescript
    expect(bobRound1.body.data.round).toBe(1);
```

- [ ] **Step 3: Run the circles test to confirm it still passes with the new field**

```bash
npx jest tests/Features/circles.test.ts
```

Expected: PASS.

- [ ] **Step 4: Migrate `Circles/controller.ts`'s payout block**

In `src/Features/Circles/controller.ts`, replace the import:

```typescript
import * as notificationsService from "../Notifications/service";
```

with:

```typescript
import { publishEvent } from "../../Utils/eventBus";
```

Then replace the payout block inside `contribute`:

```typescript
    if (result.payoutTriggered && result.recipientUserId) {
      try {
        await notificationsService.createNotification(
          result.recipientUserId,
          "CIRCLE",
          "Circle payout received",
          "Your circle round has completed and the payout has been credited to your wallet.",
        );
      } catch (err) {
        console.error("Failed to create circle payout notification:", err);
      }
    }
```

with:

```typescript
    if (result.payoutTriggered && result.recipientUserId) {
      try {
        await publishEvent("circle.payout", {
          userId: result.recipientUserId,
          circleId,
          round: result.round,
        });
      } catch (err) {
        console.error("Failed to publish circle payout event:", err);
      }
    }
```

- [ ] **Step 5: Write a test asserting the event is published**

In `tests/Features/circles.test.ts`, add this import at the top:

```typescript
import { publishEvent } from "../../src/Utils/eventBus";
```

Then, right after the `expect(bobRound1.body.data.round).toBe(1);` line from Step 2, add:

```typescript
    expect(publishEvent).toHaveBeenCalledWith("circle.payout", {
      userId: bob.userId,
      circleId,
      round: 1,
    });
```

- [ ] **Step 6: Run the test**

```bash
npx jest tests/Features/circles.test.ts
```

Expected: PASS. `publishEvent` is the globally-mocked Jest function from Task 3's Step 5, so this asserts the call site's behavior without touching a real broker.

- [ ] **Step 7: Migrate `Admin/service.ts`'s two KYC branches**

In `src/Features/Admin/service.ts`, replace the import:

```typescript
import * as notificationsService from "../Notifications/service";
```

with:

```typescript
import { publishEvent } from "../../Utils/eventBus";
```

In `approveKyc`, replace:

```typescript
  try {
    await notificationsService.createNotification(
      userId,
      "KYC",
      "KYC approved",
      "Your identity verification has been approved.",
    );
  } catch (err) {
    console.error("Failed to create KYC approval notification:", err);
  }
```

with:

```typescript
  try {
    await publishEvent("kyc.approved", { userId });
  } catch (err) {
    console.error("Failed to publish KYC approval event:", err);
  }
```

In `rejectKyc`, replace:

```typescript
  try {
    await notificationsService.createNotification(
      userId,
      "KYC",
      "KYC rejected",
      `Your identity verification was rejected: ${reason}`,
    );
  } catch (err) {
    console.error("Failed to create KYC rejection notification:", err);
  }
```

with:

```typescript
  try {
    await publishEvent("kyc.rejected", { userId, reason });
  } catch (err) {
    console.error("Failed to publish KYC rejection event:", err);
  }
```

- [ ] **Step 8: Full build and test suite**

```bash
npm run build
npm run lint
npm test
```

Expected: all three clean — no leftover references to `notificationsService` in either modified file (both files' only prior use of that import was the now-removed calls), no type errors, all test suites passing.

- [ ] **Step 9: Commit**

```bash
git add src/Features/Circles/service.ts src/Features/Circles/controller.ts src/Features/Admin/service.ts tests/Features/circles.test.ts
git commit -m "Migrate circle payout and KYC review notifications to RabbitMQ events"
```

---

## Task 6: End-to-end live verification and docs

**Files:**
- Modify: `PLAN.md`

**Interfaces:**
- None — this task only verifies and documents; no new code.

- [ ] **Step 1: Full live smoke test through the real HTTP API**

```bash
make rabbitmq-up
npm run dev
```

In another terminal, run the same 2-member circle flow the `circles.test.ts` integration test automates (signup two users, fund both wallets, create a circle, join, both contribute) using `curl` or Postman against `http://localhost:3000/api/v1`, ending with the second contribution that triggers payout.

Expected: the HTTP response for the payout-triggering contribution returns exactly as before (`payoutTriggered: true`, wallet balances updated) — request latency should feel normal, not delayed by ~5s (which would indicate the publish timeout from Task 3 is firing unexpectedly). Within a second or two, query the DB (`make db-shell`) and confirm a new `Notification`/`NotificationRecipient` row exists for the payout recipient with type `CIRCLE`.

- [ ] **Step 2: Confirm KYC approval end-to-end**

As an admin user, hit the KYC approve endpoint for a user with a pending KYC submission. Confirm the HTTP response is unchanged, and a `Notification` row of type `KYC` appears for that user shortly after.

- [ ] **Step 3: Confirm the DLQ is still empty after healthy traffic**

```bash
rabbitmqctl list_queues name messages
```

Expected: `notifications.events` and `notifications.events.dlq` both at 0 — nothing from Steps 1-2 should have dead-lettered.

- [ ] **Step 4: Re-run the full automated suite one more time clean**

```bash
npm run build
npm run lint
npm test
```

Expected: all clean, matching Task 5 Step 8 (this just re-confirms nothing regressed after the manual live testing touched real data).

- [ ] **Step 5: Update `PLAN.md`**

Add a new entry to the `## 6. Post-MVP roadmap — features to build next` list (as a new numbered item, following the existing `~~done~~` styling used for finished items), and a new dedicated section (mirroring the existing `### Post-MVP: Observability ✅ done (2026-09-05)` section's format) documenting:
- What was built (RabbitMQ topic exchange + DLX, generic publisher, Notifications consumer, three migrated call sites).
- The known limitation from Review Focus item 5: `createNotification` isn't idempotent, so a RabbitMQ redelivery after an unacked-but-processed message would create a duplicate notification row. Accepted tradeoff for this pass, same class as the in-memory rate limiter reset-on-restart tradeoff already documented elsewhere in this file.
- That Kafka and the other three original stack gaps (NGINX, Elasticsearch, APM/metrics) remain deferred, each its own future pass.

Add corresponding rows to the `## 7. Decisions log` table for: RabbitMQ over Kafka for this pass, native Homebrew hosting, `amqp-connection-manager` choice, manual ack + DLX, the bounded connect/publish timeouts (this is new information beyond what's in the spec — the timeout requirement was discovered while writing this plan, not in the original design), and the accepted duplicate-notification-on-redelivery tradeoff.

- [ ] **Step 6: Commit**

```bash
git add PLAN.md
git commit -m "Document RabbitMQ event messaging in PLAN.md"
```
