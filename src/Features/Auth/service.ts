import argon2 from "argon2";
import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import { generateUniqueReferralCode } from "../Referrals/service";

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email } });

interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  referralCode?: string;
}

export const createUser = async (input: CreateUserInput) => {
  const passwordHash = await argon2.hash(input.password);

  let referrerId: string | null = null;
  if (input.referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: input.referralCode },
      select: { id: true },
    });
    if (!referrer) {
      throw new AppError("Invalid referral code", 400);
    }
    referrerId = referrer.id;
  }

  const referralCode = await generateUniqueReferralCode();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        referralCode,
        wallet: {
          create: {},
        },
      },
    });

    if (referrerId) {
      await tx.referral.create({
        data: { referrerId, referredId: user.id },
      });
    }

    return user;
  });
};

export const markEmailVerified = (userId: string) =>
  prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });

export const updatePassword = async (userId: string, newPassword: string) => {
  const passwordHash = await argon2.hash(newPassword);

  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
};

interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
}

export const toPublicUser = (user: UserRecord) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  emailVerified: user.emailVerified,
});
