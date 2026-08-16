-- CreateEnum
CREATE TYPE "SavingsPlanType" AS ENUM ('FLEX', 'FIXED', 'RECURRING');

-- CreateEnum
CREATE TYPE "SavingsPlanStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'SAVINGS_FUNDING';
ALTER TYPE "TransactionType" ADD VALUE 'SAVINGS_WITHDRAWAL';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "savingsPlanId" TEXT;

-- CreateTable
CREATE TABLE "SavingsPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planType" "SavingsPlanType" NOT NULL,
    "targetAmount" BIGINT NOT NULL,
    "currentBalance" BIGINT NOT NULL DEFAULT 0,
    "maturityDate" TIMESTAMP(3),
    "frequency" "RecurringFrequency",
    "status" "SavingsPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastAccruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestAccrual" (
    "id" TEXT NOT NULL,
    "savingsPlanId" TEXT NOT NULL,
    "accrualDate" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterestAccrual_savingsPlanId_accrualDate_key" ON "InterestAccrual"("savingsPlanId", "accrualDate");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_savingsPlanId_fkey" FOREIGN KEY ("savingsPlanId") REFERENCES "SavingsPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsPlan" ADD CONSTRAINT "SavingsPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestAccrual" ADD CONSTRAINT "InterestAccrual_savingsPlanId_fkey" FOREIGN KEY ("savingsPlanId") REFERENCES "SavingsPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
