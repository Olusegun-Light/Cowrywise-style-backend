import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { AppError } from "../Utils/AppError";

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError("Too many requests, please try again later", 429));
  },
});

export const withdrawalRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? "unknown"),
  handler: (_req, _res, next) => {
    next(
      new AppError("Too many withdrawal attempts, please try again later", 429),
    );
  },
});
