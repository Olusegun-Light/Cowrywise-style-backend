import { createClient } from "redis";
import { env } from "./env";

export const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on("error", (err) => console.error("Redis Client Error", err));

export const startRedisClient = async () => {
  await redisClient.connect();
  console.log("Redis is connected");
};
