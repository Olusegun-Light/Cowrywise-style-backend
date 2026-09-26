import { Client } from "@elastic/elasticsearch";
import { env } from "./env";
import { logger } from "../Utils/logger";

const CONNECT_TIMEOUT_MS = 5_000;
const INDEX_RETRY_INTERVAL_MS = 15_000;

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

const ensureIndices = async () => {
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
};

// Elasticsearch commonly isn't ready within the 5s boot window (JVM warmup,
// cluster formation) — if the bounded attempt below times out, this keeps
// retrying in the background so the intended mapping still gets applied
// once ES comes up, instead of the first real index/search call silently
// auto-creating the index with a dynamic (inferred) mapping forever.
export const scheduleIndexRetry = (): void => {
  setTimeout(() => {
    void ensureIndices()
      .then(() => logger.info("Elasticsearch indices created after retry"))
      .catch((err: unknown) => {
        logger.warn(
          { err },
          "Elasticsearch index retry failed — retrying again",
        );
        scheduleIndexRetry();
      });
  }, INDEX_RETRY_INTERVAL_MS);
};

export const startElasticsearch = async (): Promise<void> => {
  try {
    await Promise.race([
      ensureIndices(),
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
      "Elasticsearch not reachable within the timeout — continuing startup without it; indexing/search will fail gracefully until it's available. Retrying index setup in the background.",
    );
    scheduleIndexRetry();
  }
};
