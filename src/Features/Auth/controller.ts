import type { Request, Response } from "express";
import argon2 from "argon2";
import { redisClient } from "../../Config/redis";
import { env } from "../../Config/env";
import { AppError } from "../../Utils/AppError";
import { validateBody } from "../../Utils/validateBody";
import { successResponse } from "../../Utils/responseHandler";
import {
  signAccessToken,
  signRefreshToken,
  signResetPasswordToken,
  verifyToken,
} from "../../Utils/jwt";
import { generateAndStoreOtp, verifyStoredOtp } from "../../Utils/otp";
import {
  checkOtpGenerationLock,
  recordOtpGenerationAttempt,
  checkOtpLock,
  recordFailedOtpAttempt,
  clearOtpAttempts,
} from "../../Utils/otpRateLimit";
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  clearLoginAttempts,
} from "../../Utils/loginAttemptUtils";
import * as authService from "./service";
import {
  signupSchema,
  verifyEmailSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from "./validation";

import { sendSignupOtpEmail, sendResetOtpEmail } from "../../Utils/mailer";

const refreshTokenKey = (userId: string) => `refresh_token:${userId}`;

const resetTokenKey = (userId: string) => `reset_token:${userId}`;

const issueTokens = async (userId: string, email: string) => {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });

  await redisClient.setEx(
    refreshTokenKey(userId),
    env.REFRESH_TOKEN_TTL_SECONDS,
    refreshToken,
  );

  return { accessToken, refreshToken };
};

export default class AuthController {
  static async signup(req: Request, res: Response) {
    const { firstName, lastName, email, password, referralCode } = validateBody(
      signupSchema,
      req.body,
    );

    const existing = await authService.findUserByEmail(email);
    if (existing) {
      throw new AppError("Email already in use", 409);
    }

    const user = await authService.createUser({
      firstName,
      lastName,
      email,
      password,
      referralCode,
    });

    const genLock = await checkOtpGenerationLock("signup", email);
    if (genLock.isLocked) {
      throw new AppError(
        `Too many OTP requests. Try again in ${genLock.retryAfter} seconds.`,
        429,
      );
    }

    await recordOtpGenerationAttempt("signup", email);

    const otp = await generateAndStoreOtp("signup", email);
    console.log(`[DEV] Signup OTP for ${email}: ${otp}`);

    try {
      await sendSignupOtpEmail({ email, firstName: user.firstName, otp });
    } catch (err) {
      console.error("Failed to send signup OTP email:", err);
    }

    return successResponse({
      res,
      statusCode: 201,
      message: "Account created. Check your email for a verification code.",
      data: authService.toPublicUser(user),
    });
  }

  static async verifyEmail(req: Request, res: Response) {
    const { email, otp } = validateBody(verifyEmailSchema, req.body);

    const lock = await checkOtpLock("signup", email);
    if (lock.isLocked) {
      throw new AppError(
        `Too many failed attempts. Try again in ${lock.retryAfter} seconds.`,
        429,
      );
    }

    const isValid = await verifyStoredOtp("signup", email, otp);
    if (!isValid) {
      const failed = await recordFailedOtpAttempt("signup", email);
      throw new AppError(
        failed.isLocked
          ? "Too many failed attempts. You are locked out for 2 minutes."
          : `Invalid OTP. ${failed.attemptsLeft} attempt(s) left.`,
        failed.isLocked ? 429 : 400,
      );
    }
    await clearOtpAttempts("signup", email);

    const user = await authService.findUserByEmail(email);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const verifiedUser = await authService.markEmailVerified(user.id);
    const tokens = await issueTokens(verifiedUser.id, verifiedUser.email);

    return successResponse({
      res,
      message: "Email Verified",
      data: { user: authService.toPublicUser(verifiedUser), ...tokens },
    });
  }

  static async login(req: Request, res: Response) {
    const { email, password } = validateBody(loginSchema, req.body);

    const user = await authService.findUserByEmail(email);
    if (!user) {
      throw new AppError("Invalid email or password", 400);
    }

    const lockStatus = await isAccountLocked(user.id);
    if (lockStatus.locked) {
      throw new AppError(
        `Account locked. Try again in ${Math.ceil(lockStatus.ttl / 60)} minute(s).`,
        423,
      );
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      const result = await recordFailedLoginAttempt(user.id);
      throw new AppError(
        result.locked
          ? "Account locked due to multiple failed login attempts. Try again in 30 minutes."
          : `Invalid email or password. ${result.remainingAttempts} attempt(s) remaining.`,
        result.locked ? 423 : 400,
      );
    }

    if (!user.emailVerified) {
      throw new AppError("Please verify your email before logging in", 403);
    }

    if (!user.isActive) {
      throw new AppError("This account has been deactivated", 403);
    }

    await clearLoginAttempts(user.id);

    const tokens = await issueTokens(user.id, user.email);

    return successResponse({
      res,
      message: "Login successful",
      data: { user: authService.toPublicUser(user), ...tokens },
    });
  }

  static async refreshToken(req: Request, res: Response) {
    const { refreshToken } = validateBody(refreshTokenSchema, req.body);

    let payload;
    try {
      payload = verifyToken(refreshToken);
    } catch {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    if (payload.purpose !== "refresh") {
      throw new AppError("Invalid refresh token", 401);
    }

    const stored = await redisClient.get(refreshTokenKey(payload.userId));
    if (!stored || stored !== refreshToken) {
      throw new AppError("Invalid refresh token", 401);
    }

    const accessToken = signAccessToken({
      userId: payload.userId,
      email: payload.email,
    });

    return successResponse({
      res,
      message: "Token refreshed",
      data: { accessToken },
    });
  }

  static async forgotPassword(req: Request, res: Response) {
    const { email } = validateBody(forgotPasswordSchema, req.body);

    const user = await authService.findUserByEmail(email);
    if (!user) {
      // Don't reveal whether the email exists
      return successResponse({
        res,
        message: "If that email exists, a code has been sent.",
      });
    }

    const genLock = await checkOtpGenerationLock("reset_password", email);
    if (genLock.isLocked) {
      throw new AppError(
        `Too many OTP requests. Try again in ${genLock.retryAfter} seconds.`,
        429,
      );
    }

    await recordOtpGenerationAttempt("reset_password", email);

    const otp = await generateAndStoreOtp("reset_password", email);
    console.log(`[DEV] Password reset OTP for ${email}: ${otp}`);

    try {
      await sendResetOtpEmail({ email, firstName: user.firstName, otp });
    } catch (err) {
      console.error("Failed to send reset OTP email:", err);
    }

    return successResponse({
      res,
      message: "If that email exists, a code has been sent.",
    });
  }

  static async verifyResetOtp(req: Request, res: Response) {
    const { email, otp } = validateBody(verifyResetOtpSchema, req.body);

    const lock = await checkOtpLock("reset_password", email);
    if (lock.isLocked) {
      throw new AppError(
        `Too many failed attempts. Try again in ${lock.retryAfter} seconds.`,
        429,
      );
    }

    const isValid = await verifyStoredOtp("reset_password", email, otp);
    if (!isValid) {
      const failed = await recordFailedOtpAttempt("reset_password", email);
      throw new AppError(
        failed.isLocked
          ? "Too many failed attempts. You are locked out for 2 minutes."
          : `Invalid OTP. ${failed.attemptsLeft} attempt(s) left.`,
        failed.isLocked ? 429 : 400,
      );
    }

    await clearOtpAttempts("reset_password", email);

    const user = await authService.findUserByEmail(email);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const resetToken = signResetPasswordToken({
      userId: user.id,
      email: user.email,
    });

    await redisClient.setEx(
      resetTokenKey(user.id),
      env.RESET_PASSWORD_TOKEN_TTL_SECONDS,
      resetToken,
    );

    return successResponse({
      res,
      message: "OTP verified",
      data: { resetToken },
    });
  }

  static async resetPassword(req: Request, res: Response) {
    const { resetToken, newPassword } = validateBody(
      resetPasswordSchema,
      req.body,
    );

    let payload;
    try {
      payload = verifyToken(resetToken);
    } catch {
      throw new AppError("Invalid or expired reset token", 400);
    }

    if (payload.purpose !== "reset_password") {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const storedResetToken = await redisClient.get(
      resetTokenKey(payload.userId),
    );
    if (!storedResetToken || storedResetToken !== resetToken) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const user = await authService.findUserByEmail(payload.email);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await authService.updatePassword(user.id, newPassword);
    await redisClient.del(resetTokenKey(payload.userId));

    return successResponse({ res, message: "Password reset successfully" });
  }

  static async me(req: Request, res: Response) {
    const user = await authService.findUserByEmail(req.user!.email);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return successResponse({
      res,
      message: "Current user",
      data: authService.toPublicUser(user),
    });
  }
}
