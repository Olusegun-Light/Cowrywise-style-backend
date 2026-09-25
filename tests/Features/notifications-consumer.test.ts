jest.mock("../../src/Features/Notifications/service");

jest.mock("../../src/Config/rabbitmq", () => ({
  channelWrapper: { addSetup: jest.fn() },
  NOTIFICATIONS_QUEUE: "notifications.events",
}));

import {
  handleMessage,
  startNotificationEventConsumer,
} from "../../src/Features/Notifications/consumer";
import * as notificationsService from "../../src/Features/Notifications/service";
import { channelWrapper } from "../../src/Config/rabbitmq";

describe("Notifications event consumer — handleMessage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("turns a circle.payout event into a CIRCLE notification", async () => {
    await handleMessage("circle.payout", {
      userId: "user-1",
      circleId: "circle-1",
      round: 2,
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-1",
      "CIRCLE",
      "Circle payout received",
      "Your circle round has completed and the payout has been credited to your wallet.",
    );
  });

  it("turns a kyc.approved event into a KYC notification", async () => {
    await handleMessage("kyc.approved", { userId: "user-2" });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-2",
      "KYC",
      "KYC approved",
      "Your identity verification has been approved.",
    );
  });

  it("turns a kyc.rejected event into a KYC notification carrying the reason", async () => {
    await handleMessage("kyc.rejected", {
      userId: "user-3",
      reason: "Selfie did not match ID photo",
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-3",
      "KYC",
      "KYC rejected",
      "Your identity verification was rejected: Selfie did not match ID photo",
    );
  });

  it("logs and does nothing for an unrecognized routing key, without throwing", async () => {
    await expect(
      handleMessage("some.future.event", { anything: true }),
    ).resolves.toBeUndefined();

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});

describe("startNotificationEventConsumer — ack/nack wiring", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const getMessageHandler = async () => {
    await startNotificationEventConsumer();
    const setupFn = (channelWrapper.addSetup as jest.Mock).mock.calls[0][0];
    const consume = jest.fn();
    const channel = { consume, ack: jest.fn(), nack: jest.fn() };
    await setupFn(channel);
    const onMessage = consume.mock.calls[0][1];
    return { channel, onMessage };
  };

  it("acks after successfully processing a valid message", async () => {
    (notificationsService.createNotification as jest.Mock).mockResolvedValue(
      undefined,
    );
    const { channel, onMessage } = await getMessageHandler();
    const msg = {
      content: Buffer.from(JSON.stringify({ userId: "user-1" })),
      fields: { routingKey: "kyc.approved" },
    };

    await onMessage(msg);

    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("nacks without requeue when the handler throws", async () => {
    (notificationsService.createNotification as jest.Mock).mockRejectedValue(
      new Error("db error"),
    );
    const { channel, onMessage } = await getMessageHandler();
    const msg = {
      content: Buffer.from(JSON.stringify({ userId: "user-1" })),
      fields: { routingKey: "kyc.approved" },
    };

    await onMessage(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it("nacks on invalid JSON payload", async () => {
    const { channel, onMessage } = await getMessageHandler();
    const msg = {
      content: Buffer.from("not valid json"),
      fields: { routingKey: "kyc.approved" },
    };

    await onMessage(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it("acks an unrecognized routing key without calling createNotification", async () => {
    const { channel, onMessage } = await getMessageHandler();
    const msg = {
      content: Buffer.from(JSON.stringify({})),
      fields: { routingKey: "some.other.event" },
    };

    await onMessage(msg);

    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});
