import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";

export const submitKyc = async (userId: string, bvn: string, nin: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.kycStatus === "PENDING") {
    throw new AppError("KYC submission already pending review", 400);
  }

  if (user.kycStatus === "APPROVED") {
    throw new AppError("KYC already approved", 400);
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      bvn,
      nin,
      kycStatus: "PENDING",
      kycSubmittedAt: new Date(),
      kycRejectionReason: null,
    },
    select: {
      kycStatus: true,
      kycSubmittedAt: true,
    },
  });
};

export const getKycStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      kycStatus: true,
      kycSubmittedAt: true,
      kycReviewedAt: true,
      kycRejectionReason: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};
