import { Queue, Worker } from "bullmq";
import prisma from "../Config/db";
import { getBullMQConnection } from "../Config/redis";
import * as savingsService from "../Features/Savings/service";

const QUEUE_NAME = "recurringDebit";

export const recurringDebitQueue = new Queue(QUEUE_NAME, {
  connection: getBullMQConnection(),
});

const FREQUENCY_MS: Record<string, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

const isDue = (
  plan: {
    frequency: string | null;
    lastRecurringDebitAt: Date | null;
    createdAt: Date;
  },
  now: Date,
) => {
  if (!plan.frequency) {
    return false;
  }

  const intervalMs = FREQUENCY_MS[plan.frequency];
  if (!intervalMs) {
    return false;
  }

  const last = plan.lastRecurringDebitAt ?? plan.createdAt;
  const elapsed = now.getTime() - last.getTime();

  return elapsed >= intervalMs;
};

export const runRecurringDebits = async () => {
  const now = new Date();

  const plans = await prisma.savingsPlan.findMany({
    where: { status: "ACTIVE", planType: "RECURRING" },
  });

  let debited = 0;
  let skipped = 0;

  for (const plan of plans) {
    if (!plan.recurringAmount || !isDue(plan, now)) {
      continue;
    }

    try {
      await savingsService.fundPlanFromWallet(
        plan.userId,
        plan.id,
        plan.recurringAmount,
        { lastRecurringDebitAt: now },
      );
      debited++;
    } catch (err) {
      console.error(
        `Recurring debit failed for plan ${plan.id}:`,
        err instanceof Error ? err.message : err,
      );
      skipped++;
    }
  }

  console.log(`Recurring debit run: ${debited} debited, ${skipped} skipped`);
  return { debited, skipped };
};

export const startRecurringDebitWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runRecurringDebits();
    },
    { connection: getBullMQConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error("Recurring debit job failed:", err);
  });

  return worker;
};

export const scheduleRecurringDebitJob = async () => {
  await recurringDebitQueue.upsertJobScheduler("dailyRecurringDebitCheck", {
    pattern: "0 1 * * *",
  });

  console.log("Scheduled daily recurring-debit check (1am)");
};
