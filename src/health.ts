import type { Db } from "mongodb";
import type { Pool } from "pg";

export type StoreHealthState = "up" | "down" | "skipped";

export interface StoreHealth {
  mongo: StoreHealthState;
  postgres: StoreHealthState;
  checkedAt: string;
}

/** Each store reports on its own. One being down does not rewrite the other. */
export async function checkStoreHealth(stores: {
  mongo?: Db | null;
  postgres?: Pool | null;
}): Promise<StoreHealth> {
  const health: StoreHealth = {
    mongo: stores.mongo ? "down" : "skipped",
    postgres: stores.postgres ? "down" : "skipped",
    checkedAt: new Date().toISOString(),
  };

  if (stores.mongo) {
    try {
      await stores.mongo.command({ ping: 1 });
      health.mongo = "up";
    } catch {
      health.mongo = "down";
    }
  }

  if (stores.postgres) {
    try {
      await stores.postgres.query("SELECT 1");
      health.postgres = "up";
    } catch {
      health.postgres = "down";
    }
  }

  return health;
}
