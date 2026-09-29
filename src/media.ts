import { StoreBoundaryError } from "./errors";

const SANITY_CDN = "cdn.sanity.io";

export function isSanityCdn(url: string): boolean {
  try {
    return new URL(url).hostname === SANITY_CDN;
  } catch {
    return url.includes(SANITY_CDN);
  }
}

/** Community and editorial images must live on disk or a bucket you control. */
export function assertOwnedMediaUrl(url: string): void {
  if (!url.trim()) {
    throw new StoreBoundaryError("A media URL is required.");
  }
  if (isSanityCdn(url)) {
    throw new StoreBoundaryError(
      "Leave cdn.sanity.io. Store the file in Postgres media, local disk, S3, or Vercel Blob.",
    );
  }
}
