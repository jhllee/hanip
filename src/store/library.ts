"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { z } from "zod";
import { STORAGE_KEY, STORAGE_VERSION } from "@/lib/constants";
import { bookmarkSchema, dailyRecommendationSchema } from "@/lib/schemas";
import { emptyLibrary, migrateLibrary, validateLibrary, validRecommendations } from "@/lib/library-data";
import type { Bookmark, DailyRecommendation, PersistedLibrary } from "@/types/library";

interface StorageStatus {
  hydrated: boolean;
  error: string | null;
  writesBlocked: boolean;
}
export const useStorageStatus = create<StorageStatus>(() => ({ hydrated: false, error: null, writesBlocked: false }));

const storage: PersistStorage<PersistedLibrary> = {
  getItem(name) {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const envelope = z.object({ state: z.unknown(), version: z.number().int().min(0) }).parse(JSON.parse(raw));
      const state = envelope.version === STORAGE_VERSION
        ? validateLibrary(envelope.state)
        : migrateLibrary(envelope.state, envelope.version);
      return { state, version: envelope.version };
    } catch {
      useStorageStatus.setState({ writesBlocked: true, error: "저장된 서재를 불러오지 못했어요. 기존 데이터 보호를 위해 브라우저 저장을 멈췄어요. 이 창에서 바꾼 내용은 새로고침하면 사라져요." });
      return null;
    }
  },
  setItem(name, value) {
    if (useStorageStatus.getState().writesBlocked) return;
    try {
      localStorage.setItem(name, JSON.stringify(value));
      useStorageStatus.setState({ error: null });
    } catch {
      useStorageStatus.setState({ error: "브라우저에 저장하지 못했어요. 저장 공간이나 브라우저 설정을 확인해 주세요. 이 창에서 바꾼 내용은 새로고침하면 사라질 수 있어요." });
    }
  },
  removeItem(name) {
    try { localStorage.removeItem(name); }
    catch { useStorageStatus.setState({ error: "브라우저 데이터를 지우지 못했어요." }); }
  },
};

interface LibraryStore extends PersistedLibrary {
  addBookmark: (bookmark: Bookmark) => boolean;
  addBookmarks: (bookmarks: Bookmark[]) => { added: number; skipped: number };
  updateBookmark: (id: string, patch: Partial<Bookmark>) => void;
  setRead: (id: string, isRead: boolean) => void;
  toggleFavorite: (id: string) => void;
  removeBookmark: (id: string) => void;
  restoreBookmark: (bookmark: Bookmark, recommendations: DailyRecommendation[]) => boolean;
  saveRecommendation: (recommendation: DailyRecommendation) => void;
}

export const useLibrary = create<LibraryStore>()(persist((set, get) => ({
  ...emptyLibrary(),
  addBookmark: (value) => {
    const bookmark = bookmarkSchema.parse(value);
    if (get().bookmarks.some((item) => item.normalizedUrl === bookmark.normalizedUrl || item.id === bookmark.id)) return false;
    const data = validateLibrary({ bookmarks: [...get().bookmarks, bookmark], recommendations: get().recommendations });
    set(data);
    return true;
  },
  addBookmarks: (values) => {
    const incoming = values.map((item) => bookmarkSchema.parse(item));
    const bookmarks = [...get().bookmarks];
    const urls = new Set(bookmarks.map((item) => item.normalizedUrl));
    const ids = new Set(bookmarks.map((item) => item.id));
    let added = 0;
    for (const item of incoming) {
      if (urls.has(item.normalizedUrl) || ids.has(item.id)) continue;
      bookmarks.push(item); urls.add(item.normalizedUrl); ids.add(item.id); added++;
    }
    if (added) set(validateLibrary({ bookmarks, recommendations: get().recommendations }));
    return { added, skipped: incoming.length - added };
  },
  updateBookmark: (id, patch) => set((state) => {
    const bookmarks = state.bookmarks.map((item) => item.id === id ? bookmarkSchema.parse({ ...item, ...patch, id }) : item);
    return validateLibrary({ bookmarks, recommendations: validRecommendations(bookmarks, state.recommendations) });
  }),
  setRead: (id, isRead) => set((state) => ({ bookmarks: state.bookmarks.map((item) => item.id === id ? { ...item, isRead, readAt: isRead ? new Date().toISOString() : null } : item) })),
  toggleFavorite: (id) => set((state) => ({ bookmarks: state.bookmarks.map((item) => item.id === id ? { ...item, isFavorite: !item.isFavorite } : item) })),
  removeBookmark: (id) => set((state) => {
    const bookmarks = state.bookmarks.filter((item) => item.id !== id);
    return { bookmarks, recommendations: validRecommendations(bookmarks, state.recommendations) };
  }),
  restoreBookmark: (value, cached) => {
    const bookmark=bookmarkSchema.parse(value);
    const current=get();
    if(current.bookmarks.length>=10_000 || current.bookmarks.some(b=>b.id===bookmark.id || b.normalizedUrl===bookmark.normalizedUrl))return false;
    const recommendations=[...current.recommendations];
    for(const r of cached){
      if(!recommendations.some(c=>c.dateKey===r.dateKey&&c.mode===r.mode&&(c.topic??null)===(r.topic??null)))recommendations.push(dailyRecommendationSchema.parse(r));
    }
    set(validateLibrary({bookmarks:[...current.bookmarks,bookmark],recommendations:recommendations.slice(-366*24)}));
    return true;
  },
  saveRecommendation: (value) => {
    const item = dailyRecommendationSchema.parse(value);
    if (!get().bookmarks.some((bookmark) => bookmark.id === item.selectedBookmarkId && !bookmark.isRead)) return;
    set((state) => ({ recommendations: [...state.recommendations.filter((cached) => !(cached.dateKey === item.dateKey && cached.mode === item.mode && (cached.topic??null) === (item.topic??null))), item].slice(-366 * 24) }));
  },
}), {
  name: STORAGE_KEY,
  version: STORAGE_VERSION,
  storage,
  skipHydration: true,
  partialize: (state) => ({ bookmarks: state.bookmarks, recommendations: state.recommendations }),
  migrate: migrateLibrary,
  merge: (persisted, current) => persisted === undefined ? current : ({ ...current, ...validateLibrary(persisted) }),
  onRehydrateStorage: () => (_state, error) => {
    if (error) useStorageStatus.setState({ writesBlocked: true, error: "서재를 불러오지 못했어요. 기존 데이터를 보호하기 위해 저장을 멈췄어요." });
    useStorageStatus.setState({ hydrated: true });
  },
}));

let hydration: Promise<void> | undefined;
export function hydrateLibrary() {
  hydration ??= Promise.resolve(useLibrary.persist.rehydrate());
  return hydration;
}
