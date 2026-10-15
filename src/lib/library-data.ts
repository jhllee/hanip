import { z } from "zod";
import { persistedLibrarySchema } from "@/lib/schemas";
import type { Bookmark, DailyRecommendation, PersistedLibrary } from "@/types/library";

export const emptyLibrary = (): PersistedLibrary => ({ bookmarks: [], recommendations: [] });

export function validateLibrary(value: unknown): PersistedLibrary {
  const data = persistedLibrarySchema.parse(value);
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const bookmark of data.bookmarks) {
    if (ids.has(bookmark.id) || urls.has(bookmark.normalizedUrl)) throw new Error("저장 항목이 중복돼요.");
    ids.add(bookmark.id);
    urls.add(bookmark.normalizedUrl);
  }
  const cacheKeys = new Set<string>();
  const recommendations = data.recommendations.filter((item) => {
    const key = `${item.dateKey}:${item.mode}:${item.topic??"all"}`;
    if (!ids.has(item.selectedBookmarkId) || cacheKeys.has(key)) return false;
    cacheKeys.add(key);
    return true;
  });
  return { bookmarks: data.bookmarks, recommendations };
}

export function migrateLibrary(value: unknown, version: number): PersistedLibrary {
  if (version === 1) return validateLibrary(value);
  if (version === 0) {
    const legacy = z.object({ bookmarks: z.array(z.unknown()), recommendations: z.array(z.unknown()).optional() }).parse(value);
    return validateLibrary({ bookmarks: legacy.bookmarks, recommendations: legacy.recommendations ?? [] });
  }
  throw new Error("이 버전의 저장 데이터를 읽을 수 없어요.");
}

export function validRecommendations<T extends DailyRecommendation>(bookmarks: Bookmark[], recommendations: T[]) {
  const ids = new Set(bookmarks.map((item) => item.id));
  // 완독한 오늘의 추천은 완료 화면을 위해 유지합니다. 새 후보 선정은 미완독만 사용합니다.
  return recommendations.filter((item) => ids.has(item.selectedBookmarkId));
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function savedDays(createdAt: string, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000));
}

export function savedLabel(createdAt: string) {
  const days = savedDays(createdAt);
  return days === 0 ? "오늘 저장" : `${days}일 전 저장`;
}
