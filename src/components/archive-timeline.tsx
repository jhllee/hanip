"use client";

import { Check, ExternalLink, Heart, RotateCcw, Trash2 } from "lucide-react";
import { BookmarkCard } from "./bookmark-card";
import { BookmarkDescription } from "./bookmark-description";
import { DomainIcon } from "./domain-icon";
import { localDateKey } from "@/lib/library-data";
import { recommendationController } from "@/lib/recommendation-client";
import { useLibrary } from "@/store/library";
import { changeRead, deleteBookmark } from "@/store/notifications";
import type { Bookmark } from "@/types/library";

export function ArchiveTimeline({ bookmarks, layout, hideFirstHeading = false }: { bookmarks: Bookmark[]; layout: "cards" | "list"; hideFirstHeading?: boolean }) {
  const toggleFavorite = useLibrary(s => s.toggleFavorite);
  const groups = new Map<string, Bookmark[]>();
  // 부모가 정렬한 완독 일시 순서를 유지하며 사용자 로컬 날짜로 묶습니다.
  for (const bookmark of bookmarks) {
    if (!bookmark.isRead || !bookmark.readAt) continue;
    const key = localDateKey(new Date(bookmark.readAt));
    const group = groups.get(key) ?? [];
    group.push(bookmark);
    groups.set(key, group);
  }
  return <div className="archive-timeline">
    {[...groups].map(([dateKey, items], index) => <section className="archive-day" key={dateKey} aria-labelledby={`read-${dateKey}`}>
      <div className={hideFirstHeading && index === 0 ? "sr-only" : "archive-day-heading"}>
        <span className="archive-day-dot" aria-hidden="true" />
        <h2 id={`read-${dateKey}`}><time dateTime={dateKey}>{new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(items[0].readAt!))}</time></h2>
        <span>{items.length}편</span>
      </div>
      <div className={layout === "cards" ? "archive-entries bookmark-grid archive-card-grid" : "archive-entries archive-compact-list"}>
        {layout === "cards" ? items.map(bookmark=><BookmarkCard key={bookmark.id} bookmark={bookmark}/>) : items.map(bookmark => <article className="archive-entry" key={bookmark.id}>
          <div className="archive-entry-body">
            <p className="archive-read-date"><Check size={13} aria-hidden="true" />완독 · <time dateTime={bookmark.readAt!}>{new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(bookmark.readAt!))}</time></p>
            <h3>{bookmark.title}</h3>
            <p className="card-domain archive-domain"><DomainIcon url={bookmark.faviconUrl} /><span>{bookmark.domain}</span></p>
            <BookmarkDescription bookmark={bookmark} />
          </div>
          <div className="archive-entry-actions">
            <a className="button button-secondary archive-reread" href={bookmark.url} target="_blank" rel="noopener noreferrer" onClick={()=>recommendationController.markOpened(bookmark.id)}>다시 읽기 <ExternalLink size={14} aria-hidden="true" /></a>
            <div className="archive-secondary-actions">
              <button className="text-button" aria-label={`${bookmark.title} 완독 취소`} onClick={()=>changeRead(bookmark.id,false)}><RotateCcw size={14} />읽을거리로</button>
              <button className={`icon-button ${bookmark.isFavorite ? "is-active" : ""}`} aria-label={`${bookmark.title} 즐겨찾기 ${bookmark.isFavorite ? "해제" : "추가"}`} aria-pressed={bookmark.isFavorite} onClick={()=>toggleFavorite(bookmark.id)}><Heart size={17} fill={bookmark.isFavorite ? "currentColor" : "none"}/></button>
              <button className="icon-button delete-button" aria-label={`${bookmark.title} 삭제`} onClick={()=>deleteBookmark(bookmark.id)}><Trash2 size={16}/></button>
            </div>
          </div>
        </article>)}
      </div>
    </section>)}
  </div>;
}
