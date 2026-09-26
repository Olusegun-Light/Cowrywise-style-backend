import app from "./app";
import { env } from "./Config/env";
import { startRedisClient } from "./Config/redis";
import { startRabbitMQ } from "./Config/rabbitmq";
import { startElasticsearch } from "./Config/elasticsearch";
import { startNotificationEventConsumer } from "./Features/Notifications/consumer";
import { startCronService } from "./Jobs";
import { initializeDefaultRoles } from "./Config/initializeRoles";

const start = async () => {
  await startRedisClient();
  await startRabbitMQ();
  await startElasticsearch();
  await startNotificationEventConsumer();
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
