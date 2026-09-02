import { create } from 'zustand';

interface AnnotationStore {
  strokes: any[];
  activeTrackId: string | null;
  _unsubscribe: (() => void) | null;

  setStrokes: (strokes: any[]) => void;
  subscribeToTrack: (trackId: string) => void;
  unsubscribe: () => void;
  saveStrokes: (strokes: any[]) => Promise<void>;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  strokes: [],
  activeTrackId: null,
  _unsubscribe: null,

  setStrokes: (strokes) => set({ strokes }),

  subscribeToTrack: (trackId: string) => {
    const { _unsubscribe, activeTrackId } = get();
    if (activeTrackId === trackId) return;
    if (_unsubscribe) _unsubscribe();

    set({ activeTrackId: trackId, strokes: [] });
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
