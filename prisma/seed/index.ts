import prisma from "../../src/Config/db";
import { initializeDefaultRoles } from "../../src/Config/initializeRoles";
import { seedUsers } from "./users";
import { seedFunds } from "./funds";
import { seedWallets } from "./wallets";
import { seedSavings } from "./savings";
import { seedInvestments } from "./investments";
import { seedCircles } from "./circles";
import { seedNotifications } from "./notifications";

const wipeSeedData = async () => {
  // Deepest dependents first — safe to rerun this script against a dirty DB.
  await prisma.$transaction([
    prisma.notificationRecipient.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.circleContribution.deleteMany(),
    prisma.circleMember.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.circle.deleteMany(),
    prisma.fundTransaction.deleteMany(),
    prisma.fundHolding.deleteMany(),
    prisma.fundNavHistory.deleteMany(),
    prisma.fund.deleteMany(),
    prisma.interestAccrual.deleteMany(),
    prisma.savingsPlan.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.referral.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Wiped existing seed data");
};

const main = async () => {
  await wipeSeedData();
  await initializeDefaultRoles();

  const { ada, grace } = await seedUsers();
  const funds = await seedFunds();
  await seedWallets(ada.id, grace.id);
  await seedSavings(ada.id);
  await seedInvestments(ada.id, funds[0]!.id);
  await seedCircles(ada.id, grace.id);
  await seedNotifications();

  console.log("\nSeeded accounts (password for all: Password123!):");
  console.log("  admin@cowrywise.test  — admin, full access");
  console.log(
    "  ada@cowrywise.test    — KYC approved, savings + investment + circle history",
  );
  console.log(
    "  grace@cowrywise.test  — KYC approved, referred by Ada, circle member",
  );
  console.log("  alan@cowrywise.test   — KYC pending review");
  console.log(
    "  marie@cowrywise.test  — brand-new account, nothing else set up",
  );

  await prisma.$disconnect();
  process.exit(0);
};

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
