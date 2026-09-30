import { create } from 'zustand';
import { subscribe as wsSubscribe, sendWsMessage } from '../hooks/useWebSocket';

interface AnnotationStore {
  strokes: any[];
  activeTrackId: string | null;
  _unsubscribe: (() => void) | null;

  setStrokes: (strokes: any[]) => void;
  subscribeToTrack: (trackId: string) => void;
  unsubscribe: () => void;
  saveStrokes: (strokes: any[]) => Promise<void>;
  broadcastStrokes: (strokes: any[]) => void;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  strokes: [],
  activeTrackId: null,
  _unsubscribe: null,

  setStrokes: (strokes) => set({ strokes }),

  broadcastStrokes: (strokes: any[]) => {
    const { activeTrackId } = get();
    if (!activeTrackId) return;
    // Broadcast to all other clients watching this song via WebSocket
    sendWsMessage({
      type: 'broadcast',
      resource: 'annotation',
      id: activeTrackId,
      data: { strokes },
    });
  },

  subscribeToTrack: (trackId: string) => {
    const { _unsubscribe, activeTrackId } = get();

    // Already subscribed to this track — no-op
    if (activeTrackId === trackId && _unsubscribe) return;

    // Clean up previous subscription
    if (_unsubscribe) _unsubscribe();

    // Clear strokes immediately when switching songs
    set({ activeTrackId: trackId, strokes: [] });

    // Subscribe to live annotation events for this track via WebSocket
    const handler = (data: unknown) => {
      const payload = data as any;
      const incoming = payload?.strokes ?? payload?.data?.strokes;
      if (Array.isArray(incoming)) {
        set({ strokes: incoming });
      }
    };

    const unsub = wsSubscribe('annotation', trackId, handler);
    set({ _unsubscribe: unsub });
  },

  unsubscribe: () => {
    const { _unsubscribe } = get();
    if (_unsubscribe) _unsubscribe();
    set({ _unsubscribe: null, activeTrackId: null, strokes: [] });
  },

  saveStrokes: async (strokes: any[]) => {
    const { activeTrackId } = get();
    if (!activeTrackId) return;
    set({ strokes });
  },
}));

