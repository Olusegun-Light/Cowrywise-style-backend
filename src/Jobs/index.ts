import {
  startInterestAccrualWorker,
  scheduleInterestAccrualJob,
} from "./interestAccrual";
import {
  startRecurringDebitWorker,
  scheduleRecurringDebitJob,
} from "./recurringDebit";
import {
  startTransactionSearchSyncWorker,
  scheduleTransactionSearchSyncJob,
} from "./transactionSearchSync";
import { logger } from "../Utils/logger";

export const startCronService = async () => {
  startInterestAccrualWorker();
  await scheduleInterestAccrualJob();

  startRecurringDebitWorker();
  await scheduleRecurringDebitJob();

  startTransactionSearchSyncWorker();
  await scheduleTransactionSearchSyncJob();

  logger.info("BullMQ cron service started");
};
