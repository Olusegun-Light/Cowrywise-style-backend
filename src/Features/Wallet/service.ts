import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";

export const getWalletByUserId = async (userId: string) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  return wallet;
};

interface CreatePendingTransactionInput {
  walletId: string;
  type: "FUNDING" | "WITHDRAWAL";
  amount: bigint;
  reference: string;
}

export const createPendingTransaction = (
  input: CreatePendingTransactionInput,
) =>
  prisma.transaction.create({
    data: {
      walletId: input.walletId,
      type: input.type,
      amount: input.amount,
      status: "PENDING",
      providerReference: input.reference,
    },
  });

export const creditWalletForReference = async (
  reference: string,
  expectedWalletId?: string,
) => {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; walletId: string; amount: bigint; status: string }[]
    >`SELECT id, "walletId", amount, status FROM "Transaction" WHERE "providerReference" = ${reference} FOR UPDATE`;

    const transaction = rows[0];

    if (!transaction) {
      throw new AppError("Transaction not found", 404);
    }

    if (expectedWalletId && transaction.walletId !== expectedWalletId) {
      throw new AppError("Transaction not found", 404);
    }

    if (transaction.status !== "PENDING") {
      return { alreadyProcessed: true };
    }

    await tx.wallet.update({
      where: { id: transaction.walletId },
      data: { balance: { increment: transaction.amount } },
    });

    await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: "SUCCESS" },
    });

    return { alreadyProcessed: false };
  });
};

export const initiateWithdrawal = async (
  userId: string,
  amount: bigint,
  reference: string,
) => {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; balance: bigint }[]
    >`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

    const wallet = rows[0];

    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    if (wallet.balance < amount) {
      throw new AppError("Insufficient balance", 400);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "WITHDRAWAL",
        amount: -amount,
        status: "PENDING",
        providerReference: reference,
      },
    });
  });
};

export const finalizeWithdrawal = async (
  reference: string,
  succeeded: boolean,
) => {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; walletId: string; amount: bigint; status: string }[]
    >`SELECT id, "walletId", amount, status FROM "Transaction" WHERE "providerReference" = ${reference} FOR UPDATE`;

    const transaction = rows[0];

    if (!transaction) {
      throw new AppError("Transaction not found", 404);
    }

    if (transaction.status !== "PENDING") {
      return { alreadyProcessed: true };
    }

    if (succeeded) {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "SUCCESS" },
      });
    } else {
      await tx.wallet.update({
        where: { id: transaction.walletId },
        data: { balance: { increment: -transaction.amount } },
      });
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      });
    }

    return { alreadyProcessed: false };
  });
};

export const listTransactions = async (
  walletId: string,
  page: number,
  limit: number,
) => {
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { walletId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where: { walletId } }),
  ]);

  return { transactions, total, page, limit };
};
