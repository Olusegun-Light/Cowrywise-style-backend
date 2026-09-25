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
    jest.useRealTimers();
  });

  it("publishes to the shared exchange with the given routing key and a persistent, JSON payload", async () => {
    (channelWrapper.publish as jest.Mock).mockResolvedValue(true);

    await publishEvent("kyc.approved", { userId: "user-1" });

    expect(channelWrapper.publish).toHaveBeenCalledWith(
      "cowrywise.events",
      "kyc.approved",
      { userId: "user-1" },
      { persistent: true },
    );
  });

  it("rejects instead of hanging forever if the broker never responds", async () => {
    jest.useFakeTimers();
    (channelWrapper.publish as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    const result = publishEvent("kyc.approved", { userId: "user-1" });
    const assertion = expect(result).rejects.toThrow(/timed out/);

    await jest.advanceTimersByTimeAsync(5_000);
    await assertion;
  });
});
