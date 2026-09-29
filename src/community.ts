import type { Collection, Db, OptionalUnlessRequiredId } from "mongodb";
import { StoreBoundaryError } from "./errors";
import {
  clerkRef,
  type CommentRecord,
  type CommunityRecord,
  type MemberProfile,
  type PostRecord,
} from "./identity";
import { assertOwnedMediaUrl } from "./media";
import { assertCommunityCollection, type CommunityCollection } from "./ownership";

export interface FavoriteRecord {
  clerkId: string;
  targetId: string;
  targetType: "post" | "comment" | "blog";
  createdAt: Date;
}

export interface ReportRecord {
  clerkId: string;
  targetId: string;
  targetType: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: Date;
}

export interface NotificationRecord {
  clerkId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

export interface TicketRecord {
  clerkId: string;
  subject: string;
  body: string;
  status: "open" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

export function communityCollections(db: Db) {
  return {
    profiles: db.collection<MemberProfile>("profiles"),
    communities: db.collection<CommunityRecord>("communities"),
    posts: db.collection<PostRecord>("posts"),
    comments: db.collection<CommentRecord>("comments"),
    favorites: db.collection<FavoriteRecord>("favorites"),
    reports: db.collection<ReportRecord>("reports"),
    notifications: db.collection<NotificationRecord>("notifications"),
    helpTickets: db.collection<TicketRecord>("helpTickets"),
    feedback: db.collection<TicketRecord>("feedback"),
  };
}

const requiredFields: Record<CommunityCollection, string[]> = {
  profiles: ["clerkId", "username", "role"],
  communities: ["slug", "title", "createdByClerkId"],
  posts: ["communityId", "clerkId", "body", "bodyFormat"],
  comments: ["postId", "clerkId", "body"],
  favorites: ["clerkId", "targetId", "targetType"],
  reports: ["clerkId", "targetId", "reason"],
  notifications: ["clerkId", "title", "body"],
  helpTickets: ["clerkId", "subject", "body"],
  feedback: ["clerkId", "body"],
};

export async function insertCommunityDocument<T extends Record<string, unknown>>(
  db: Db,
  collection: CommunityCollection,
  document: T,
) {
  assertCommunityCollection(collection);
  const missing = requiredFields[collection].filter((field) => {
    const value = document[field];
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    throw new StoreBoundaryError(
      `${collection} is missing ${missing.join(", ")}.`,
    );
  }
  if (typeof document.clerkId === "string") clerkRef(document.clerkId);
  if (typeof document.createdByClerkId === "string") clerkRef(document.createdByClerkId);
  if (typeof document.imageUrl === "string") {
    assertOwnedMediaUrl(document.imageUrl);
  }

  const coll = db.collection(collection) as Collection<T>;
  return coll.insertOne(document as OptionalUnlessRequiredId<T>);
}

export async function findProfileByClerkId(db: Db, clerkId: string): Promise<MemberProfile | null> {
  const { clerkId: id } = clerkRef(clerkId);
  return db.collection<MemberProfile>("profiles").findOne({ clerkId: id });
}

export async function ensureCommunityIndexes(db: Db): Promise<void> {
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
