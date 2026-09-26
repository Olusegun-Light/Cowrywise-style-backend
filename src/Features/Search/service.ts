import { errors as esErrors } from "@elastic/elasticsearch";
import {
  esClient,
  USERS_INDEX,
  TRANSACTIONS_INDEX,
} from "../../Config/elasticsearch";
import { AppError } from "../../Utils/AppError";

type IndexableUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  kycStatus: string;
  isActive: boolean;
  createdAt: Date;
};

type IndexableTransaction = {
  id: string;
  type: string;
  status: string;
  amount: bigint;
  providerReference: string;
  walletId: string;
};

type TransactionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export const indexUser = async (user: IndexableUser) => {
  await esClient.index({
    index: USERS_INDEX,
    id: user.id,
    document: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      kycStatus: user.kycStatus,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
};

export const indexTransaction = async (
  transaction: IndexableTransaction,
  user: TransactionUser,
) => {
  await esClient.index({
    index: TRANSACTIONS_INDEX,
    id: transaction.id,
    document: {
      type: transaction.type,
      status: transaction.status,
      amount: Number(transaction.amount),
      providerReference: transaction.providerReference,
      walletId: transaction.walletId,
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
    },
  });
};

const asSearchUnavailableError = (err: unknown) => {
  if (err instanceof esErrors.ElasticsearchClientError) {
    return new AppError("Search is temporarily unavailable", 503);
  }
  return err;
};

export const searchUsers = async (
  query: string,
  page: number,
  limit: number,
) => {
  try {
    const res = await esClient.search({
      index: USERS_INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ["firstName", "lastName", "email"],
          fuzziness: "AUTO",
        },
      },
    });

    return {
      results: res.hits.hits.map((hit) => ({
        id: hit._id,
        ...(hit._source as Record<string, unknown>),
      })),
      total:
        typeof res.hits.total === "number"
          ? res.hits.total
          : (res.hits.total?.value ?? 0),
    };
  } catch (err) {
    throw asSearchUnavailableError(err);
  }
};

export const searchTransactions = async (
  query: string,
  page: number,
  limit: number,
) => {
  try {
    const res = await esClient.search({
      index: TRANSACTIONS_INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ["providerReference", "userName", "userEmail"],
          fuzziness: "AUTO",
        },
      },
    });

    return {
      results: res.hits.hits.map((hit) => ({
        id: hit._id,
        ...(hit._source as Record<string, unknown>),
      })),
      total:
        typeof res.hits.total === "number"
          ? res.hits.total
          : (res.hits.total?.value ?? 0),
    };
  } catch (err) {
    throw asSearchUnavailableError(err);
  }
};
