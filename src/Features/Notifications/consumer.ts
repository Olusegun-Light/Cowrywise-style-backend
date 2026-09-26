import type { ConfirmChannel, ConsumeMessage } from "amqplib";
import { channelWrapper, NOTIFICATIONS_QUEUE } from "../../Config/rabbitmq";
import { logger } from "../../Utils/logger";
import { rabbitmqConsumeDuration } from "../../Utils/metrics";
import * as notificationsService from "./service";

type CirclePayoutEvent = { userId: string; circleId: string; round: number };
type KycApprovedEvent = { userId: string };
type KycRejectedEvent = { userId: string; reason: string };

export const handleMessage = async (
  routingKey: string,
  payload: unknown,
): Promise<void> => {
  switch (routingKey) {
    case "circle.payout": {
      const { userId } = payload as CirclePayoutEvent;
      await notificationsService.createNotification(
        userId,
        "CIRCLE",
        "Circle payout received",
        "Your circle round has completed and the payout has been credited to your wallet.",
      );
      return;
    }

    case "kyc.approved": {
      const { userId } = payload as KycApprovedEvent;
      await notificationsService.createNotification(
        userId,
        "KYC",
        "KYC approved",
        "Your identity verification has been approved.",
      );
      return;
    }

    case "kyc.rejected": {
      const { userId, reason } = payload as KycRejectedEvent;
      await notificationsService.createNotification(
        userId,
        "KYC",
        "KYC rejected",
        `Your identity verification was rejected: ${reason}`,
      );
      return;
    }

    default:
      logger.warn(
        { routingKey },
        "Unrecognized notification event routing key — acking without action",
      );
      return;
  }
};

export const startNotificationEventConsumer = async () => {
  await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
    await channel.consume(
      NOTIFICATIONS_QUEUE,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;
        const start = process.hrtime.bigint();
        try {
          const payload = JSON.parse(msg.content.toString());
          await handleMessage(msg.fields.routingKey, payload);
          rabbitmqConsumeDuration.observe(
            { routing_key: msg.fields.routingKey, status: "success" },
            Number(process.hrtime.bigint() - start) / 1e9,
          );
          channel.ack(msg);
        } catch (err) {
          logger.error(
            { err, routingKey: msg.fields.routingKey },
            "Failed to process notification event — dead-lettering",
          );
          channel.nack(msg, false, false);
          rabbitmqConsumeDuration.observe(
            { routing_key: msg.fields.routingKey, status: "failure" },
            Number(process.hrtime.bigint() - start) / 1e9,
          );
        }
      },
      { noAck: false },
    );
  });
  logger.info("Notification event consumer started");
};
