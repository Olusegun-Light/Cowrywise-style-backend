import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),
  RESET_PASSWORD_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  PAYSTACK_SECRET_KEY: z.string().min(1, "Paystack secret key is required"),
  MAILTRAP_HOST: z.string().min(1),
  MAILTRAP_PORT: z.coerce.number().int().positive(),
  MAILTRAP_USER: z.string().min(1),
  MAILTRAP_PASS: z.string().min(1),
  MAIL_FROM: z.string().min(1).default("Cowrywise <noreply@cowrywise.test>"),
  ALLOWED_ORIGINS: z.string().min(1).default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  );
  process.exit(1);
}

export const env = parsed.data;
