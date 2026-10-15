"use client";

import { useState } from "react";
import type { Bookmark } from "@/types/library";

const palettes = [
  { background: "#eee7da", foreground: "#34332c" },
  { background: "#dce1d7", foreground: "#303a32" },
  { background: "#edc5ae", foreground: "#51352b" },
  { background: "#e7e1d8", foreground: "#3c3630" },
  { background: "#e9dace", foreground: "#493d34" },
];
export function BookmarkCover({ bookmark, priority = false }: { bookmark: Bookmark; priority?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hash = Array.from(bookmark.domain).reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0);
  const colors = palettes[hash % palettes.length];
  const showImage = bookmark.ogImageUrl && bookmark.ogImageUrl !== failedUrl;
  return (
    <div className="cover" style={{ background: colors.background, color: colors.foreground }}>
      {showImage ? (
        // 외부 이미지는 일반 img로 표시하고, 실패하면 텍스트 커버로 전환합니다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bookmark.ogImageUrl!} alt="" width={800} height={450} loading={priority ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setFailedUrl(bookmark.ogImageUrl)} />
      ) : (
        <div className="text-cover" aria-hidden="true">
          <span className="cover-kicker">hanip / collection</span>
          <span className="cover-title">{bookmark.title}</span>
          <span className="cover-domain">{bookmark.domain}</span>
        </div>
      )}
    </div>
  );
}
