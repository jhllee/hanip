import type { Bookmark } from "@/types/library";
export function BookmarkDescription({bookmark,featured=false}:{bookmark:Bookmark;featured?:boolean}) {
  const original=bookmark.description.trim();
  const guide=!original && bookmark.aiGuide?.titleBasis===bookmark.title ? bookmark.aiGuide : null;
  return <div className={featured?"featured-description":"description-block"}>
    <p className={featured?"recommendation-description line-clamp-3":"card-description line-clamp-2"}>{original || guide?.text || (bookmark.metadataStatus==="pending"?"제목과 설명을 확인하고 있어요.":"원문에서 내용을 확인해 주세요.")}</p>
    {guide && <span className="ai-guide-label" title="본문을 읽거나 요약한 설명이 아니에요. 제목에 있는 주제를 안내해요.">AI 안내 · 제목 기준</span>}
  </div>;
}
