import { StoreBoundaryError } from "./errors";

/** Tables Payload (or another SQL editor) owns. Never create these in Mongo. */
export const EDITORIAL_TABLES = [
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
  "cms_users",
] as const;

/** Documents the community graph owns. Never create these as Postgres tables. */
export const COMMUNITY_COLLECTIONS = [
  "profiles",
  "communities",
  "posts",
  "comments",
  "favorites",
  "reports",
  "notifications",
  "helpTickets",
  "feedback",
] as const;

export type EditorialTable = (typeof EDITORIAL_TABLES)[number];
export type CommunityCollection = (typeof COMMUNITY_COLLECTIONS)[number];
export type StoreName = "postgres" | "mongo";

const editorial = new Set<string>(EDITORIAL_TABLES);
const community = new Set<string>(COMMUNITY_COLLECTIONS);

export function collectionOwner(name: string): StoreName | null {
  if (editorial.has(name)) return "postgres";
  if (community.has(name)) return "mongo";
  return null;
}

/**
 * Known names must stay on their store.
 * Unknown names are allowed so an app can add its own, but do not sneak a known name across.
 */
export function assertCollectionOwner(store: StoreName, name: string): void {
  const owner = collectionOwner(name);
  if (owner && owner !== store) {
    const home = owner === "postgres" ? "Postgres (editorial)" : "Mongo (community)";
    throw new StoreBoundaryError(
      `"${name}" belongs in ${home}. This package does not mirror a document into both databases.`,
    );
  }
}

export function assertEditorialTable(name: string): void {
  assertCollectionOwner("postgres", name);
}

export function assertCommunityCollection(name: string): void {
  assertCollectionOwner("mongo", name);
}
