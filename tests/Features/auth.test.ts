import request from "supertest";
import app from "../../src/app";
import * as mailer from "../../src/Utils/mailer";
import { signupAndLogin } from "../helpers/auth";
import { publishEvent } from "../../src/Utils/eventBus";

const sendSignupOtpEmailMock = mailer.sendSignupOtpEmail as jest.Mock;

const uniqueEmail = () =>
  `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.come`;

describe("Auth", () => {
  describe("POST /api/v1/auth/signup", () => {
    it("creates an unverified account and returns the public user shape", async () => {
      const email = uniqueEmail();

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          email,
          password: "TestPass123!",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        firstName: "Ada",
        lastName: "Lovelace",
        email,
        emailVerified: false,
      });
      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it("rejects a signup with an already registered email", async () => {
      const email = uniqueEmail();

      await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          email,
          password: "TestPass123!",
        })
        .expect(201);

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          email,
          password: "TestPass123!",
        })
        .expect(409);

      expect(res.body.message).toMatch(/already in use/i);
    });

    it("rejects a password shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          email: uniqueEmail(),
          password: "short",
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it("publishes a search index event on signup", async () => {
      const email = uniqueEmail();

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Test",
          lastName: "User",
          email,
          password: "TestPass123!",
        })
        .expect(201);

      expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
        userId: res.body.data.id,
      });
    });
  });

  describe("POST /ap1/v1/auth/verify-email", () => {
    it("verifies the correct OTP and issues tokens", async () => {
      const email = uniqueEmail();

      await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Grace",
          lastName: "Hopper",
          email,
          password: "TestPass123!",
        })
        .expect(201);

      const lastCall =
        sendSignupOtpEmailMock.mock.calls[
          sendSignupOtpEmailMock.mock.calls.length - 1
        ];
      const otp = lastCall[0].otp;

      const res = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ email, otp })
        .expect(200);

      expect(res.body.data.user.emailVerified).toBe(true);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it("rejects an incorrect OTP", async () => {
      const email = uniqueEmail();

      await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Grace",
          lastName: "Hopper",
          email,
          password: "TestPass123!",
        })
        .expect(201);

      const lastCall =
        sendSignupOtpEmailMock.mock.calls[
          sendSignupOtpEmailMock.mock.calls.length - 1
        ];
      const realOtp = lastCall[0].otp as string;
      const wrongOtp = String((parseInt(realOtp, 10) + 1) % 10000).padStart(
        4,
        "0",
      );

      const res = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ email, otp: wrongOtp })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("logs in a verified user with correct credentials", async () => {
      const { user } = await signupAndLogin();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: user.password })
        .expect(200);

      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.user.email).toBe(user.email);
    });

    it("rejects an incorrect password", async () => {
      const { user } = await signupAndLogin();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: "WrongPassword123!" })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("rejects login for an unverified account", async () => {
      const email = uniqueEmail();

      await request(app)
        .post("/api/v1/auth/signup")
        .send({
          firstName: "Not",
          lastName: "Verified",
          email,
          password: "TestPass123!",
        })
        .expect(201);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password: "TestPass123!" })
        .expect(403);

      expect(res.body.message).toMatch(/verify your email/i);
    });
  });
});
