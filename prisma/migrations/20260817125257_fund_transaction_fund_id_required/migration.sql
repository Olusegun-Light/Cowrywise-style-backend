/*
  Warnings:

  - Made the column `fundId` on table `FundTransaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "FundTransaction" DROP CONSTRAINT "FundTransaction_fundId_fkey";

-- AlterTable
ALTER TABLE "FundTransaction" ALTER COLUMN "fundId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
