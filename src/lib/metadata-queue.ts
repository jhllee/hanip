"use client";

import { useLibrary } from "@/store/library";
import { bookmarkMetadataSchema } from "@/lib/schemas";

const queued = new Set<string>();
let queue = Promise.resolve();

export function enqueueMetadata(id: string) {
  if (queued.has(id)) return;
  const bookmark = useLibrary.getState().bookmarks.find((item) => item.id === id);
  if (!bookmark) return;
  queued.add(id);
  if (bookmark.metadataStatus !== "pending") useLibrary.getState().updateBookmark(id, { metadataStatus: "pending" });
  queue = queue.then(async () => {
    const current = useLibrary.getState().bookmarks.find((item) => item.id === id);
    if (!current || current.url !== bookmark.url) return;
    try {
      const response = await fetch("/api/metadata", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: current.url }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("Metadata unavailable");
      const metadata = bookmarkMetadataSchema.parse(await response.json());
      const latest = useLibrary.getState().bookmarks.find((item) => item.id === id);
      if (latest?.url === current.url) useLibrary.getState().updateBookmark(id, { ...metadata, metadataStatus: "ready" });
    } catch {
      const latest = useLibrary.getState().bookmarks.find((item) => item.id === id);
      if (latest?.url === current.url) useLibrary.getState().updateBookmark(id, { metadataStatus: "failed" });
    }
  }).catch(() => {
    // 사용자 데이터가 바뀌어도 이후 항목의 대기는 계속 진행합니다.
  }).finally(() => { queued.delete(id); });
}

export function resumePendingMetadata() {
  for (const bookmark of useLibrary.getState().bookmarks) {
    if (bookmark.metadataStatus === "pending") enqueueMetadata(bookmark.id);
  }
}
