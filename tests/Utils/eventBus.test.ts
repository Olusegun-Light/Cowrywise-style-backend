import { rabbitmqPublishTotal } from "../../src/Utils/metrics";

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

  it("increments the publish counter with status=success on a successful publish", async () => {
    const incSpy = jest.spyOn(rabbitmqPublishTotal, "inc");
    (channelWrapper.publish as jest.Mock).mockResolvedValue(true);

    await publishEvent("kyc.approved", { userId: "user-1" });

    expect(incSpy).toHaveBeenCalledWith({
      routing_key: "kyc.approved",
      status: "success",
    });

    incSpy.mockRestore();
  });

  it("increments the publish counter with status=failure when the publish rejects", async () => {
    const incSpy = jest.spyOn(rabbitmqPublishTotal, "inc");
    (channelWrapper.publish as jest.Mock).mockRejectedValue(
      new Error("timeout"),
    );

    await expect(
      publishEvent("kyc.approved", { userId: "user-1" }),
    ).rejects.toThrow("timeout");

    expect(incSpy).toHaveBeenCalledWith({
      routing_key: "kyc.approved",
      status: "failure",
    });

    incSpy.mockRestore();
  });
});
