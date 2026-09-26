import amqp, { type ChannelWrapper } from "amqp-connection-manager";
import type { ConfirmChannel } from "amqplib";
import { env } from "./env";
import { logger } from "../Utils/logger";

export const EXCHANGE = "cowrywise.events";
export const DEAD_LETTER_EXCHANGE = "cowrywise.events.dlx";
export const NOTIFICATIONS_QUEUE = "notifications.events";
export const NOTIFICATIONS_DLQ = "notifications.events.dlq";
export const NOTIFICATION_ROUTING_KEYS = [
  "circle.payout",
  "kyc.approved",
  "kyc.rejected",
] as const;

export const SEARCH_USERS_QUEUE = "search.users.events";
export const SEARCH_USERS_DLQ = "search.users.events.dlq";
export const SEARCH_ROUTING_KEYS = ["search.user.upsert"] as const;

const CONNECT_TIMEOUT_MS = 10_000;

const connection = amqp.connect([env.RABBITMQ_URL]);

connection.on("connectFailed", (err) =>
  logger.error({ err }, "RabbitMQ connection attempt failed"),
);
connection.on("disconnect", ({ err }) =>
  logger.warn({ err }, "RabbitMQ disconnected — will keep retrying"),
);

connection.on("connect", () => logger.info("RabbitMQ (re)connected"));

export const channelWrapper: ChannelWrapper = connection.createChannel({
  json: true,
  setup: async (channel: ConfirmChannel) => {
    await channel.assertExchange(EXCHANGE, "topic", { durable: true });
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, "fanout", {
      durable: true,
    });

    await channel.assertQueue(NOTIFICATIONS_DLQ, { durable: true });
    await channel.bindQueue(NOTIFICATIONS_DLQ, DEAD_LETTER_EXCHANGE, "");

    await channel.assertQueue(NOTIFICATIONS_QUEUE, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE },
    });

    for (const key of NOTIFICATION_ROUTING_KEYS) {
      await channel.bindQueue(NOTIFICATIONS_QUEUE, EXCHANGE, key);
    }

    await channel.assertQueue(SEARCH_USERS_DLQ, { durable: true });
    await channel.bindQueue(SEARCH_USERS_DLQ, DEAD_LETTER_EXCHANGE, "");

    await channel.assertQueue(SEARCH_USERS_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
      },
    });

    for (const key of SEARCH_ROUTING_KEYS) {
      await channel.bindQueue(SEARCH_USERS_QUEUE, EXCHANGE, key);
    }
  },
});

export const startRabbitMQ = async () => {
  try {
    await Promise.race([
      channelWrapper.waitForConnect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("RabbitMQ connect timed out")),
          CONNECT_TIMEOUT_MS,
        ),
      ),
    ]);
    logger.info("RabbitMQ is connected");
  } catch (err) {
    logger.error(
      { err },
      "RabbitMQ did not connect within the timeout — continuing startup without it; publishing/consuming will keep retrying in the background",
    );
  }
};
