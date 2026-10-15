"use client";

import { recommendationKey, type ReadingTopic } from "@/lib/reading-topics";
import { create } from "zustand";
import { useLibrary } from "@/store/library";
import { localDateKey } from "@/lib/library-data";
import { fallbackRecommendation, candidatesFor } from "@/lib/recommendation";
import { recommendationResponseSchema } from "@/lib/schemas";
import type { Bookmark, DailyRecommendation, RecommendationMode } from "@/types/library";

type Library = { bookmarks: Bookmark[]; recommendations: DailyRecommendation[]; saveRecommendation: (value:DailyRecommendation)=>void };
export const useRecommendationStatus = create<{pending: string[]}>(()=>({pending:[]}));
export function createRecommendationController(deps: {
  getLibrary: ()=>Library; fetcher: typeof fetch; now?: ()=>Date;
  onPending?: (keys:string[])=>void;
}) {
  const pending = new Map<string, {promise: Promise<void>; openedBookmarkId?: string}>();
  const now = deps.now ?? (()=>new Date());
  return {
    markOpened(bookmarkId: string) {
      // 목록·추천 어디에서 원문을 열어도 진행 중인 해당 추천의 읽기 대상을 유지합니다.
      for (const [key, request] of pending) {
        const cached = deps.getLibrary().recommendations.find(r=>recommendationKey(r.dateKey,r.mode,r.topic??null)===key);
        if (cached?.selectedBookmarkId===bookmarkId) request.openedBookmarkId=bookmarkId;
      }
    },
    request(mode: RecommendationMode, dateKey: string, force = false, topic: ReadingTopic|null = null): Promise<void> {
      const key = recommendationKey(dateKey,mode,topic);
      const running = pending.get(key); if(running) return running.promise;
      const library = deps.getLibrary();
      const cached = library.recommendations.find((r)=>r.dateKey===dateKey && r.mode===mode && (r.topic??null)===topic);
      if(!force && cached && library.bookmarks.some((b)=>b.id===cached.selectedBookmarkId)) return Promise.resolve();
      const unread = library.bookmarks.filter((b)=>!b.isRead);
      if(!unread.length || dateKey!==localDateKey(now())) return Promise.resolve();
      const input = {
        mode, topic,
        bookmarks: unread.map(({id,title,description,createdAt,isRead,isFavorite})=>({id,title,description,createdAt,isRead,isFavorite})),
        ...(force && cached ? {excludeBookmarkId:cached.selectedBookmarkId}:{}),
      };
      const initial = fallbackRecommendation(input,now());
      if(!initial) return Promise.resolve();
      const request: {promise: Promise<void>; openedBookmarkId?: string} = {promise: Promise.resolve()};
      const task = Promise.resolve().then(async()=>{
        let result: ReturnType<typeof recommendationResponseSchema.parse> | null;
        try {
          const response = await deps.fetcher("/api/recommendation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:AbortSignal.timeout(15_000)});
          if(!response.ok) throw new Error("Unavailable");
          result = recommendationResponseSchema.parse(await response.json());
          const selectedId = result.selectedBookmarkId;
          if(!candidatesFor(input,now()).some((b)=>b.id===selectedId)) throw new Error("Invalid candidate");
        } catch { result = null; }
        if(dateKey!==localDateKey(now())) return;
        const latest = deps.getLibrary();
        const currentCache = latest.recommendations.find((r)=>r.dateKey===dateKey && r.mode===mode && (r.topic??null)===topic);
        // 요청 도중 완독한 추천은 완료 화면으로 유지합니다.
        if(currentCache && latest.bookmarks.find((b)=>b.id===currentCache.selectedBookmarkId)?.isRead) return;
        if(currentCache && request.openedBookmarkId===currentCache.selectedBookmarkId && latest.bookmarks.some(b=>b.id===request.openedBookmarkId)) return;
        // 요청 이후 다른 동작으로 바뀐 캐시를 늦은 응답이 덮어쓰지 않습니다.
        if(currentCache && (currentCache.selectedBookmarkId!==initial.selectedBookmarkId || currentCache.generatedAt!==initial.generatedAt)) return;
        const resultId = result?.selectedBookmarkId;
        if(!result || !latest.bookmarks.some((b)=>b.id===resultId && !b.isRead)) {
          result = fallbackRecommendation({...input,bookmarks:latest.bookmarks},now());
        }
        if(result) {
          latest.saveRecommendation({...result,dateKey,mode,topic});
        }
      }).finally(()=>{pending.delete(key);deps.onPending?.([...pending.keys()]);});
      request.promise=task;
      pending.set(key,request); deps.onPending?.([...pending.keys()]);
      // AI를 기다리지 않고 즉시 읽을 수 있는 기본 추천을 저장합니다.
      library.saveRecommendation({...initial,dateKey,mode,topic});
      return task;
    },
  };
}
export const recommendationController = createRecommendationController({
  getLibrary:()=>useLibrary.getState(),fetcher:(...args)=>fetch(...args),
  onPending:(pending)=>useRecommendationStatus.setState({pending}),
});
