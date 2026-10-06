import * as investmentsService from "../../src/Features/Investments/service";

export const seedInvestments = async (adaId: string, fundId: string) => {
  await investmentsService.buyFundUnits(adaId, fundId, 150_000n);

  console.log("Seeded one fund purchase");
};
