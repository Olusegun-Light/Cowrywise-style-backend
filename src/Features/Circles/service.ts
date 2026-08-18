import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import type {
  CircleStatus,
  RecurringFrequency,
} from "../../generated/prisma/client";
import { randomUUID } from "crypto";

export const createCircle = async (params: {
  creatorId: string;
  name: string;
  contributionAmount: bigint;
  frequency: RecurringFrequency;
  maxMembers: number;
}) => {
  const { creatorId, name, contributionAmount, frequency, maxMembers } = params;

  return prisma.$transaction(async (tx) => {
    const circle = await tx.circle.create({
      data: { name, creatorId, contributionAmount, frequency, maxMembers },
    });

    await tx.circleMember.create({
      data: { circleId: circle.id, userId: creatorId, position: 1 },
    });

    return circle;
  });
};

export const joinCircle = async (circleId: string, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const circleRows = await tx.$queryRaw<
      { id: string; status: CircleStatus; maxMembers: number }[]
    >`SELECT id, status, "maxMembers" FROM "Circle" WHERE id = ${circleId} FOR UPDATE`;

    const circle = circleRows[0];
    if (!circle) {
      throw new AppError("Circle not found", 404);
    }

    if (circle.status !== "PENDING") {
      throw new AppError("Circle is not open for new members", 400);
    }

    const existingMember = await tx.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    if (existingMember) {
      throw new AppError("You are already a member of this circle", 400);
    }

    const memberCount = await tx.circleMember.count({ where: { circleId } });

    if (memberCount >= circle.maxMembers) {
      throw new AppError("Circle is full", 400);
    }

    const position = memberCount + 1;

    const member = await tx.circleMember.create({
      data: { circleId, userId, position },
    });

    if (position === circle.maxMembers) {
      await tx.circle.update({
        where: { id: circleId },
        data: { status: "ACTIVE" },
      });
    }

    return member;
  });
};

export const contributeToCircle = async (circleId: string, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const circleRows = await tx.$queryRaw<
      {
        id: string;
        status: CircleStatus;
        maxMembers: number;
        contributionAmount: bigint;
        currentRound: number;
      }[]
    >`SELECT id, status, "maxMembers", "contributionAmount", "currentRound" FROM "Circle" WHERE id = ${circleId} FOR UPDATE`;

    const circle = circleRows[0];
    if (!circle) {
      throw new AppError("Circle not found", 404);
    }
    if (circle.status !== "ACTIVE") {
      throw new AppError("Circle is not active", 400);
    }

    const member = await tx.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    if (!member) {
      throw new AppError("You are not a member of this circle", 403);
    }

    const existingContribution = await tx.circleContribution.findUnique({
      where: {
        circleId_userId_round: {
          circleId,
          userId,
          round: circle.currentRound,
        },
      },
    });
    if (existingContribution) {
      throw new AppError("You have already contributed for this round", 400);
    }

    const walletRows = await tx.$queryRaw<
      { id: string; balance: bigint }[]
    >`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

    const wallet = walletRows[0];
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }
    if (wallet.balance < circle.contributionAmount) {
      throw new AppError("Insufficient wallet balance", 400);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: circle.contributionAmount } },
    });

    await tx.circleContribution.create({
      data: {
        circleId,
        userId,
        round: circle.currentRound,
        amount: circle.contributionAmount,
      },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        circleId,
        type: "CIRCLE_CONTRIBUTION",
        amount: -circle.contributionAmount,
        status: "SUCCESS",
        providerReference: `circlecontrib_${randomUUID()}`,
      },
    });

    const contributionsThisRound = await tx.circleContribution.count({
      where: { circleId, round: circle.currentRound },
    });

    let payoutTriggered = false;

    if (contributionsThisRound === circle.maxMembers) {
      payoutTriggered = true;

      const recipient = await tx.circleMember.findUnique({
        where: {
          circleId_position: { circleId, position: circle.currentRound },
        },
      });
      if (!recipient) {
        throw new AppError("Circle payout recipient not found", 500);
      }

      const payoutAmount =
        circle.contributionAmount * BigInt(circle.maxMembers);

      const recipientWalletRows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Wallet" WHERE "userId" = ${recipient.userId} FOR UPDATE`;

      const recipientWallet = recipientWalletRows[0];
      if (!recipientWallet) {
        throw new AppError("Recipient wallet not found", 404);
      }

      await tx.wallet.update({
        where: { id: recipientWallet.id },
        data: { balance: { increment: payoutAmount } },
      });

      await tx.circleMember.update({
        where: { id: recipient.id },
        data: { hasReceivedPayout: true },
      });

      await tx.transaction.create({
        data: {
          walletId: recipientWallet.id,
          circleId,
          type: "CIRCLE_PAYOUT",
          amount: payoutAmount,
          status: "SUCCESS",
          providerReference: `circlepayout_${randomUUID()}`,
        },
      });

      const isFinalRound = circle.currentRound === circle.maxMembers;

      await tx.circle.update({
        where: { id: circleId },
        data: isFinalRound
          ? { status: "COMPLETED" }
          : { currentRound: { increment: 1 } },
      });
    }

    return { payoutTriggered };
  });
};

export const listCirclesForUser = (userId: string) =>
  prisma.circle.findMany({
    where: { members: { some: { userId } } },
    include: { members: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

export const getCircleByIdForUser = async (
  userId: string,
  circleId: string,
) => {
  const membership = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
  });
  if (!membership) {
    throw new AppError("Circle not found", 404);
  }

  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    include: { members: { orderBy: { position: "asc" } } },
  });
  if (!circle) {
    throw new AppError("Circle not found", 404);
  }

  return circle;
};

export const listContributionsForCircle = async (
  userId: string,
  circleId: string,
) => {
  const membership = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
  });
  if (!membership) {
    throw new AppError("Circle not found", 404);
  }

  return prisma.circleContribution.findMany({
    where: { circleId },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
  });
};
