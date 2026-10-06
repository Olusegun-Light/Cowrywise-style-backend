import prisma from "../../src/Config/db";
import { RoleEnum } from "../../src/Utils/roles";
import * as authService from "../../src/Features/Auth/service";
import * as kycService from "../../src/Features/Kyc/service";
import * as adminService from "../../src/Features/Admin/service";

const SEED_PASSWORD = "Password123!";

export const seedUsers = async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleEnum.ADMIN },
  });

  const admin = await authService.createUser({
    firstName: "Admin",
    lastName: "User",
    email: "admin@cowrywise.test",
    password: SEED_PASSWORD,
  });
  await authService.markEmailVerified(admin.id);
  await prisma.user.update({
    where: { id: admin.id },
    data: { roleId: adminRole.id },
  });

  const ada = await authService.createUser({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@cowrywise.test",
    password: SEED_PASSWORD,
  });
  await authService.markEmailVerified(ada.id);

  const grace = await authService.createUser({
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@cowrywise.test",
    password: SEED_PASSWORD,
    referralCode: ada.referralCode,
  });
  await authService.markEmailVerified(grace.id);

  const alan = await authService.createUser({
    firstName: "Alan",
    lastName: "Turing",
    email: "alan@cowrywise.test",
    password: SEED_PASSWORD,
  });
  await authService.markEmailVerified(alan.id);

  const marie = await authService.createUser({
    firstName: "Marie",
    lastName: "Curie",
    email: "marie@cowrywise.test",
    password: SEED_PASSWORD,
  });
  await authService.markEmailVerified(marie.id);

  // Ada: KYC submitted and approved by the admin — demonstrates a cleared user.
  await kycService.submitKyc(ada.id, "22212345678", "12345678901");
  await adminService.approveKyc(ada.id, admin.id);

  // Alan: KYC submitted, left pending — sits in the admin's review queue.
  await kycService.submitKyc(alan.id, "22298765432", "10987654321");

  // Marie: no KYC submitted at all — a brand-new, untouched account.

  console.log("Seeded users (admin, ada, grace, alan, marie)");

  return { admin, ada, grace, alan, marie };
};
