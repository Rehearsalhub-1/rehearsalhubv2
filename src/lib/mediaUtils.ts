/**
 * Media URL utility functions.
 *
 * The project uses Cloudflare R2 for all media storage.
 * R2 serves plain static URLs — no on-the-fly transforms.
 * These functions are pass-through: they return the URL unchanged.
 *
 * The functions are kept for call-site compatibility only.
 * No side-effects, no external dependencies.
 */

export function optimizeImage(
  url: string | null | undefined,
  _opts?: { width?: number; quality?: number }
): string {
  return url || '';
}

export function thumbnailImage(url: string | null | undefined): string {
  return url || '';
}

export function bannerImage(url: string | null | undefined): string {
  return url || '';
}

export function optimizeAudio(url: string | null | undefined): string {
  return url || '';
}
