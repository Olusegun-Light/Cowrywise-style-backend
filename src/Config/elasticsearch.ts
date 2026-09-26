import { Client } from "@elastic/elasticsearch";
import { env } from "./env";
import { logger } from "../Utils/logger";

const CONNECT_TIMEOUT_MS = 5_000;

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 5_000,
});

export const USERS_INDEX = "users";
export const TRANSACTIONS_INDEX = "transactions";

const ensureIndex = async (
  index: string,
  mappings: Record<string, unknown>,
) => {
  const exists = await esClient.indices.exists({ index });

  if (!exists) {
    await esClient.indices.create({ index, mappings });
  }
};

export const startElasticsearch = async (): Promise<void> => {
  try {
    await Promise.race([
      (async () => {
        await ensureIndex(USERS_INDEX, {
          properties: {
            firstName: { type: "text" },
            lastName: { type: "text" },
            email: { type: "text" },
            kycStatus: { type: "keyword" },
            isActive: { type: "boolean" },
            createdAt: { type: "date" },
          },
        });
        await ensureIndex(TRANSACTIONS_INDEX, {
          properties: {
            type: { type: "keyword" },
            status: { type: "keyword" },
            amount: { type: "long" },
            providerReference: { type: "text" },
            walletId: { type: "keyword" },
            userId: { type: "keyword" },
            userEmail: { type: "text" },
            userName: { type: "text" },
            createdAt: { type: "date" },
          },
        });
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Elasticsearch connect timed out")),
          CONNECT_TIMEOUT_MS,
        ),
      ),
    ]);
    logger.info("Elasticsearch is connected and indices are ready");
  } catch (err) {
    logger.error(
      { err },
      "Elasticsearch not reachable within the timeout — continuing startup without it; indexing/search will fail gracefully until it's available",
    );
  }
};
