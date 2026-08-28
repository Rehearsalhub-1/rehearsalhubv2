import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_ID = '136e64';
const INGEST_URL = 'http://127.0.0.1:7880/ingest/2384d5c2-327f-49e4-ae7d-0f5fb26ea0f2';
const BUFFER_KEY = `debug_session_buffer_${SESSION_ID}`;
const MAX_BUFFER = 100;

type DebugPayload = {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
};

async function appendToBuffer(entry: DebugPayload) {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    const buffer: DebugPayload[] = raw ? JSON.parse(raw) : [];
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) {
      buffer.splice(0, buffer.length - MAX_BUFFER);
    }
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
  } catch {}
}

export async function flushDebugSessionLogs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    if (!raw) return 0;

    const buffer: DebugPayload[] = JSON.parse(raw);
    let flushed = 0;

    for (const entry of buffer) {
      try {
        const res = await fetch(INGEST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': SESSION_ID,
          },
          body: JSON.stringify(entry),
        });
        if (res.ok) flushed += 1;
      } catch {}
    }

    if (flushed > 0) {
      await AsyncStorage.removeItem(BUFFER_KEY);
    }

    return flushed;
  } catch {
    return 0;
  }
}

export function debugSessionLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
  runId = 'post-fix'
) {
  const entry: DebugPayload = {
    sessionId: SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };

  console.warn(`[DEBUG-${SESSION_ID}] ${location} — ${message}`, data);

  appendToBuffer(entry).catch(() => {});

  fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': SESSION_ID,
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
