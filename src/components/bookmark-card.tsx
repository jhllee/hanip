"use client";

import { Check, ExternalLink, Heart, RefreshCw, Trash2, LoaderCircle } from "lucide-react";
import { changeRead, deleteBookmark } from "@/store/notifications";
import { useLibrary } from "@/store/library";
import { recommendationController } from "@/lib/recommendation-client";
import { enqueueMetadata } from "@/lib/metadata-queue";
import { savedLabel } from "@/lib/library-data";
import type { Bookmark } from "@/types/library";
import { BookmarkCover } from "./bookmark-cover";
import { BookmarkDescription } from "./bookmark-description";
import { DomainIcon } from "./domain-icon";

export function originalLinkEvents(bookmarkId: string) {
  const markOpened = () => recommendationController.markOpened(bookmarkId);
  return { onClick: markOpened, onAuxClick: markOpened, onContextMenu: markOpened };
}

export function BookmarkCard({ bookmark, compact = false }: { bookmark: Bookmark; compact?: boolean }) {
  const setRead = changeRead;
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  return (
    <article className={compact ? "bookmark-card bookmark-row" : "bookmark-card"}>
      {!compact && <a className="cover-link" href={bookmark.url} {...originalLinkEvents(bookmark.id)} target="_blank" rel="noopener noreferrer" aria-label={`${bookmark.title} 원문 새 탭에서 읽기`}><BookmarkCover bookmark={bookmark} /></a>}
      <div className="card-body">
        <h3 className="line-clamp-2"><a href={bookmark.url} {...originalLinkEvents(bookmark.id)} target="_blank" rel="noopener noreferrer">{bookmark.title}</a></h3>
        <p className="eyebrow card-domain"><DomainIcon url={bookmark.faviconUrl} /><span className="truncate">{bookmark.domain}</span></p>
        <BookmarkDescription bookmark={bookmark} />
        <p className="saved-label">{bookmark.isRead && bookmark.readAt ? `${new Intl.DateTimeFormat("ko-KR", {month:"long",day:"numeric"}).format(new Date(bookmark.readAt))} 완독` : savedLabel(bookmark.createdAt)}</p>
        {bookmark.metadataStatus === "failed" && <div className="metadata-status"><span>글 정보를 가져오지 못했어요.</span><button className="text-button" aria-label={`${bookmark.title} 글 정보 다시 가져오기`} onClick={() => enqueueMetadata(bookmark.id)}><RefreshCw size={13} />다시 시도</button></div>}
        {bookmark.metadataStatus === "pending" && <p className="metadata-status" role="status"><LoaderCircle size={13} className="loading-icon" />글 정보를 확인하고 있어요.</p>}
        <div className="card-actions">
          <a className="text-button" href={bookmark.url} {...originalLinkEvents(bookmark.id)} target="_blank" rel="noopener noreferrer">{bookmark.isRead ? "다시 읽기" : "원문 읽기"} <ExternalLink size={14} aria-hidden="true" /></a>
          <button className={`icon-button ${bookmark.isRead ? "is-active" : ""}`} aria-label={bookmark.isRead ? `${bookmark.title} 완독 취소` : `${bookmark.title} 완독`} aria-pressed={bookmark.isRead} onClick={() => setRead(bookmark.id, !bookmark.isRead)}><Check size={18} /></button>
          <button className={`icon-button ${bookmark.isFavorite ? "is-active" : ""}`} aria-label={`${bookmark.title} 즐겨찾기 ${bookmark.isFavorite ? "해제" : "추가"}`} aria-pressed={bookmark.isFavorite} onClick={() => toggleFavorite(bookmark.id)}><Heart size={18} fill={bookmark.isFavorite ? "currentColor" : "none"} /></button>
          <button className="icon-button delete-button" aria-label={`${bookmark.title} 삭제`} onClick={()=>deleteBookmark(bookmark.id)}><Trash2 size={17}/></button>
        </div>
      </div>
    </article>
  );
}

