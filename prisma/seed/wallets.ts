import { randomUUID } from "crypto";
import prisma from "../../src/Config/db";
import * as referralsService from "../../src/Features/Referrals/service";

const fundWallet = async (userId: string, amountKobo: bigint) => {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: amountKobo } },
  });

  await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      type: "FUNDING",
      amount: amountKobo,
      status: "SUCCESS",
      providerReference: `seed_fund_${randomUUID()}`,
    },
  });

  return wallet;
};

export const seedWallets = async (adaId: string, graceId: string) => {
  await fundWallet(adaId, 500_000n);
  const graceWallet = await fundWallet(graceId, 300_000n);

  // Grace's first successful funding — pays out the referral bonus to both
  // Grace (referred) and Ada (referrer), same as the real funding webhook does.
  await referralsService.rewardReferralIfFirstFunding(graceWallet.id);

  console.log("Seeded wallet funding and referral reward");
};
