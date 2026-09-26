const indices = { exists: jest.fn(), create: jest.fn() };

jest.mock("@elastic/elasticsearch", () => ({
  Client: jest.fn().mockImplementation(() => ({ indices })),
}));

import { startElasticsearch } from "../../src/Config/elasticsearch";

describe("startElasticsearch — index setup retry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    indices.exists.mockReset();
    indices.create.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps retrying index creation in the background after the boot-time attempt times out, until it succeeds", async () => {
    // Simulate an unreachable Elasticsearch during the bounded boot attempt: never resolves.
    indices.exists.mockImplementation(() => new Promise(() => {}));

    const startPromise = startElasticsearch();
    await jest.advanceTimersByTimeAsync(5_000);
    await startPromise;

    expect(indices.create).not.toHaveBeenCalled();

    // Elasticsearch becomes reachable in time for the background retry.
    indices.exists.mockReset();
    indices.exists.mockResolvedValue(false);
    indices.create.mockResolvedValue({});

    await jest.advanceTimersByTimeAsync(15_000);

    expect(indices.create).toHaveBeenCalledWith(
      expect.objectContaining({ index: "users" }),
    );
    expect(indices.create).toHaveBeenCalledWith(
      expect.objectContaining({ index: "transactions" }),
    );
  });

  it("reschedules another retry if the background retry itself fails", async () => {
    indices.exists.mockImplementation(() => new Promise(() => {}));

    const startPromise = startElasticsearch();
    await jest.advanceTimersByTimeAsync(5_000);
    await startPromise;

    indices.exists.mockReset();
    indices.exists.mockRejectedValue(new Error("still unreachable"));

    await jest.advanceTimersByTimeAsync(15_000);
    expect(indices.create).not.toHaveBeenCalled();

    indices.exists.mockReset();
    indices.exists.mockResolvedValue(false);
    indices.create.mockResolvedValue({});

    await jest.advanceTimersByTimeAsync(15_000);

    expect(indices.create).toHaveBeenCalledWith(
      expect.objectContaining({ index: "users" }),
    );
  });
});
