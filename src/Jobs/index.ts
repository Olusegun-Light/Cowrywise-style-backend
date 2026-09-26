import {
  startInterestAccrualWorker,
  scheduleInterestAccrualJob,
} from "./interestAccrual";
import {
  startRecurringDebitWorker,
  scheduleRecurringDebitJob,
} from "./recurringDebit";
import { logger } from "../Utils/logger";

export const startCronService = async () => {
  startInterestAccrualWorker();
  await scheduleInterestAccrualJob();

  startRecurringDebitWorker();
  await scheduleRecurringDebitJob();

  logger.info("BullMQ cron service started");
};
