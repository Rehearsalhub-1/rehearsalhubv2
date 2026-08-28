import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Program {
  id: string;
  name: string;
  category?: string;
  pageCategory?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  bannerImage?: string;
  scope?: string;
  subGroupId?: string;
  subGroupName?: string;
  songIds?: string[];
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

interface ProgramCache {
  pages: Program[];
  lastFetchTime: number;
  metadataTime: number;
}

interface ProgramStore {
  programs: Program[];
  activeProgram: Program | null;
  caches: Record<string, ProgramCache>;
  setPrograms: (programs: Program[]) => void;
  setActiveProgram: (program: Program | null) => void;
  setPages: (cacheKey: string, pages: Program[], fetchTime: number, metadataTime?: number) => void;
  getCache: (cacheKey: string) => ProgramCache | undefined;
  updateMetadataTime: (cacheKey: string, metadataTime: number) => void;
}

export const useProgramStore = create<ProgramStore>()(
  persist(
    (set, get) => ({
      programs: [],
      activeProgram: null,
      caches: {},

      setPrograms: (programs) => set({ programs }),
      setActiveProgram: (activeProgram) => set({ activeProgram }),

      setPages: (cacheKey, pages, fetchTime, metadataTime) =>
        set((state) => {
          const existing = state.caches[cacheKey];
          return {
            programs: pages,
            caches: {
              ...state.caches,
              [cacheKey]: {
                pages,
                lastFetchTime: fetchTime,
                metadataTime: metadataTime ?? (existing?.metadataTime || 0),
              },
            },
          };
        }),

      getCache: (cacheKey) => {
        return get().caches[cacheKey];
      },

      updateMetadataTime: (cacheKey, metadataTime) =>
        set((state) => {
          const existing = state.caches[cacheKey];
          if (!existing) return state;
          return {
            caches: {
              ...state.caches,
              [cacheKey]: {
                ...existing,
                metadataTime,
              },
            },
          };
        }),
    }),
    {
      name: 'lwsrh-program-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ caches: state.caches, programs: state.programs }),
    }
  )
);
