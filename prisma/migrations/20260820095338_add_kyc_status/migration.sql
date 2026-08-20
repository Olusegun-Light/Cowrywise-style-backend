-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kycRejectionReason" TEXT,
ADD COLUMN     "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3);
