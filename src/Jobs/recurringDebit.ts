import { Queue, Worker } from "bullmq";
import prisma from "../Config/db";
import { getBullMQConnection } from "../Config/redis";
import * as savingsService from "../Features/Savings/service";
import { logger } from "../Utils/logger";
import { withJobMetrics } from "../Utils/metrics";

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
      logger.error({ err, planId: plan.id }, "Recurring debit failed for plan");
      skipped++;
    }
  }

  logger.info({ debited, skipped }, "Recurring debit run completed");
  return { debited, skipped };
};

export const startRecurringDebitWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    withJobMetrics("recurringDebit", runRecurringDebits),
    { connection: getBullMQConnection() },
  );

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Recurring debit job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Recurring debit worker error");
  });

  return worker;
};

export const scheduleRecurringDebitJob = async () => {
  await recurringDebitQueue.upsertJobScheduler("dailyRecurringDebitCheck", {
    pattern: "0 1 * * *",
  });

  logger.info("Scheduled daily recurring-debit check (1am)");
};
