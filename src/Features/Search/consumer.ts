import type { ConfirmChannel, ConsumeMessage } from "amqplib";
import { channelWrapper, SEARCH_USERS_QUEUE } from "../../Config/rabbitmq";
import { logger } from "../../Utils/logger";
import prisma from "../../Config/db";
import * as searchService from "./service";

type SearchUserUpsertEvent = { userId: string };

export const startSearchEventConsumer = async () => {
  await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
    await channel.consume(
      SEARCH_USERS_QUEUE,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(
            msg.content.toString(),
          ) as SearchUserUpsertEvent;
          const user = await prisma.user.findUniqueOrThrow({
            where: { id: payload.userId },
          });
          await searchService.indexUser(user);
          channel.ack(msg);
        } catch (err) {
          logger.error(
            { err, routingKey: msg.fields.routingKey },
            "Failed to process search event — dead-lettering",
          );
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  });
  logger.info("Search event consumer started");
};
