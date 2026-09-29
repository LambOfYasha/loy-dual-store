// src/errors.ts
var StoreBoundaryError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StoreBoundaryError";
  }
};
var StoreConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StoreConfigError";
  }
};

// src/ownership.ts
var EDITORIAL_TABLES = [
  "blogs",
  "lessons",
  "lesson-categories",
  "lesson_categories",
  "pages",
  "tags",
  "media",
  "site-settings",
  "site_settings",
  "cms-users",
  "cms_users"
];
var COMMUNITY_COLLECTIONS = [
  "profiles",
  "communities",
  "posts",
  "comments",
  "favorites",
  "reports",
  "notifications",
  "helpTickets",
  "feedback"
];
var editorial = new Set(EDITORIAL_TABLES);
var community = new Set(COMMUNITY_COLLECTIONS);
function collectionOwner(name) {
  if (editorial.has(name)) return "postgres";
  if (community.has(name)) return "mongo";
  return null;
}
function assertCollectionOwner(store, name) {
  const owner = collectionOwner(name);
  if (owner && owner !== store) {
    const home = owner === "postgres" ? "Postgres (editorial)" : "Mongo (community)";
    throw new StoreBoundaryError(
      `"${name}" belongs in ${home}. This package does not mirror a document into both databases.`
    );
  }
}
function assertEditorialTable(name) {
  assertCollectionOwner("postgres", name);
}
function assertCommunityCollection(name) {
  assertCollectionOwner("mongo", name);
}

// src/media.ts
var SANITY_CDN = "cdn.sanity.io";
function isSanityCdn(url) {
  try {
    return new URL(url).hostname === SANITY_CDN;
  } catch {
    return url.includes(SANITY_CDN);
  }
}
function assertOwnedMediaUrl(url) {
  if (!url.trim()) {
    throw new StoreBoundaryError("A media URL is required.");
  }
  if (isSanityCdn(url)) {
    throw new StoreBoundaryError(
      "Leave cdn.sanity.io. Store the file in Postgres media, local disk, S3, or Vercel Blob."
    );
  }
}

// src/identity.ts
var MEMBER_ROLES = [
  "member",
  "teacher",
  "junior_teacher",
  "senior_teacher",
  "lead_teacher",
  "admin",
  "dev"
];
function clerkRef(clerkId) {
  const id = clerkId.trim();
  if (!id) {
    throw new StoreBoundaryError("clerkId is required. Do not invent a database user for sign-in.");
  }
  return { clerkId: id };
}
function isMemberRole(value) {
  return MEMBER_ROLES.includes(value);
}
function withoutSanityEnvelope(doc) {
  const rest = { ...doc };
  const sanityId = typeof rest._id === "string" ? rest._id : void 0;
  delete rest._id;
  delete rest._rev;
  delete rest._type;
  delete rest._createdAt;
  delete rest._updatedAt;
  return sanityId ? { ...rest, sanityId } : rest;
}

// src/client.ts
import { MongoClient } from "mongodb";
import { Pool } from "pg";
var globalCache = globalThis;
var cache = globalCache.__loyDualStore ?? {};
globalCache.__loyDualStore = cache;
function mongoUrlFrom(options) {
  const url = options.mongoUrl || process.env.MONGO_URL;
  if (!url) {
    throw new StoreConfigError("Set MONGO_URL. Mongo holds community documents.");
  }
  return url;
}
function postgresUrlFrom(options) {
  return options.postgresUrl || process.env.POSTGRES_URL || null;
}
async function createDualStore(options = {}) {
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
  let postgres = null;
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
      cache.mongoClient = void 0;
      cache.mongoUrl = void 0;
      await cache.pool?.end();
      cache.pool = void 0;
      cache.postgresUrl = void 0;
    }
  };
}

// src/health.ts
async function checkStoreHealth(stores) {
  const health = {
    mongo: stores.mongo ? "down" : "skipped",
    postgres: stores.postgres ? "down" : "skipped",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
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

// src/community.ts
function communityCollections(db) {
  return {
    profiles: db.collection("profiles"),
    communities: db.collection("communities"),
    posts: db.collection("posts"),
    comments: db.collection("comments"),
    favorites: db.collection("favorites"),
    reports: db.collection("reports"),
    notifications: db.collection("notifications"),
    helpTickets: db.collection("helpTickets"),
    feedback: db.collection("feedback")
  };
}
var requiredFields = {
  profiles: ["clerkId", "username", "role"],
  communities: ["slug", "title", "createdByClerkId"],
  posts: ["communityId", "clerkId", "body", "bodyFormat"],
  comments: ["postId", "clerkId", "body"],
  favorites: ["clerkId", "targetId", "targetType"],
  reports: ["clerkId", "targetId", "reason"],
  notifications: ["clerkId", "title", "body"],
  helpTickets: ["clerkId", "subject", "body"],
  feedback: ["clerkId", "body"]
};
async function insertCommunityDocument(db, collection, document) {
  assertCommunityCollection(collection);
  const missing = requiredFields[collection].filter((field) => {
    const value = document[field];
    return value === void 0 || value === null || value === "";
  });
  if (missing.length > 0) {
    throw new StoreBoundaryError(
      `${collection} is missing ${missing.join(", ")}.`
    );
  }
  if (typeof document.clerkId === "string") clerkRef(document.clerkId);
  if (typeof document.createdByClerkId === "string") clerkRef(document.createdByClerkId);
  if (typeof document.imageUrl === "string") {
    assertOwnedMediaUrl(document.imageUrl);
  }
  const coll = db.collection(collection);
  return coll.insertOne(document);
}
async function findProfileByClerkId(db, clerkId) {
  const { clerkId: id } = clerkRef(clerkId);
  return db.collection("profiles").findOne({ clerkId: id });
}
async function ensureCommunityIndexes(db) {
  const collections = communityCollections(db);
  await collections.profiles.createIndex({ clerkId: 1 }, { unique: true });
  await collections.communities.createIndex({ slug: 1 }, { unique: true });
  await collections.posts.createIndex({ communityId: 1, createdAt: -1 });
  await collections.comments.createIndex({ postId: 1, createdAt: 1 });
  await collections.favorites.createIndex({ clerkId: 1, targetId: 1 }, { unique: true });
  await collections.reports.createIndex({ targetId: 1, status: 1 });
  await collections.notifications.createIndex({ clerkId: 1, createdAt: -1 });
  await collections.helpTickets.createIndex({ clerkId: 1, createdAt: -1 });
  await collections.feedback.createIndex({ createdAt: -1 });
}
export {
  COMMUNITY_COLLECTIONS,
  EDITORIAL_TABLES,
  MEMBER_ROLES,
  StoreBoundaryError,
  StoreConfigError,
  assertCollectionOwner,
  assertCommunityCollection,
  assertEditorialTable,
  assertOwnedMediaUrl,
  checkStoreHealth,
  clerkRef,
  collectionOwner,
  communityCollections,
  createDualStore,
  ensureCommunityIndexes,
  findProfileByClerkId,
  insertCommunityDocument,
  isMemberRole,
  isSanityCdn,
  withoutSanityEnvelope
};
//# sourceMappingURL=index.js.map