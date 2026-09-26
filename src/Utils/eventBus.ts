import { channelWrapper, EXCHANGE } from "../Config/rabbitmq";
import { rabbitmqPublishTotal } from "./metrics";

const PUBLISH_TIMEOUT_MS = 5_000;

export const publishEvent = async (
  routingKey: string,
  payload: Record<string, unknown>,
) => {
  try {
    await channelWrapper.publish(EXCHANGE, routingKey, payload, {
      persistent: true,
      timeout: PUBLISH_TIMEOUT_MS,
    });
    rabbitmqPublishTotal.inc({ routing_key: routingKey, status: "success" });
  } catch (err) {
    rabbitmqPublishTotal.inc({ routing_key: routingKey, status: "failure" });
    throw err;
  }
};
