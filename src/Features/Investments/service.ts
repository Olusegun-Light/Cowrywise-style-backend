import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";

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
