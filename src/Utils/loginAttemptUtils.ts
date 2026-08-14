import { redisClient } from "../Config/redis";

const MAX_LOGIN_ATTEMPTS = 3;
const LOCK_TIME_SECONDS = 30 * 60;

const attemptsKey = (userId: string) => `login_attempts:${userId}`;
const lockKey = (userId: string) => `login_lock:${userId}`;

export const isAccountLocked = async (userId: string) => {
  const key = lockKey(userId);
  const locked = await redisClient.get(key);
  if (!locked) return { locked: false, ttl: 0 };
  const ttl = await redisClient.ttl(key);
  return { locked: true, ttl };
};

export const recordFailedLoginAttempt = async (userId: string) => {
  const key = attemptsKey(userId);
  const lock = lockKey(userId);
  const attempts = await redisClient.incr(key);
  if (attempts === 1) await redisClient.expire(key, LOCK_TIME_SECONDS);

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    await redisClient.setEx(lock, LOCK_TIME_SECONDS, "locked");
    await redisClient.del(key);
    return { locked: true, remainingAttempts: 0 };
  }

  return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts };
};

export const clearLoginAttempts = async (userId: string) => {
  await redisClient.del(attemptsKey(userId));
  await redisClient.del(lockKey(userId));
};
