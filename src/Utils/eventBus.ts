import { channelWrapper, EXCHANGE } from "../Config/rabbitmq";

const PUBLISH_TIMEOUT_MS = 5_000;

export const publishEvent = async (
  routingKey: string,
  payload: Record<string, unknown>,
) => {
  let timer: NodeJS.Timeout;
  try {
    await Promise.race([
      channelWrapper.publish(EXCHANGE, routingKey, payload, {
        persistent: true,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `publishEvent timed out after ${PUBLISH_TIMEOUT_MS}ms (routingKey=${routingKey})`,
              ),
            ),
          PUBLISH_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
};
