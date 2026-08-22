import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const AuthRegistry = new OpenAPIRegistry();

export const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required").openapi({
    example: "Ada",
    description: "User's first name",
  }),
  lastName: z.string().min(1, "Last name is required").openapi({
    example: "Lovelace",
    description: "User's last name",
  }),
  email: z.string().email("Invalid email address").openapi({
    example: "ada@example.com",
    description: "User's email address",
  }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .openapi({
      example: "SecurePassword123!",
      description: "Account password, minimum 8 characters",
    }),

  referralCode: z
    .string()
    .length(8, "Referral code must be 8 characters")
    .transform((v) => v.toUpperCase())
    .optional()
    .openapi({
      example: "AB3D9F2K",
      description: "Optional referral code from an existing user",
    }),
});

const SignupSchema = AuthRegistry.register("SignupRequest", signupSchema);

AuthRegistry.registerPath({
  method: "post",
  path: "/auth/signup",
  tags: ["Auth"],
  summary: "Create a new account",
  description:
    "Creates an unverified account and sends a 4-digit OTP to the given email.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: SignupSchema } },
    },
  },
  responses: {
    201: { description: "Account created, OTP sent" },
    409: { description: "Email already in use" },
    422: { description: "Validation failed" },
  },
});

export const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address").openapi({
    example: "ada@example.com",
  }),
  otp: z.string().length(4, "OTP must be 4 digits").openapi({
    example: "1234",
  }),
});

const VerifyEmailSchema = AuthRegistry.register(
  "VerifyEmailRequest",
  verifyEmailSchema,
);

AuthRegistry.registerPath({
  method: "post",
  path: "/auth/verify-email",
  tags: ["Auth"],
  summary: "Verify signup OTP",
  description:
    "Verifies the OTP sent during signup and returns access + refresh tokens on success.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: VerifyEmailSchema } },
    },
  },
  responses: {
    200: { description: "Email verified, tokens issued" },
    400: { description: "Invalid OTP" },
    429: { description: "Too many attempts" },
  },
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").openapi({
    example: "ada@example.com",
  }),
  password: z.string().min(1, "Password is required").openapi({
    example: "SecurePassword123!",
  }),
});

const LoginSchema = AuthRegistry.register("LoginRequest", loginSchema);

AuthRegistry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: LoginSchema } },
    },
  },
  responses: {
    200: { description: "Login successful" },
    400: { description: "Invalid email or password" },
    403: { description: "Email not verified" },
    423: { description: "Account locked" },
  },
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required").openapi({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  }),
});

const RefreshTokenSchema = AuthRegistry.register(
  "RefreshTokenRequest",
  refreshTokenSchema,
);

AuthRegistry.registerPath({
  method: "post",
  path: "/auth/refresh-token",
  tags: ["Auth"],
  summary: "Get a new access token",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RefreshTokenSchema } },
    },
  },
  responses: {
    200: { description: "New access token issued" },
    401: { description: "Invalid or expired refresh token" },
  },
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").openapi({
    example: "ada@example.com",
  }),
});

const ForgotPasswordSchema = AuthRegistry.register(
  "ForgotPasswordRequest",
  forgotPasswordSchema,
);

AuthRegistry.registerPath({
  method: "post",
  path: "/auth/forgot-password",
  tags: ["Auth"],
  summary: "Request a password reset OTP",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ForgotPasswordSchema } },
    },
  },
  responses: {
    200: { description: "OTP sent if the email exists" },
    429: { description: "Too many OTP requests" },
  },
});

export const verifyResetOtpSchema = z.object({
  email: z.string().email("Invalid email address").openapi({
    example: "ada@example.com",
  }),
  otp: z.string().length(4, "OTP must be 4 digits").openapi({
    example: "1234",
  }),
});

const VerifyResetOtpSchema = AuthRegistry.register(
  "VerifyResetOtpRequest",
  verifyResetOtpSchema,
);

AuthRegistry.registerPath({
  method: "post",
  path: "/auth/forgot-password/verify",
  tags: ["Auth"],
  summary: "Verify password-reset OTP",
  description: "Returns a short-lived reset token on success.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: VerifyResetOtpSchema } },
    },
  },
  responses: {
    200: { description: "OTP verified, reset token issued" },
    400: { description: "Invalid OTP" },
    429: { description: "Too many attempts" },
  },
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required").openapi({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  }),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .openapi({
      example: "NewSecurePassword123!",
    }),
});

const ResetPasswordSchema = AuthRegistry.register(
  "ResetPasswordRequest",
  resetPasswordSchema,
);

AuthRegistry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  tags: ["Auth"],
  summary: "Reset password using a verified reset token",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ResetPasswordSchema } },
    },
  },
  responses: {
    200: { description: "Password reset successfully" },
    400: { description: "Invalid or expired reset token" },
  },
});
