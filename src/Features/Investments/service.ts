import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import { Prisma } from "../../generated/prisma/client";

export const listActiveFunds = () =>
  prisma.fund.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

export const getFundById = async (fundId: string) => {
  const fund = await prisma.fund.findUnique({ where: { id: fundId } });

  if (!fund) {
    throw new AppError("Fund not found", 404);
  }

  return fund;
};

export const updateFundNav = async (fundId: string, navPerUnit: number) => {
  return prisma.$transaction(async (tx) => {
    const fund = await tx.fund.findUnique({ where: { id: fundId } });
    if (!fund) {
      throw new AppError("Fund not found", 404);
    }

    const updated = await tx.fund.update({
      where: { id: fundId },
      data: { navPerUnit },
    });

    await tx.fundNavHistory.create({
      data: { fundId, navPerUnit },
    });

    return updated;
  });
};

export const buyFundUnits = async (
  userId: string,
  fundId: string,
  amountKobo: bigint,
) => {
  return prisma.$transaction(async (tx) => {
    const walletRows = await tx.$queryRaw<
      { id: string; balance: bigint }[]
    >`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

    const wallet = walletRows[0];
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    if (wallet.balance < amountKobo) {
      throw new AppError("Insufficient wallet balance", 400);
    }

    const fundRows = await tx.$queryRaw<
      { id: string; navPerUnit: Prisma.Decimal; isActive: boolean }[]
    >`SELECT id, "navPerUnit", "isActive" FROM "Fund" WHERE id = ${fundId} FOR UPDATE`;

    const fund = fundRows[0];
    if (!fund) {
      throw new AppError("Fund not found", 404);
    }
    if (!fund.isActive) {
      throw new AppError("Fund is not active", 400);
    }

    const navPerUnit = new Prisma.Decimal(fund.navPerUnit);
    const units = new Prisma.Decimal(amountKobo.toString()).dividedBy(
      navPerUnit,
    );

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amountKobo } },
    });

    await tx.fundHolding.upsert({
      where: { userId_fundId: { userId, fundId } },
      create: { userId, fundId, units },
      update: { units: { increment: units } },
    });

    await tx.fundTransaction.create({
      data: {
        userId,
        fundId,
        type: "BUY",
        amount: amountKobo,
        units,
        navPerUnit,
      },
    });

    return { units, navPerUnit };
  });
};

export const redeemFundUnits = async (
  userId: string,
  fundId: string,
  unitsString: string,
) => {
  const unitsToRedeem = new Prisma.Decimal(unitsString);

  if (unitsToRedeem.lessThanOrEqualTo(0)) {
    throw new AppError("units must be greater than 0", 400);
  }

  return prisma.$transaction(async (tx) => {
    const holdingRows = await tx.$queryRaw<
      { id: string; units: Prisma.Decimal }[]
    >`SELECT id, units FROM "FundHolding" WHERE "userId" = ${userId} AND "fundId" = ${fundId} FOR UPDATE`;

    const holding = holdingRows[0];
    if (!holding) {
      throw new AppError("You do not hold any units in this fund", 404);
    }

    const currentUnits = new Prisma.Decimal(holding.units);
    if (currentUnits.lessThan(unitsToRedeem)) {
      throw new AppError("Insufficient units", 400);
    }

    const fundRows = await tx.$queryRaw<
      { id: string; navPerUnit: Prisma.Decimal }[]
    >`SELECT id, "navPerUnit" FROM "Fund" WHERE id = ${fundId} FOR UPDATE`;

    const fund = fundRows[0];
    if (!fund) {
      throw new AppError("Fund not found", 404);
    }

    const navPerUnit = new Prisma.Decimal(fund.navPerUnit);
    const payoutKobo = BigInt(
      unitsToRedeem.times(navPerUnit).floor().toString(),
    );

    const walletRows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

    const wallet = walletRows[0];
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    await tx.fundHolding.update({
      where: { id: holding.id },
      data: { units: { decrement: unitsToRedeem } },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: payoutKobo } },
    });

    await tx.fundTransaction.create({
      data: {
        userId,
        fundId,
        type: "REDEEM",
        amount: payoutKobo,
        units: unitsToRedeem,
        navPerUnit,
      },
    });

    return { payoutKobo, units: unitsToRedeem, navPerUnit };
  });
};

export const listHoldingsForUser = (userId: string) =>
  prisma.fundHolding.findMany({
    where: { userId },
    include: { fund: true },
    orderBy: { createdAt: "desc" },
  });

export const getHoldingForUserAndFund = async (
  userId: string,
  fundId: string,
) => {
  const holding = await prisma.fundHolding.findUnique({
    where: { userId_fundId: { userId, fundId } },
    include: { fund: true },
  });

  if (!holding) {
    throw new AppError("You do not hold any units in this fund", 404);
  }

  return holding;
};
