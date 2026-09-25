import { channelWrapper, EXCHANGE } from "../Config/rabbitmq";

const PUBLISH_TIMEOUT_MS = 5_000;

export const publishEvent = async (
  routingKey: string,
  payload: Record<string, unknown>,
) => {
  await channelWrapper.publish(EXCHANGE, routingKey, payload, {
    persistent: true,
    timeout: PUBLISH_TIMEOUT_MS,
  });
};
