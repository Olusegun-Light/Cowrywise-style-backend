jest.unmock("../../src/Utils/eventBus");

jest.mock("../../src/Config/rabbitmq", () => ({
  channelWrapper: { publish: jest.fn() },
  EXCHANGE: "cowrywise.events",
}));

import { publishEvent } from "../../src/Utils/eventBus";
import { channelWrapper } from "../../src/Config/rabbitmq";

describe("publishEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("publishes to the shared exchange with a persistent, JSON payload and a bounded timeout", async () => {
    (channelWrapper.publish as jest.Mock).mockResolvedValue(true);

    await publishEvent("kyc.approved", { userId: "user-1" });

    expect(channelWrapper.publish).toHaveBeenCalledWith(
      "cowrywise.events",
      "kyc.approved",
      { userId: "user-1" },
      { persistent: true, timeout: 5_000 },
    );
  });

  it("propagates a rejection from the underlying publish call instead of swallowing it", async () => {
    (channelWrapper.publish as jest.Mock).mockRejectedValue(
      new Error("timeout"),
    );

    await expect(
      publishEvent("kyc.approved", { userId: "user-1" }),
    ).rejects.toThrow("timeout");
  });
});
