# @lambofyasha/loy-dual-store

Distribution package for LOY apps that keep two databases and refuse to mix them.

| Store | Owns | Does not own |
| --- | --- | --- |
| Postgres | Editorial rows: blogs, lessons, pages, tags, media, site settings. Payload can own this database through `DATABASE_URI`. | Communities, posts, comments, profiles |
| Mongo | Community documents: profiles, communities, posts, comments, favorites, reports, notifications, help tickets, feedback | Editorial tables |
| Clerk | Sign-in and the session | Document storage |

A blog author and a comment author are the same Clerk id string. There is no foreign key across the two databases, and a write is never copied into the other store. If Mongo is down, Postgres does not become a second copy of the comments.

This is the Ezra Way split with the mirror removed. Ezra's `withMongoFallback` and `syncToBothDatabases` write chat into both databases and then drift. This package throws if you aim a known name at the wrong store.

## Install

The package is published to GitHub Packages.

```ini
# .npmrc
@lambofyasha:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
npm install @lambofyasha/loy-dual-store
```

Peer app libraries you already choose yourself: Payload for the editorial store, Clerk for sign-in. This package does not wrap either one, so it does not pin their versions.

## Environment

```bash
MONGO_URL=mongodb://localhost:27017
MONGO_DB=loy

# Optional. Only for raw SQL that is not a Payload collection.
# Leave it unset when Payload already uses DATABASE_URI.
# POSTGRES_URL=postgresql://loy:loy@localhost:5432/loy
```

`createDualStore()` never reads `DATABASE_URI`. Payload keeps that pool and its migrator.

## Use

```ts
import {
  createDualStore,
  ensureCommunityIndexes,
  insertCommunityDocument,
  findProfileByClerkId,
  assertCollectionOwner,
  assertEditorialTable,
  assertOwnedMediaUrl,
  checkStoreHealth,
} from "@lambofyasha/loy-dual-store";

const store = await createDualStore();
await ensureCommunityIndexes(store.mongo);

await insertCommunityDocument(store.mongo, "profiles", {
  clerkId: "user_123",
  username: "ada",
  role: "teacher",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const profile = await findProfileByClerkId(store.mongo, "user_123");

// Call this before a raw SQL write that names a table.
assertEditorialTable("blogs");

const health = await checkStoreHealth(store);
```

These calls throw `StoreBoundaryError`:

```ts
assertCollectionOwner("mongo", "blogs");
assertEditorialTable("comments");
assertOwnedMediaUrl("https://cdn.sanity.io/images/abc/production/file.jpg");
```

Role checks in middleware should not open Mongo on the edge. Add a route that calls `findProfileByClerkId`, and have middleware fetch that route. The same pattern LIFE uses for the maintenance flag.

Images passed as `imageUrl` must not be on `cdn.sanity.io`. Put them on disk, S3, or Vercel Blob. `withoutSanityEnvelope()` strips `_id`, `_rev`, `_type`, and the Sanity timestamps and keeps the old id as `sanityId` for a one-time export.

## What this package will not do

- It will not mirror a write.
- It will not fall back from Mongo to Postgres for the same document.
- It will not create Payload tables. Payload owns editorial migrations.
- It will not sign people in.

## Scripts

```bash
npm test
npm run typecheck
```

Node 20 or newer.
