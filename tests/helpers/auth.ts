import prisma from "../../src/Config/db";
import { RoleEnum } from "../../src/Utils/roles";

import request from "supertest";
import app from "../../src/app";
import * as mailer from "../../src/Utils/mailer";

interface SignupOverrides {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}

export const signupAndLogin = async (overrides: SignupOverrides = {}) => {
  const user = {
    firstName: "Test",
    lastName: "User",
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: "TestPass123!",
    ...overrides,
  };

  await request(app).post("/api/v1/auth/signup").send(user).expect(201);

  const sendSignupOtpEmailMock = mailer.sendSignupOtpEmail as jest.Mock;
  const lastCall =
    sendSignupOtpEmailMock.mock.calls[
      sendSignupOtpEmailMock.mock.calls.length - 1
    ];
  const otp = lastCall[0].otp;

  const verifyRes = await request(app)
    .post("/api/v1/auth/verify-email")
    .send({ email: user.email, otp })
    .expect(200);

  return {
    user,
    userId: verifyRes.body.data.user.id as string,
    accessToken: verifyRes.body.data.accessToken as string,
    refreshToken: verifyRes.body.data.refreshToken as string,
  };
};

export const signupAdminAndLogin = async (overrides: SignupOverrides = {}) => {
  const result = await signupAndLogin(overrides);

  const adminRole = await prisma.role.upsert({
    where: { name: RoleEnum.ADMIN },
    update: {},
    create: { name: RoleEnum.ADMIN, description: "Full administrative access" },
  });

  await prisma.user.update({
    where: { id: result.userId },
    data: { roleId: adminRole.id },
  });

  return result;
};
