import * as mongodb from 'mongodb';
import { Db, Collection } from 'mongodb';
import { Pool } from 'pg';

declare class StoreBoundaryError extends Error {
    constructor(message: string);
}
declare class StoreConfigError extends Error {
    constructor(message: string);
}

/** Tables Payload (or another SQL editor) owns. Never create these in Mongo. */
declare const EDITORIAL_TABLES: readonly ["blogs", "lessons", "lesson-categories", "lesson_categories", "pages", "tags", "media", "site-settings", "site_settings", "cms-users", "cms_users"];
/** Documents the community graph owns. Never create these as Postgres tables. */
declare const COMMUNITY_COLLECTIONS: readonly ["profiles", "communities", "posts", "comments", "favorites", "reports", "notifications", "helpTickets", "feedback"];
type EditorialTable = (typeof EDITORIAL_TABLES)[number];
type CommunityCollection = (typeof COMMUNITY_COLLECTIONS)[number];
type StoreName = "postgres" | "mongo";
declare function collectionOwner(name: string): StoreName | null;
/**
 * Known names must stay on their store.
 * Unknown names are allowed so an app can add its own, but do not sneak a known name across.
 */
declare function assertCollectionOwner(store: StoreName, name: string): void;
declare function assertEditorialTable(name: string): void;
declare function assertCommunityCollection(name: string): void;

declare function isSanityCdn(url: string): boolean;
/** Community and editorial images must live on disk or a bucket you control. */
declare function assertOwnedMediaUrl(url: string): void;

declare const MEMBER_ROLES: readonly ["member", "teacher", "junior_teacher", "senior_teacher", "lead_teacher", "admin", "dev"];
type MemberRole = (typeof MEMBER_ROLES)[number];
interface MemberProfile {
    clerkId: string;
    username: string;
    imageUrl?: string;
    role: MemberRole;
    createdAt: Date;
    updatedAt: Date;
}
interface CommunityRecord {
    slug: string;
    title: string;
    description?: string;
    imageUrl?: string;
    createdByClerkId: string;
    createdAt: Date;
    updatedAt: Date;
}
interface PostRecord {
    communityId: string;
    clerkId: string;
    title?: string;
    body: string;
    bodyFormat: "html" | "portable-text";
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}
interface CommentRecord {
    postId: string;
    clerkId: string;
    body: string;
    parentId?: string;
    createdAt: Date;
    updatedAt: Date;
}
/** Clerk is the only sign-in system. Both stores keep this string. They do not foreign-key each other. */
declare function clerkRef(clerkId: string): {
    clerkId: string;
};
declare function isMemberRole(value: string): value is MemberRole;
/**
 * Drop Sanity's envelope so a one-time export can land in Mongo
 * without pretending the document still lives in a Content Lake.
 */
declare function withoutSanityEnvelope<T extends Record<string, unknown>>(doc: T): Record<string, unknown>;

interface DualStoreOptions {
    mongoUrl?: string;
    mongoDb?: string;
    /**
     * Raw SQL for app tables that are not Payload documents.
     * Leave unset when Payload already owns DATABASE_URI.
     */
    postgresUrl?: string;
}
interface DualStore {
    mongo: Db;
    /** Null unless POSTGRES_URL (or postgresUrl) was set on purpose. */
    postgres: Pool | null;
    close: () => Promise<void>;
}
declare function createDualStore(options?: DualStoreOptions): Promise<DualStore>;

type StoreHealthState = "up" | "down" | "skipped";
interface StoreHealth {
    mongo: StoreHealthState;
    postgres: StoreHealthState;
    checkedAt: string;
}
/** Each store reports on its own. One being down does not rewrite the other. */
declare function checkStoreHealth(stores: {
    mongo?: Db | null;
    postgres?: Pool | null;
}): Promise<StoreHealth>;

interface FavoriteRecord {
    clerkId: string;
    targetId: string;
    targetType: "post" | "comment" | "blog";
    createdAt: Date;
}
interface ReportRecord {
    clerkId: string;
    targetId: string;
    targetType: string;
    reason: string;
    status: "open" | "resolved";
    createdAt: Date;
}
interface NotificationRecord {
    clerkId: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: Date;
}
interface TicketRecord {
    clerkId: string;
    subject: string;
    body: string;
    status: "open" | "closed";
    createdAt: Date;
    updatedAt: Date;
}
declare function communityCollections(db: Db): {
    profiles: Collection<MemberProfile>;
    communities: Collection<CommunityRecord>;
    posts: Collection<PostRecord>;
    comments: Collection<CommentRecord>;
    favorites: Collection<FavoriteRecord>;
    reports: Collection<ReportRecord>;
    notifications: Collection<NotificationRecord>;
    helpTickets: Collection<TicketRecord>;
    feedback: Collection<TicketRecord>;
};
declare function insertCommunityDocument<T extends Record<string, unknown>>(db: Db, collection: CommunityCollection, document: T): Promise<mongodb.InsertOneResult<T>>;
declare function findProfileByClerkId(db: Db, clerkId: string): Promise<MemberProfile | null>;
declare function ensureCommunityIndexes(db: Db): Promise<void>;

export { COMMUNITY_COLLECTIONS, type CommentRecord, type CommunityCollection, type CommunityRecord, type DualStore, type DualStoreOptions, EDITORIAL_TABLES, type EditorialTable, type FavoriteRecord, MEMBER_ROLES, type MemberProfile, type MemberRole, type NotificationRecord, type PostRecord, type ReportRecord, StoreBoundaryError, StoreConfigError, type StoreHealth, type StoreHealthState, type StoreName, type TicketRecord, assertCollectionOwner, assertCommunityCollection, assertEditorialTable, assertOwnedMediaUrl, checkStoreHealth, clerkRef, collectionOwner, communityCollections, createDualStore, ensureCommunityIndexes, findProfileByClerkId, insertCommunityDocument, isMemberRole, isSanityCdn, withoutSanityEnvelope };
