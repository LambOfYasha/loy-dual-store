import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCollectionOwner,
  assertOwnedMediaUrl,
  clerkRef,
  collectionOwner,
  StoreBoundaryError,
  withoutSanityEnvelope,
} from "../dist/index.js";

test("editorial names stay on Postgres", () => {
  assert.equal(collectionOwner("blogs"), "postgres");
  assert.doesNotThrow(() => assertCollectionOwner("postgres", "blogs"));
  assert.throws(
    () => assertCollectionOwner("mongo", "blogs"),
    StoreBoundaryError,
  );
});

test("community names stay on Mongo", () => {
  assert.equal(collectionOwner("comments"), "mongo");
  assert.doesNotThrow(() => assertCollectionOwner("mongo", "posts"));
  assert.throws(
    () => assertCollectionOwner("postgres", "posts"),
    StoreBoundaryError,
  );
});

test("unknown names are not forced onto either store", () => {
  assert.equal(collectionOwner("custom_notes"), null);
  assert.doesNotThrow(() => assertCollectionOwner("mongo", "custom_notes"));
  assert.doesNotThrow(() => assertCollectionOwner("postgres", "custom_notes"));
});

test("sanity CDN is rejected", () => {
  assert.throws(
    () => assertOwnedMediaUrl("https://cdn.sanity.io/images/abc/production/file.jpg"),
    StoreBoundaryError,
  );
  assert.doesNotThrow(() => assertOwnedMediaUrl("/cms-api/media/file/cover.jpg"));
  assert.doesNotThrow(() => assertOwnedMediaUrl("https://media.example.com/cover.jpg"));
});

test("clerk id is the only identity reference", () => {
  assert.deepEqual(clerkRef(" user_123 "), { clerkId: "user_123" });
  assert.throws(() => clerkRef("   "), StoreBoundaryError);
});

test("sanity envelope is stripped", () => {
  const cleaned = withoutSanityEnvelope({
    _id: "post-1",
    _rev: "1",
    _type: "post",
    _createdAt: "2020-01-01",
    title: "Hello",
  });
  assert.equal(cleaned.sanityId, "post-1");
  assert.equal(cleaned.title, "Hello");
  assert.equal("_type" in cleaned, false);
  assert.equal("_id" in cleaned, false);
});
