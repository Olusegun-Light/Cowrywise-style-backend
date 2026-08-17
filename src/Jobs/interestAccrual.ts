import { Queue, Worker } from "bullmq";
import prisma from "../Config/db";
import { Prisma } from "../generated/prisma/client";
import { getBullMQConnection } from "../Config/redis";
import { getApyForPlanType, type PlanType } from "../Features/Savings/service";

const QUEUE_NAME = "interestAccrual";

export const interestAccrualQueue = new Queue(QUEUE_NAME, {
  connection: getBullMQConnection(),
});

export const accrueInterestForPlan = async (planId: string, date: Date) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          status: string;
          currentBalance: bigint;
          planType: PlanType;
        }[]
      >`SELECT id, status, "currentBalance", "planType" FROM "SavingsPlan" WHERE id = ${planId} FOR UPDATE`;

      const plan = rows[0];
      if (!plan || plan.status !== "ACTIVE") {
        return { accrued: false };
      }

      const apy = getApyForPlanType(plan.planType);
      const dailyRate = apy / 365;
      const interestAmount = BigInt(
        Math.floor(Number(plan.currentBalance) * dailyRate),
      );

      if (interestAmount <= 0n) {
        return { accrued: false };
      }

      await tx.interestAccrual.create({
        data: {
          savingsPlanId: plan.id,
          accrualDate: date,
          amount: interestAmount,
        },
      });

      await tx.savingsPlan.update({
        where: { id: plan.id },
        data: {
          currentBalance: { increment: interestAmount },
          lastAccruedAt: new Date(),
        },
      });

      return { accrued: true, amount: interestAmount };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { accrued: false, reason: "already accrued for this date" };
    }
    throw err;
  }
};

export const runDailyInterestAccrual = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const activePlans = await prisma.savingsPlan.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const results = await Promise.all(
    activePlans.map((plan) => accrueInterestForPlan(plan.id, today)),
  );

  const accruedCount = results.filter((r) => r.accrued).length;
  console.log(
    `Interest accrual run: ${accruedCount}/${activePlans.length} plans accrued`,
  );

  return { total: activePlans.length, accrued: accruedCount };
};

export const startInterestAccrualWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runDailyInterestAccrual();
    },
    { connection: getBullMQConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error("Interest accrual job failed:", err);
  });

  worker.on("error", (err) => {
    console.error("Interest accrual worker error:", err);
  });

  return worker;
};

export const scheduleInterestAccrualJob = async () => {
  await interestAccrualQueue.upsertJobScheduler("dailyAccrual", {
    pattern: "0 0 * * *",
  });

  console.log("Scheduled daily interest accrual job (midnight)");
};
