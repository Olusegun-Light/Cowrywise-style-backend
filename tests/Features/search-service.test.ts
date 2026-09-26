jest.mock("../../src/Config/elasticsearch", () => ({
  esClient: { index: jest.fn(), search: jest.fn() },
  USERS_INDEX: "users",
  TRANSACTIONS_INDEX: "transactions",
}));

import { errors as esErrors } from "@elastic/elasticsearch";
import * as searchService from "../../src/Features/Search/service";
import { esClient } from "../../src/Config/elasticsearch";
import { AppError } from "../../src/Utils/AppError";

describe("Search/service", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("indexUser upserts a document keyed by user id with the searchable fields", async () => {
    await searchService.indexUser({
      id: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      kycStatus: "APPROVED",
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect(esClient.index).toHaveBeenCalledWith({
      index: "users",
      id: "user-1",
      document: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        kycStatus: "APPROVED",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
  });

  it("indexTransaction upserts a document with denormalized user fields and a BigInt-safe amount", async () => {
    await searchService.indexTransaction(
      {
        id: "txn-1",
        type: "WALLET_FUNDING",
        status: "SUCCESS",
        amount: 500000n,
        providerReference: "ref_abc123",
        walletId: "wallet-1",
      },
      {
        id: "user-1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    );

    expect(esClient.index).toHaveBeenCalledWith({
      index: "transactions",
      id: "txn-1",
      document: {
        type: "WALLET_FUNDING",
        status: "SUCCESS",
        amount: 500000,
        providerReference: "ref_abc123",
        walletId: "wallet-1",
        userId: "user-1",
        userEmail: "ada@example.com",
        userName: "Ada Lovelace",
      },
    });
  });

  it("searchUsers builds a paginated multi_match query over name and email", async () => {
    (esClient.search as jest.Mock).mockResolvedValue({
      hits: {
        hits: [{ _id: "user-1", _source: { firstName: "Ada" } }],
        total: { value: 1 },
      },
    });

    const result = await searchService.searchUsers("ada", 1, 20);

    expect(esClient.search).toHaveBeenCalledWith({
      index: "users",
      from: 0,
      size: 20,
      query: {
        multi_match: {
          query: "ada",
          fields: ["firstName", "lastName", "email"],
          fuzziness: "AUTO",
        },
      },
    });
    expect(result.results).toEqual([{ id: "user-1", firstName: "Ada" }]);
    expect(result.total).toBe(1);
  });

  it("searchUsers throws a clean 503 AppError when Elasticsearch is unreachable", async () => {
    (esClient.search as jest.Mock).mockRejectedValue(
      new esErrors.ConnectionError("connect ECONNREFUSED"),
    );

    await expect(searchService.searchUsers("ada", 1, 20)).rejects.toMatchObject(
      { statusCode: 503 },
    );
    await expect(
      searchService.searchUsers("ada", 1, 20),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("searchUsers rethrows a non-Elasticsearch error unchanged", async () => {
    (esClient.search as jest.Mock).mockRejectedValue(new Error("boom"));

    await expect(searchService.searchUsers("ada", 1, 20)).rejects.toThrow(
      "boom",
    );
  });

  it("searchTransactions builds a paginated multi_match query over reference and user fields", async () => {
    (esClient.search as jest.Mock).mockResolvedValue({
      hits: {
        hits: [{ _id: "txn-1", _source: { providerReference: "ref_abc" } }],
        total: { value: 0 },
      },
    });

    const result = await searchService.searchTransactions("ref_abc", 2, 10);

    expect(esClient.search).toHaveBeenCalledWith({
      index: "transactions",
      from: 10,
      size: 10,
      query: {
        multi_match: {
          query: "ref_abc",
          fields: ["providerReference", "userName", "userEmail"],
          fuzziness: "AUTO",
        },
      },
    });
    expect(result.results).toEqual([
      { id: "txn-1", providerReference: "ref_abc" },
    ]);
  });

  it("searchTransactions throws a clean 503 AppError when Elasticsearch is unreachable", async () => {
    (esClient.search as jest.Mock).mockRejectedValue(
      new esErrors.TimeoutError("Request timed out"),
    );

    await expect(
      searchService.searchTransactions("ref_abc", 1, 20),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
