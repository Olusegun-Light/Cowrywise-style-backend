import { createClient } from "redis";
import { env } from "./env";
import { logger } from "../Utils/logger";

export const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on("error", (err) => logger.error({ err }, "Redis Client Error"));

export const startRedisClient = async () => {
  await redisClient.connect();
  logger.info("Redis is connected");
};

export const getBullMQConnection = () => {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
  };
};
