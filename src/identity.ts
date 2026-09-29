import { StoreBoundaryError } from "./errors";

export const MEMBER_ROLES = [
  "member",
  "teacher",
  "junior_teacher",
  "senior_teacher",
  "lead_teacher",
  "admin",
  "dev",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface MemberProfile {
  clerkId: string;
  username: string;
  imageUrl?: string;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityRecord {
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  createdByClerkId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostRecord {
  communityId: string;
  clerkId: string;
  title?: string;
  body: string;
  bodyFormat: "html" | "portable-text";
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentRecord {
  postId: string;
  clerkId: string;
  body: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Clerk is the only sign-in system. Both stores keep this string. They do not foreign-key each other. */
export function clerkRef(clerkId: string): { clerkId: string } {
  const id = clerkId.trim();
  if (!id) {
    throw new StoreBoundaryError("clerkId is required. Do not invent a database user for sign-in.");
  }
  return { clerkId: id };
}

export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

/**
 * Drop Sanity's envelope so a one-time export can land in Mongo
 * without pretending the document still lives in a Content Lake.
 */
export function withoutSanityEnvelope<T extends Record<string, unknown>>(doc: T): Record<string, unknown> {
  const rest = { ...doc };
  const sanityId = typeof rest._id === "string" ? rest._id : undefined;
  delete rest._id;
  delete rest._rev;
  delete rest._type;
  delete rest._createdAt;
  delete rest._updatedAt;
  return sanityId ? { ...rest, sanityId } : rest;
}
