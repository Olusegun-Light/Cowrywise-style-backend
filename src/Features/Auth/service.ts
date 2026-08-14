import argon2 from "argon2";
import prisma from "../../Config/db";

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email } });

interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export const createUser = async (input: CreateUserInput) => {
  const passwordHash = await argon2.hash(input.password);

  return prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
    },
  });
};

export const markEmailVerified = (userId: string) =>
  prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });

export const updatePassword = async (userId: string, newPassword: string) => {
  const passwordHash = await argon2.hash(newPassword);

  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
};

interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
}

export const toPublicUser = (user: UserRecord) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  emailVerified: user.emailVerified,
});
