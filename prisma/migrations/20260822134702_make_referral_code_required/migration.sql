/*
  Warnings:

  - Made the column `referralCode` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;
