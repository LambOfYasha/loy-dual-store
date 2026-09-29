import { MongoClient, type Db } from "mongodb";
import { Pool } from "pg";
import { StoreConfigError } from "./errors";

type Cache = {
  mongoClient?: MongoClient;
  mongoUrl?: string;
  pool?: Pool;
  postgresUrl?: string;
};

const globalCache = globalThis as typeof globalThis & { __loyDualStore?: Cache };
const cache: Cache = globalCache.__loyDualStore ?? {};
globalCache.__loyDualStore = cache;

export interface DualStoreOptions {
  mongoUrl?: string;
  mongoDb?: string;
  /**
   * Raw SQL for app tables that are not Payload documents.
   * Leave unset when Payload already owns DATABASE_URI.
   */
  postgresUrl?: string;
}

export interface DualStore {
  mongo: Db;
  /** Null unless POSTGRES_URL (or postgresUrl) was set on purpose. */
  postgres: Pool | null;
  close: () => Promise<void>;
}

function mongoUrlFrom(options: DualStoreOptions): string {
  const url = options.mongoUrl || process.env.MONGO_URL;
  if (!url) {
    throw new StoreConfigError("Set MONGO_URL. Mongo holds community documents.");
  }
  return url;
}

function postgresUrlFrom(options: DualStoreOptions): string | null {
  return options.postgresUrl || process.env.POSTGRES_URL || null;
}

export async function createDualStore(options: DualStoreOptions = {}): Promise<DualStore> {
  const mongoUrl = mongoUrlFrom(options);
  if (!cache.mongoClient || cache.mongoUrl !== mongoUrl) {
    if (cache.mongoClient) await cache.mongoClient.close();
    const client = new MongoClient(mongoUrl);
    await client.connect();
    cache.mongoClient = client;
    cache.mongoUrl = mongoUrl;
  }

  const dbName = options.mongoDb || process.env.MONGO_DB || "loy";
  const mongo = cache.mongoClient.db(dbName);

  const postgresUrl = postgresUrlFrom(options);
  let postgres: Pool | null = null;
  if (postgresUrl) {
    if (!cache.pool || cache.postgresUrl !== postgresUrl) {
      if (cache.pool) await cache.pool.end();
      cache.pool = new Pool({ connectionString: postgresUrl, max: 5 });
      cache.postgresUrl = postgresUrl;
    }
    postgres = cache.pool;
  }

  return {
    mongo,
    postgres,
    async close() {
      await cache.mongoClient?.close();
      cache.mongoClient = undefined;
      cache.mongoUrl = undefined;
      await cache.pool?.end();
      cache.pool = undefined;
      cache.postgresUrl = undefined;
    },
  };
}
