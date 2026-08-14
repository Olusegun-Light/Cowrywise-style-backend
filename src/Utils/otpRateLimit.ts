import { redisClient } from "../Config/redis";

const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_TIME_SECONDS = 2 * 60;
const OTP_ATTEMPT_WINDOW_SECONDS = 15 * 60;
const OTP_GENERATION_MAX_ATTEMPTS = 3;
const OTP_GENERATION_LOCK_TIME_SECONDS = 10 * 60;
const OTP_GENERATION_WINDOW_SECONDS = 10 * 60;

const normalize = (identifier: string) => identifier.trim().toLowerCase();

const attemptsKey = (scope: string, id: string) =>
  `otp_attempts:${scope}:${normalize(id)}`;

const lockKey = (scope: string, id: string) =>
  `otp_lock:${scope}:${normalize(id)}`;

const genAttemptsKey = (scope: string, id: string) =>
  `otp_generation_attempts:${scope}:${normalize(id)}`;

const genLockKey = (scope: string, id: string) =>
  `otp_generation_lock:${scope}:${normalize(id)}`;

export const checkOtpGenerationLock = async (
  scope: string,
  identifier: string,
) => {
  const key = genLockKey(scope, identifier);
  const isLocked = await redisClient.get(key);

  if (!isLocked) return { isLocked: false, retryAfter: 0 };

  const ttl = await redisClient.ttl(key);

  return {
    isLocked: true,
    retryAfter: ttl > 0 ? ttl : OTP_GENERATION_LOCK_TIME_SECONDS,
  };
};

export const recordOtpGenerationAttempt = async (
  scope: string,
  identifier: string,
) => {
  const key = genAttemptsKey(scope, identifier);
  const lock = genLockKey(scope, identifier);
  const attempts = await redisClient.incr(key);
  if (attempts === 1)
    await redisClient.expire(key, OTP_GENERATION_WINDOW_SECONDS);

  if (attempts >= OTP_GENERATION_MAX_ATTEMPTS) {
    await redisClient.setEx(lock, OTP_GENERATION_LOCK_TIME_SECONDS, "locked");
    await redisClient.del(key);
    return { isLocked: true, attemptsLeft: 0 };
  }

  return {
    isLocked: false,
    attemptsLeft: OTP_GENERATION_MAX_ATTEMPTS - attempts,
  };
};

export const checkOtpLock = async (scope: string, identifier: string) => {
  const key = lockKey(scope, identifier);
  const isLocked = await redisClient.get(key);

  if (!isLocked) return { isLocked: false, retryAfter: 0 };

  const ttl = await redisClient.ttl(key);

  return {
    isLocked: true,
    retryAfter: ttl > 0 ? ttl : OTP_LOCK_TIME_SECONDS,
  };
};

export const recordFailedOtpAttempt = async (
  scope: string,
  identifier: string,
) => {
  const key = attemptsKey(scope, identifier);
  const lock = lockKey(scope, identifier);
  const attempts = await redisClient.incr(key);

  if (attempts === 1) await redisClient.expire(key, OTP_ATTEMPT_WINDOW_SECONDS);

  if (attempts >= OTP_MAX_ATTEMPTS) {
    await redisClient.setEx(lock, OTP_LOCK_TIME_SECONDS, "locked");
    await redisClient.del(key);
    return { isLocked: true, attemptsLeft: 0 };
  }

  return { isLocked: false, attemptsLeft: OTP_MAX_ATTEMPTS - attempts };
};

export const clearOtpAttempts = async (scope: string, identifier: string) => {
  await redisClient.del(attemptsKey(scope, identifier));
  await redisClient.del(lockKey(scope, identifier));
};
