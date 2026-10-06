import * as savingsService from "../../src/Features/Savings/service";
import { accrueInterestForPlan } from "../../src/Jobs/interestAccrual";

export const seedSavings = async (adaId: string) => {
  const flexPlan = await savingsService.createPlan({
    userId: adaId,
    planType: "FLEX",
    targetAmount: 300_000n,
  });
  await savingsService.fundPlanFromWallet(adaId, flexPlan.id, 150_000n);

  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  const fixedPlan = await savingsService.createPlan({
    userId: adaId,
    planType: "FIXED",
    targetAmount: 200_000n,
    maturityDate: sixMonthsFromNow,
  });
  await savingsService.fundPlanFromWallet(adaId, fixedPlan.id, 100_000n);

  // One day's interest accrual on the FLEX plan, same calculation the
  // daily cron job runs for every active plan.
  await accrueInterestForPlan(flexPlan.id, new Date());

  console.log("Seeded savings plans (FLEX, FIXED) and one interest accrual");
};
