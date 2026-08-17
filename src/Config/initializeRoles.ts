import prisma from "./db";
import { RoleEnum } from "../Utils/roles";

const DEFAULT_ROLES = [
  { name: RoleEnum.ADMIN, description: "Full administrative access" },
  { name: RoleEnum.USER, description: "Default role for individual users" },
];

export const initializeDefaultRoles = async () => {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log("Default roles initialized");
};
