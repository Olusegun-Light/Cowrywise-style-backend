import app from "./app";
import { env } from "./Config/env";
import { startRedisClient } from "./Config/redis";
import { startCronService } from "./Jobs";
import { initializeDefaultRoles } from "./Config/initializeRoles";

const start = async () => {
  await startRedisClient();
  await startCronService();
  await initializeDefaultRoles();

  app.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
  });
};

start();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
