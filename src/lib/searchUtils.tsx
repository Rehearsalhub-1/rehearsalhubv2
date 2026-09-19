import React from 'react';
import { Text, StyleSheet } from 'react-native';

export function stripHtml(html: string): string {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchString(text: string): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
}

export function getPunctuationFree(text: string): string {
  return text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeProgramName(
  nameOrId: any,
  fallback = 'Loveworld Singers',
  programMap?: Record<string, string>
): string {
  if (!nameOrId) return fallback;
  const str = String(nameOrId).trim();
  if (programMap && programMap[str]) {
    return programMap[str];
  }
  // Check if it's a known pattern like pn-28 or praisenight-28
  const pnMatch = str.match(/^(?:pn|praise[-_\s]?night)[-_\s]?(\d+)$/i);
  if (pnMatch) {
    return `Praise Night ${pnMatch[1]}`;
  }
  // Check if it looks like a database ID (UUID, cm..., prog-..., song-..., numbers-only)
  const isIdLike = /^(prog-|song-|sub-|pn-|usr-|uuid-|[0-9a-f]{8}-[0-9a-f]{4}|c[a-z0-9]{20,}|\d{8,})/i.test(str);
  if (isIdLike) {
    return fallback;
  }
  return str;
}

export function sanitizeTextNoId(text: any, fallback: string): string {
  if (!text) return fallback;
  const str = String(text).trim();
  const isIdLike = /^(prog-|song-|sub-|pn-|usr-|uuid-|[0-9a-f]{8}-[0-9a-f]{4}|c[a-z0-9]{20,}|\d{8,})/i.test(str);
  if (isIdLike) {
    return fallback;
  }
  return str;
}

export interface SongSearchResult {
  isMatch: boolean;
  score: number;
  matchField: 'title' | 'leadSinger' | 'writer' | 'program' | 'category' | 'lyrics' | 'comments' | 'solfa' | '';
  snippet?: string;
  matchTokens: string[];
}

export function searchSongMatch(song: any, rawQuery: string): SongSearchResult {
  if (!rawQuery || !rawQuery.trim()) {
    return { isMatch: false, score: 0, matchField: '', matchTokens: [] };
  }

  const query = normalizeSearchString(rawQuery);
  const queryNoPunct = getPunctuationFree(query);
  const queryWords = queryNoPunct.split(/\s+/).filter(w => w.length > 0);

  const title = normalizeSearchString(song.title || '');
  const titleNoPunct = getPunctuationFree(title);

  const singer = normalizeSearchString(song.leadSinger || '');
  const singerNoPunct = getPunctuationFree(singer);

  const writer = normalizeSearchString(song.writer || '');
  const writerNoPunct = getPunctuationFree(writer);

  const program = normalizeSearchString(song.program || '');
  const programNoPunct = getPunctuationFree(program);

  const catStr = Array.isArray(song.categories) ? song.categories.join(' ') : (song.category || '');
  const category = normalizeSearchString(catStr);
  const categoryNoPunct = getPunctuationFree(category);

  const rawLyrics = stripHtml(song.lyrics || '');
  const lyrics = normalizeSearchString(rawLyrics);
  const lyricsNoPunct = getPunctuationFree(lyrics);

  let rawComments = song.comments || song.notes || song.coordinatorComment || '';
  if (typeof rawComments === 'object' && rawComments !== null) {
    try {
      if (Array.isArray(rawComments)) {
        rawComments = rawComments.map((c: any) => (typeof c === 'string' ? c : c?.text || '')).join(' ');
      } else {
        rawComments = rawComments.text || rawComments.comment || JSON.stringify(rawComments);
      }
    } catch {
      rawComments = '';
    }
  }
  const cleanComments = stripHtml(String(rawComments));
  const comments = normalizeSearchString(cleanComments);
  const commentsNoPunct = getPunctuationFree(comments);

  const solfa = normalizeSearchString(stripHtml(song.solfa || song.solfas || song.notation || ''));
  const solfaNoPunct = getPunctuationFree(solfa);

  // Helper to extract a chat-style context snippet
  const extractSnippet = (fullText: string, targetQuery: string, targetWords: string[]): string => {
    const lower = fullText.toLowerCase();
    let idx = -1;
    let foundWord = targetQuery;

    // 1. Direct match
    idx = lower.indexOf(targetQuery.toLowerCase());
    if (idx === -1) {
      // 2. Punctuation-free match
      const noPunctFull = getPunctuationFree(lower);
      const qClean = getPunctuationFree(targetQuery.toLowerCase());
      const pIdx = noPunctFull.indexOf(qClean);
      if (pIdx !== -1) {
        // Approximate index in original
        idx = Math.min(pIdx, fullText.length - 1);
      }
    }
    // 3. Word match
    if (idx === -1 && targetWords.length > 0) {
      for (const w of targetWords) {
        if (w.length < 2) continue;
        const i = lower.indexOf(w);
        if (i !== -1 && (idx === -1 || i < idx)) {
          idx = i;
          foundWord = w;
        }
      }
    }

    if (idx === -1) return '';

    const start = Math.max(0, idx - 26);
    const end = Math.min(fullText.length, idx + foundWord.length + 42);
    let snippet = fullText.slice(start, end).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = '...' + snippet;
    if (end < fullText.length) snippet = snippet + '...';
    return snippet;
  };

  // ── 1. Title Match ────────────────────────────────────────────────────────
  if (title.includes(query) || (queryNoPunct && titleNoPunct.includes(queryNoPunct))) {
    return { isMatch: true, score: 100, matchField: 'title', matchTokens: [rawQuery.trim(), ...queryWords] };
  }
  if (queryWords.length > 1 && queryWords.every(w => titleNoPunct.includes(w))) {
    return { isMatch: true, score: 88, matchField: 'title', matchTokens: queryWords };
  }

  // ── 2. Singer / Writer / Program / Category Match ─────────────────────────
  if (singer.includes(query) || (queryNoPunct && singerNoPunct.includes(queryNoPunct))) {
    return { isMatch: true, score: 75, matchField: 'leadSinger', matchTokens: queryWords.length ? queryWords : [query] };
  }
  if (writer.includes(query) || (queryNoPunct && writerNoPunct.includes(queryNoPunct))) {
    return { isMatch: true, score: 70, matchField: 'writer', matchTokens: queryWords.length ? queryWords : [query] };
  }
  if (program.includes(query) || (queryNoPunct && programNoPunct.includes(queryNoPunct))) {
    return { isMatch: true, score: 65, matchField: 'program', matchTokens: queryWords.length ? queryWords : [query] };
  }
  if (category.includes(query) || (queryNoPunct && categoryNoPunct.includes(queryNoPunct))) {
    return { isMatch: true, score: 60, matchField: 'category', matchTokens: queryWords.length ? queryWords : [query] };
  }

  // ── 3. Lyrics Match (Exact phrase or multi-word) ──────────────────────────
  if (lyrics.includes(query) || (queryNoPunct && lyricsNoPunct.includes(queryNoPunct))) {
    const snippet = extractSnippet(rawLyrics, query, queryWords);
    return { isMatch: true, score: 55, matchField: 'lyrics', snippet, matchTokens: queryWords.length ? queryWords : [query] };
  }
  if (queryWords.length > 1 && queryWords.every(w => lyricsNoPunct.includes(w))) {
    const snippet = extractSnippet(rawLyrics, queryWords[0], queryWords);
    return { isMatch: true, score: 45, matchField: 'lyrics', snippet, matchTokens: queryWords };
  }

  // ── 4. Comments & Coordinator Notes Match ─────────────────────────────────
  if (cleanComments && (comments.includes(query) || (queryNoPunct && commentsNoPunct.includes(queryNoPunct)))) {
    const snippet = extractSnippet(cleanComments, query, queryWords);
    return { isMatch: true, score: 40, matchField: 'comments', snippet, matchTokens: queryWords.length ? queryWords : [query] };
  }

  // ── 5. Solfa Notation Match ───────────────────────────────────────────────
  if (solfa.includes(query) || (queryNoPunct && solfaNoPunct.includes(queryNoPunct))) {
    const snippet = extractSnippet(solfa, query, queryWords);
    return { isMatch: true, score: 30, matchField: 'solfa', snippet, matchTokens: queryWords.length ? queryWords : [query] };
  }

  // ── 6. Partial multi-word match in lyrics ─────────────────────────────────
  if (queryWords.length > 1) {
    const matched = queryWords.filter(w => w.length >= 3 && lyricsNoPunct.includes(w));
    if (matched.length >= 1) {
      const snippet = extractSnippet(rawLyrics, matched[0], matched);
      return { isMatch: true, score: 20 + matched.length * 8, matchField: 'lyrics', snippet, matchTokens: matched };
    }
  }

  return { isMatch: false, score: 0, matchField: '', matchTokens: [] };
}

export function HighlightedText({
  text,
  tokens = [],
  style,
  highlightStyle,
  numberOfLines,
}: {
  text: any;
  tokens?: string[];
  style?: any;
  highlightStyle?: any;
  numberOfLines?: number;
}) {
  const safeText = typeof text === 'string' ? text : (text !== null && text !== undefined ? String(text) : '');
  if (!safeText) return null;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return <Text style={style} numberOfLines={numberOfLines}>{safeText}</Text>;
  }

  try {
    const cleanTokens = Array.from(
      new Set(
        tokens
          .map(t => (typeof t === 'string' ? t.trim() : ''))
          .filter(t => t.length > 0)
      )
    ).sort((a, b) => b.length - a.length);

    if (cleanTokens.length === 0) {
      return <Text style={style} numberOfLines={numberOfLines}>{safeText}</Text>;
    }

    // Also include punctuation-free versions of tokens for resilient matching
    const allMatchTokens = new Set<string>();
    cleanTokens.forEach(t => {
      if (t) allMatchTokens.add(t);
      const noP = getPunctuationFree(t);
      if (noP && noP.length > 0) allMatchTokens.add(noP);
    });

    const tokenArray = Array.from(allMatchTokens).filter(t => t && t.trim().length > 0);
    if (tokenArray.length === 0) {
      return <Text style={style} numberOfLines={numberOfLines}>{safeText}</Text>;
    }

    const escaped = tokenArray.map(escapeRegex).join('|');
    if (!escaped) {
      return <Text style={style} numberOfLines={numberOfLines}>{safeText}</Text>;
    }

    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = safeText.split(regex);

    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {parts.map((part, index) => {
          if (!part) return null;
          const trimmedPart = part.trim();
          const isMatched = trimmedPart.length > 0 && tokenArray.some(t => {
            const cleanT = t.toLowerCase();
            const cleanP = part.toLowerCase();
            if (cleanT === cleanP) return true;
            const noPT = getPunctuationFree(cleanT);
            const noPP = getPunctuationFree(cleanP);
            return noPT.length > 0 && noPT === noPP;
          });

          return isMatched ? (
            <Text key={index} style={[styles.defaultHighlight, highlightStyle]}>
              {part}
            </Text>
          ) : (
            <Text key={index}>{part}</Text>
          );
        })}
      </Text>
    );
  } catch (err) {
    // If regex or rendering fails for any reason, safely fall back to plain text
    return <Text style={style} numberOfLines={numberOfLines}>{safeText}</Text>;
  }
}

const styles = StyleSheet.create({
  defaultHighlight: {
    color: '#38bdf8',
    fontWeight: '700',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderRadius: 3,
  },
});
