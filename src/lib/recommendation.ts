import { MAX_RECOMMENDATION_CANDIDATES } from "@/lib/constants";
import { matchesTopic } from "@/lib/reading-topics";
import { savedDays } from "@/lib/library-data";
import type { RecommendationCandidate, RecommendationMode, RecommendationRequest } from "@/types/library";

export function candidatesFor(input: RecommendationRequest, now = new Date()): RecommendationCandidate[] {
  const unread = input.bookmarks.filter((b) => !b.isRead && (!input.topic || matchesTopic(`${b.title} ${b.description}`,input.topic))).sort((a,b) => Date.parse(a.createdAt)-Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  const pool = unread.some((b) => b.id !== input.excludeBookmarkId) ? unread.filter((b) => b.id !== input.excludeBookmarkId) : unread;
  // 오래된 글 20개를 확보하고 오래된 즐겨찾기 최대 10개를 포함합니다.
  const chosen = [...(input.mode === "explore" ? [...pool].sort((a,b)=>a.isFavorite===b.isFavorite ? Date.parse(a.createdAt)-Date.parse(b.createdAt) : Number(a.isFavorite)-Number(b.isFavorite)) : pool).slice(0,20)];
  for (const bookmark of [...pool.filter((b) => b.isFavorite), ...pool]) {
    if (chosen.length >= MAX_RECOMMENDATION_CANDIDATES) break;
    if (!chosen.some((b) => b.id === bookmark.id)) chosen.push(bookmark);
  }
  return chosen.map((b) => ({ id: b.id, title: b.title.slice(0,300), description: b.description.slice(0,1000), savedDays: savedDays(b.createdAt, now), isFavorite: b.isFavorite }));
}

export function groundedReason(candidate: RecommendationCandidate, mode: RecommendationMode) {
  const text = `${candidate.title} ${candidate.description}`;
  const clues = mode === "light" ? ["입문", "짧은 팁", "기초", "시작하기", "beginner", "quick tip"] : mode === "deep" ? ["분석", "가이드", "심층", "해설", "analysis", "guide"] : [];
  const clue = clues.find((word) => text.toLowerCase().includes(word));
  if (clue) return `제목과 설명에 ‘${clue}’라는 단서가 있어 골랐어요. 본문은 확인하지 않았어요.`;
  return `${candidate.savedDays === 0 ? "오늘" : `${candidate.savedDays}일 전에`} 저장한 미완독 글이에요. ${candidate.isFavorite ? "즐겨찾기에 담아둔 관심을 다시 이어가 보세요." : "제목과 설명만으로는 글의 깊이나 읽는 시간을 알기 어려워요."}`;
}
export function fallbackRecommendation(input: RecommendationRequest, now = new Date()) {
  const [oldest] = candidatesFor({...input,mode:"balanced"}, now);
  if (!oldest) return null;
  return { selectedBookmarkId: oldest.id, reason: `${oldest.savedDays === 0 ? "오늘" : `${oldest.savedDays}일 전에`} 저장한 미완독 글 중 오래된 글부터 골랐어요. 본문을 확인하지 않은 기본 추천이에요.`, source: "fallback" as const, generatedAt: now.toISOString() };
}
