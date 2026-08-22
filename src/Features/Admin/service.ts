import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import type { KycStatus } from "../../generated/prisma/client";
import * as notificationsService from "../Notifications/service";

export const listPendingKyc = () =>
  prisma.user.findMany({
    where: { kycStatus: "PENDING" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      kycSubmittedAt: true,
    },
    orderBy: { kycSubmittedAt: "asc" },
  });

export const approveKyc = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (user.kycStatus !== "PENDING") {
    throw new AppError("KYC submission is not pending review", 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: "APPROVED",
      kycReviewedAt: new Date(),
      kycRejectionReason: null,
    },
    select: { id: true, kycStatus: true, kycReviewedAt: true },
  });

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

  return updated;
};

export const rejectKyc = async (userId: string, reason: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (user.kycStatus !== "PENDING") {
    throw new AppError("KYC submission is not pending review", 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: "REJECTED",
      kycReviewedAt: new Date(),
      kycRejectionReason: reason,
    },
    select: {
      id: true,
      kycStatus: true,
      kycReviewedAt: true,
      kycRejectionReason: true,
    },
  });

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

  return updated;
};
export const listUsers = async (
  page: number,
  limit: number,
  filters: { isActive?: boolean; kycStatus?: KycStatus },
) => {
  const where = {
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.kycStatus !== undefined
      ? { kycStatus: filters.kycStatus }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        kycStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
};

export const freezeUser = async (userId: string, adminUserId: string) => {
  if (userId === adminUserId) {
    throw new AppError("You cannot freeze your own account", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (!user.isActive) {
    throw new AppError("User is already frozen", 400);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
};

export const unfreezeUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (user.isActive) {
    throw new AppError("User is not frozen", 400);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
    select: { id: true, isActive: true },
  });
};

export const getAdminStats = async () => {
  const [
    totalUsers,
    activeUsers,
    kycGroups,
    walletAgg,
    transactionGroups,
    savingsGroups,
    savingsActiveBalanceAgg,
    circleGroups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.groupBy({ by: ["kycStatus"], _count: { _all: true } }),
    prisma.wallet.aggregate({
      _count: { _all: true },
      _sum: { balance: true },
    }),
    prisma.transaction.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.savingsPlan.groupBy({ by: ["status"], _count: { _all: true } }),

    prisma.savingsPlan.aggregate({
      where: { status: "ACTIVE" },
      _sum: { currentBalance: true },
    }),
    prisma.circle.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const kycByStatus = Object.fromEntries(
    kycGroups.map((g) => [g.kycStatus, g._count._all]),
  );
  const transactionsByType = Object.fromEntries(
    transactionGroups.map((g) => [g.type, g._count._all]),
  );
  const savingsByStatus = Object.fromEntries(
    savingsGroups.map((g) => [g.status, g._count._all]),
  );
  const circlesByStatus = Object.fromEntries(
    circleGroups.map((g) => [g.status, g._count._all]),
  );

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      frozen: totalUsers - activeUsers,
      kycByStatus,
    },
    wallets: {
      totalWallets: walletAgg._count._all,
      totalBalance: walletAgg._sum.balance ?? 0n,
    },
    transactions: {
      totalCount: transactionGroups.reduce((sum, g) => sum + g._count._all, 0),
      byType: transactionsByType,
    },
    savingsPlans: {
      byStatus: savingsByStatus,
      totalActiveBalance: savingsActiveBalanceAgg._sum.currentBalance ?? 0n,
    },
    circles: {
      byStatus: circlesByStatus,
    },
  };
};
