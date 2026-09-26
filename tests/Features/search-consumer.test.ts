jest.mock("../../src/Features/Search/service");

jest.mock("../../src/Config/rabbitmq", () => ({
  channelWrapper: { addSetup: jest.fn() },
  SEARCH_USERS_QUEUE: "search.users.events",
}));

jest.mock("../../src/Config/db", () => ({
  __esModule: true,
  default: { user: { findUniqueOrThrow: jest.fn() } },
}));

import { startSearchEventConsumer } from "../../src/Features/Search/consumer";
import * as searchService from "../../src/Features/Search/service";
import { channelWrapper } from "../../src/Config/rabbitmq";
import prisma from "../../src/Config/db";

describe("Search event consumer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const fakeUser = { id: "user-1", firstName: "Ada", lastName: "Lovelace" };

  const getMessageHandler = async () => {
    await startSearchEventConsumer();
    const setupFn = (channelWrapper.addSetup as jest.Mock).mock.calls[0][0];
    const consume = jest.fn();
    const channel = { consume, ack: jest.fn(), nack: jest.fn() };
    await setupFn(channel);
    const onMessage = consume.mock.calls[0][1];
    return { channel, onMessage };
  };

  it("looks up the user, indexes them, and acks on a valid search.user.upsert message", async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(fakeUser);
    (searchService.indexUser as jest.Mock).mockResolvedValue(undefined);
    const { channel, onMessage } = await getMessageHandler();
    const msg = {
      content: Buffer.from(JSON.stringify({ userId: "user-1" })),
      fields: { routingKey: "search.user.upsert" },
    };

    await onMessage(msg);

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(searchService.indexUser).toHaveBeenCalledWith(fakeUser);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("nacks without requeue when indexUser throws", async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(fakeUser);
    (searchService.indexUser as jest.Mock).mockRejectedValue(
      new Error("es down"),
    );
    const { channel, onMessage } = await getMessageHandler();
    const msg = {
      content: Buffer.from(JSON.stringify({ userId: "user-1" })),
      fields: { routingKey: "search.user.upsert" },
    };

    await onMessage(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it("nacks without requeue when the user lookup fails (e.g. user not found)", async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockRejectedValue(
      new Error("not found"),
    );
    const { channel, onMessage } = await getMessageHandler();
    const msg = {
      content: Buffer.from(JSON.stringify({ userId: "does-not-exist" })),
      fields: { routingKey: "search.user.upsert" },
    };

    await onMessage(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(searchService.indexUser).not.toHaveBeenCalled();
  });
});
