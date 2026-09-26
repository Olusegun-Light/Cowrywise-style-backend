import { Queue, Worker } from "bullmq";
import prisma from "../Config/db";
import { getBullMQConnection } from "../Config/redis";
import * as searchService from "../Features/Search/service";
import { withJobMetrics } from "../Utils/metrics";
import { logger } from "../Utils/logger";

const QUEUE_NAME = "transactionSearchSync";
const WINDOW_MS = 10 * 60 * 1000;

export const transactionSearchSyncQueue = new Queue(QUEUE_NAME, {
  connection: getBullMQConnection(),
});

export const runTransactionSearchSync = async () => {
  const since = new Date(Date.now() - WINDOW_MS);

  const transactions = await prisma.transaction.findMany({
    where: { updatedAt: { gt: since } },
    include: { wallet: { include: { user: true } } },
  });

  let indexed = 0;
  for (const transaction of transactions) {
    const user = transaction.wallet.user;
    if (!user) continue;
    try {
      await searchService.indexTransaction(transaction, user);
      indexed++;
    } catch (err) {
      logger.error(
        { err, transactionId: transaction.id },
        "Failed to index transaction — skipping",
      );
    }
  }

  logger.info(
    { indexed, total: transactions.length },
    "Transaction search sync run completed",
  );
  return { indexed, total: transactions.length };
};

export const startTransactionSearchSyncWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    withJobMetrics("transactionSearchSync", runTransactionSearchSync),
    { connection: getBullMQConnection() },
  );

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Transaction search sync job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Transaction search sync worker error");
  });

  return worker;
};

export const scheduleTransactionSearchSyncJob = async () => {
  await transactionSearchSyncQueue.upsertJobScheduler(
    "transactionSearchSyncSchedule",
    { pattern: "*/5 * * * *" },
  );

  logger.info("Scheduled transaction search sync job (every 5 minutes)");
};
