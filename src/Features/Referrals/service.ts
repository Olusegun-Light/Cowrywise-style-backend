import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import { randomUUID } from "crypto";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // excludes 0/O/1/I/L to avoid ambiguity

const generateCode = () => {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }

  return code;
};

export const generateUniqueReferralCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
    });
    if (!existing) {
      return code;
    }
  }

  throw new AppError(
    "Could not generate a unique referral code, please try again",
    500,
  );
};

export const REFERRAL_BONUS_KOBO = 50000n; // NGN 500

export const rewardReferralIfFirstFunding = async (walletId: string) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });

    if (!wallet) {
      return;
    }

    const referralRows = await tx.$queryRaw<
      { id: string; referrerId: string; status: string }[]
    >`SELECT id, "referrerId", status FROM "Referral" WHERE "referredId" = ${wallet.userId} FOR UPDATE`;

    const referral = referralRows[0];
    if (!referral || referral.status === "REWARDED") {
      return;
    }

    const fundingCount = await tx.transaction.count({
      where: { walletId: wallet.id, type: "FUNDING", status: "SUCCESS" },
    });
    if (fundingCount !== 1) {
      return;
    }

    const referrerWallet = await tx.wallet.findUnique({
      where: { userId: referral.referrerId },
    });
    if (!referrerWallet) {
      return;
    }

    await tx.wallet.update({
      where: { id: referrerWallet.id },
      data: { balance: { increment: REFERRAL_BONUS_KOBO } },
    });

    await tx.transaction.create({
      data: {
        walletId: referrerWallet.id,
        type: "REFERRAL_BONUS",
        amount: REFERRAL_BONUS_KOBO,
        status: "SUCCESS",
        providerReference: `refbonus_referrer_${randomUUID()}`,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: REFERRAL_BONUS_KOBO } },
    });
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "REFERRAL_BONUS",
        amount: REFERRAL_BONUS_KOBO,
        status: "SUCCESS",
        providerReference: `refbonus_referred_${randomUUID()}`,
      },
    });

    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: "REWARDED",
        rewardAmount: REFERRAL_BONUS_KOBO,
        rewardedAt: new Date(),
      },
    });
  });
};

export const getMyReferralSummary = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    include: {
      referred: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalRewarded = referrals
    .filter((r) => r.status === "REWARDED")
    .reduce((sum, r) => sum + (r.rewardAmount ?? 0n), 0n);

  return {
    referralCode: user.referralCode,
    totalReferred: referrals.length,
    totalRewarded,
    referrals,
  };
};
