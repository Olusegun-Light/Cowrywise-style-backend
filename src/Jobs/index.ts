import {
  startInterestAccrualWorker,
  scheduleInterestAccrualJob,
} from "./interestAccrual";
import {
  startRecurringDebitWorker,
  scheduleRecurringDebitJob,
} from "./recurringDebit";

export const startCronService = async () => {
  startInterestAccrualWorker();
  await scheduleInterestAccrualJob();

  startRecurringDebitWorker();
  await scheduleRecurringDebitJob();

  console.log("BullMQ cron service started");
};
