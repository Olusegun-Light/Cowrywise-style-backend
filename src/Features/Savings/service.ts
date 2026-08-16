import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import { randomUUID } from "crypto";

type PlanType = "FLEX" | "FIXED" | "RECURRING";

const PLAN_APY: Record<PlanType, number> = {
  FLEX: 0.08,
  FIXED: 0.12,
  RECURRING: 0.1,
};

export const getApyForPlanType = (planType: PlanType) => PLAN_APY[planType];

interface CreatePlanInput {
  userId: string;
  planType: PlanType;
  targetAmount: bigint;
  maturityDate?: Date;
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY";
  recurringAmount?: bigint;
}

export const createPlan = (input: CreatePlanInput) =>
  prisma.savingsPlan.create({
    data: {
      userId: input.userId,
      planType: input.planType,
      targetAmount: input.targetAmount,
      maturityDate: input.maturityDate,
      frequency: input.frequency,
      recurringAmount: input.recurringAmount,
    },
  });

export const getPlanByIdForUser = async (userId: string, planId: string) => {
  const plan = await prisma.savingsPlan.findFirst({
    where: { id: planId, userId },
  });

  if (!plan) {
    throw new AppError("Savings plan not found", 404);
  }

  return plan;
};

export const listPlansForUser = (userId: string) =>
  prisma.savingsPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

export const fundPlanFromWallet = async (
  userId: string,
  planId: string,
  amount: bigint,
  extraPlanData?: { lastRecurringDebitAt?: Date },
) => {
  return prisma.$transaction(async (tx) => {
    const walletRows = await tx.$queryRaw<
      { id: string; balance: bigint }[]
    >`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

    const wallet = walletRows[0];
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }
    if (wallet.balance < amount) {
      throw new AppError("Insufficient wallet balance", 400);
    }

    const plan = await tx.savingsPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) {
      throw new AppError("Savings plan not found", 404);
    }
    if (plan.status !== "ACTIVE") {
      throw new AppError("Plan is not active", 400);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    await tx.savingsPlan.update({
      where: { id: plan.id },
      data: { currentBalance: { increment: amount }, ...extraPlanData },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        savingsPlanId: plan.id,
        type: "SAVINGS_FUNDING",
        amount: -amount,
        status: "SUCCESS",
        providerReference: `savfund_${randomUUID()}`,
      },
    });
  });
};

export const withdrawFromPlan = async (
  userId: string,
  planId: string,
  amount: bigint,
) => {
  return prisma.$transaction(async (tx) => {
    const planRows = await tx.$queryRaw<
      {
        id: string;
        currentBalance: bigint;
        planType: string;
        status: string;
        maturityDate: Date | null;
      }[]
    >`SELECT id, "currentBalance", "planType", status, "maturityDate" FROM "SavingsPlan" WHERE id = ${planId} AND "userId" = ${userId} FOR UPDATE`;

    const plan = planRows[0];
    if (!plan) {
      throw new AppError("Savings plan not found", 404);
    }
    if (plan.status !== "ACTIVE") {
      throw new AppError("Plan is not active", 400);
    }
    if (plan.currentBalance < amount) {
      throw new AppError("Insufficient plan balance", 400);
    }
    if (plan.planType === "FIXED" && amount !== plan.currentBalance) {
      throw new AppError("FIXED plans can only be withdrawn in full", 400);
    }

    const isEarlyWithdrawal =
      plan.planType === "FIXED" &&
      plan.maturityDate !== null &&
      plan.maturityDate > new Date();

    const penalty = isEarlyWithdrawal ? (amount * 5n) / 100n : 0n;
    const payout = amount - penalty;

    const walletRows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

    const wallet = walletRows[0];
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    const remainingBalance = plan.currentBalance - amount;

    await tx.savingsPlan.update({
      where: { id: plan.id },
      data: {
        currentBalance: remainingBalance,
        status: remainingBalance === 0n ? "WITHDRAWN" : "ACTIVE",
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: payout } },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        savingsPlanId: plan.id,
        type: "SAVINGS_WITHDRAWAL",
        amount: payout,
        status: "SUCCESS",
        providerReference: `savwithdraw_${randomUUID()}`,
      },
    });

    return { payout, penalty };
  });
};
