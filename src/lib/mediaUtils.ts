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

const BACKEND_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '');

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.includes('pub-cb7697578fcc48d3b3aeb70a47eb2f65.r2.dev')) {
    const key = trimmed.split('pub-cb7697578fcc48d3b3aeb70a47eb2f65.r2.dev/')[1];
    if (key) {
      return `${BACKEND_BASE}/upload/file/${key}`;
    }
  }
  return trimmed;
}

export function optimizeImage(
  url: string | null | undefined,
  _opts?: { width?: number; quality?: number }
): string {
  return resolveMediaUrl(url);
}

export function thumbnailImage(url: string | null | undefined): string {
  return resolveMediaUrl(url);
}

export function bannerImage(url: string | null | undefined): string {
  return resolveMediaUrl(url);
}

export function optimizeAudio(url: string | null | undefined): string {
  return resolveMediaUrl(url);
}

/**
 * Resolves the primary playable audio URL for any song record,
 * scanning all known schema variants (audioUrl, audioFile, audioUrls.full, stems, etc.).
 */
export function resolveSongAudioUrl(song: any): string {
  if (!song) return '';
  if (typeof song === 'string') return song;

  const audioUrls = song.audioUrls || song.audio_urls || {};
  const primary =
    song.audioUrl ||
    song.audio_url ||
    song.audioFile ||
    song.audio_file ||
    song.url ||
    audioUrls.full ||
    audioUrls.main ||
    audioUrls.master ||
    audioUrls.lead ||
    audioUrls.soprano ||
    audioUrls.tenor ||
    audioUrls.alto;

  if (typeof primary === 'string' && primary.trim().length > 0) {
    return primary.trim();
  }

  if (typeof audioUrls === 'object' && audioUrls !== null) {
    const candidate = Object.values(audioUrls).find(
      (u) => typeof u === 'string' && u.trim().length > 0
    );
    if (candidate) return (candidate as string).trim();
  }

  return '';
}

/**
 * Resolves all vocal and instrumental stems into a unified map.
 */
export function resolveSongAudioUrls(song: any): Record<string, string> {
  if (!song) return {};
  const urls: Record<string, string> = {};

  if (song.audioUrls && typeof song.audioUrls === 'object') {
    Object.assign(urls, song.audioUrls);
  }
  if (song.audio_urls && typeof song.audio_urls === 'object') {
    Object.assign(urls, song.audio_urls);
  }

  if (song.sopranoUrl || song.soprano_url) urls.soprano = song.sopranoUrl || song.soprano_url;
  if (song.altoUrl || song.alto_url) urls.alto = song.altoUrl || song.alto_url;
  if (song.tenorUrl || song.tenor_url) urls.tenor = song.tenorUrl || song.tenor_url;
  if (song.leadVocalUrl || song.lead_vocal_url) urls.lead = song.leadVocalUrl || song.lead_vocal_url;
  if (song.instrumentalUrl || song.instrumental_url) urls.instrumental = song.instrumentalUrl || song.instrumental_url;

  const primary = resolveSongAudioUrl(song);
  if (primary && !urls.full) {
    urls.full = primary;
  }

  return urls;
}

