-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'INVESTMENT_BUY';
ALTER TYPE "TransactionType" ADD VALUE 'INVESTMENT_REDEEM';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "fundId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
