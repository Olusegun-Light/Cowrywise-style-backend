import prisma from "../../src/Config/db";

export const seedFunds = async () => {
  await prisma.fund.createMany({
    data: [
      {
        name: "ARM Money Market Fund",
        manager: "ARM Investment Managers",
        category: "MONEY_MARKET",
        navPerUnit: "100.0000",
      },
      {
        name: "United Capital Fixed Income Fund",
        manager: "United Capital Asset Management",
        category: "FIXED_INCOME",
        navPerUnit: "150.0000",
      },
      {
        name: "Meristem Equity Growth Fund",
        manager: "Meristem Wealth Management",
        category: "EQUITY",
        navPerUnit: "1200.5000",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded funds");

  return prisma.fund.findMany({ orderBy: { createdAt: "asc" } });
};
