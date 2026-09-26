import app from "./app";
import { env } from "./Config/env";
import { logger } from "./Utils/logger";
import { startRedisClient } from "./Config/redis";
import { startRabbitMQ } from "./Config/rabbitmq";
import { startElasticsearch } from "./Config/elasticsearch";
import { startNotificationEventConsumer } from "./Features/Notifications/consumer";
import { startSearchEventConsumer } from "./Features/Search/consumer";
import { startCronService } from "./Jobs";
import { initializeDefaultRoles } from "./Config/initializeRoles";

const start = async () => {
  await startRedisClient();
  await startRabbitMQ();
  await startElasticsearch();
  await startNotificationEventConsumer();
  await startSearchEventConsumer();
  await startCronService();
  await initializeDefaultRoles();

  app.listen(env.PORT, () => {
    logger.info(`Server running at http://localhost:${env.PORT}`);
  });
};

start();

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});
