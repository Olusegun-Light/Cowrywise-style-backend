/*
  Warnings:

  - Added the required column `recurringAmount` to the `SavingsPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SavingsPlan" ADD COLUMN     "lastRecurringDebitAt" TIMESTAMP(3),
ADD COLUMN     "recurringAmount" BIGINT NOT NULL;
