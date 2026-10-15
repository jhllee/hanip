"use client";

import { useRef, useState, type RefObject } from "react";
import { FileUp, Plus, X } from "lucide-react";
import { MAX_BOOKMARKS } from "@/lib/constants";
import { parseBookmarkUrl, previewTxt, MAX_TXT_BYTES, type TxtPreview } from "@/lib/url";
import { enqueueMetadata } from "@/lib/metadata-queue";
import { useLibrary, useStorageStatus } from "@/store/library";
import type { Bookmark } from "@/types/library";

function createBookmark(item: ReturnType<typeof parseBookmarkUrl>): Bookmark {
  return { ...item, id: crypto.randomUUID(), title: item.domain, description: "", faviconUrl: null, ogImageUrl: null, createdAt: new Date().toISOString(), isRead: false, isFavorite: false, readAt: null, metadataStatus: "pending" };
}

export function SaveLinks({ inputRef, onSaved, onClose }: { inputRef: RefObject<HTMLInputElement | null>; onSaved: () => void; onClose?: () => void }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<TxtPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useStorageStatus((s) => s.hydrated);
  const disabled = !hydrated || reading;
  const announce = (added: number, skipped = 0, invalid = 0) => {
    const failed = useStorageStatus.getState().error;
    setMessage(`${added}개의 글을 ${failed ? "이 창에 추가했어요" : "저장했어요"}.${skipped ? ` 중복 ${skipped}개는 건너뛰었어요.` : ""}${invalid ? ` 올바르지 않은 줄 ${invalid}개도 건너뛰었어요.` : ""} 글 정보는 차례로 확인해요.`);
  };
  const saveOne = (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const item = createBookmark(parseBookmarkUrl(url));
      if (useLibrary.getState().bookmarks.some((b) => b.normalizedUrl === item.normalizedUrl)) { setError("이미 서재에 있는 글이에요. 읽을거리에서 찾아보세요."); return; }
      if (useLibrary.getState().bookmarks.length >= MAX_BOOKMARKS) throw new Error("서재에는 최대 10,000개의 글을 담을 수 있어요.");
      useLibrary.getState().addBookmark(item);
      enqueueMetadata(item.id); setUrl(""); announce(1); onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "주소를 확인해 주세요."); }
  };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(""); setMessage(""); setPreview(null); setReading(true);
    try {
      if (!/\.txt$/i.test(file.name)) throw new Error(".txt 파일을 선택해 주세요.");
      if (file.size > MAX_TXT_BYTES) throw new Error("TXT 파일은 256 KB 이하로 선택해 주세요.");
      const bytes = await file.arrayBuffer();
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new Error("UTF-8로 저장된 TXT 파일을 선택해 주세요."); }
      const result = previewTxt(text, useLibrary.getState().bookmarks.map((b) => b.normalizedUrl));
      if (!result.total) throw new Error("파일이 비어 있어요. 한 줄에 링크 하나씩 넣어 주세요.");
      setFilename(file.name); setPreview(result);
    } catch (err) { setError(err instanceof Error ? err.message : "파일을 읽지 못했어요."); }
    finally { setReading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const saveBatch = () => {
    if (!preview) return;
    setError("");
    try {
      // 미리보기 이후 다른 저장이 있어도 현재 서재와 다시 중복 검사합니다.
      const existing = new Set(useLibrary.getState().bookmarks.map((b) => b.normalizedUrl));
      const items = preview.urls.filter((item) => !existing.has(item.normalizedUrl)).map(createBookmark);
      if (useLibrary.getState().bookmarks.length + items.length > MAX_BOOKMARKS) throw new Error("서재의 최대 10,000개를 넘어요. 파일의 링크 수를 줄여 주세요.");
      const result = useLibrary.getState().addBookmarks(items);
      items.forEach((item) => enqueueMetadata(item.id));
      announce(result.added, preview.duplicates + preview.urls.length - items.length + result.skipped, preview.invalidLines.length);
      setPreview(null); onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "글을 저장하지 못했어요."); }
  };
  return <div className="save-links">
    <form className="save-panel" aria-label="새 글 저장" onSubmit={saveOne}>
      <span className="save-icon"><Plus size={20} /></span><label className="sr-only" htmlFor="save-url">저장할 글의 URL</label><input ref={inputRef} id="save-url" type="text" inputMode="url" autoComplete="url" placeholder="읽고 싶은 글의 링크를 붙여넣으세요" aria-describedby="save-help" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={4096} disabled={disabled} /><button className="button" disabled={disabled || !url.trim()}>저장하기</button>{onClose && <button type="button" className="icon-button" aria-label="입력창 닫기" onClick={onClose} title="입력창 닫기"><X size={18} /></button>}
    </form>
    <div className="save-help-row"><p id="save-help" className="input-help">링크를 먼저 저장하고, 제목과 이미지는 차례로 가져와요.</p><input ref={fileRef} hidden id="txt-import" type="file" accept=".txt,text/plain" onChange={(e) => { void readFile(e.target.files?.[0]); }} tabIndex={-1} /><button className="text-button" disabled={disabled} onClick={() => fileRef.current?.click()}><FileUp size={15} />{reading ? "파일 확인 중…" : "TXT로 한 번에 담기"}</button></div>
    {error && <p className="save-error" role="alert">{error}</p>}
    {message && <p className="save-result" role="status">{message}</p>}
    {preview && <section className="txt-preview" aria-label="TXT 가져오기 미리보기"><div className="preview-heading"><h2>담을 링크를 확인해 주세요.</h2><button className="icon-button" aria-label="TXT 가져오기 취소" onClick={() => setPreview(null)}><X size={18} /></button></div><p className="preview-filename">{filename}</p><div className="preview-counts"><span><strong>{preview.urls.length}</strong> 새 링크</span><span><strong>{preview.duplicates}</strong> 중복</span><span><strong>{preview.invalidLines.length}</strong> 올바르지 않은 줄</span></div><p className="input-help">한 줄에 URL 하나 · 최대 100줄 · UTF-8 TXT 256 KB 이하<br />중복과 올바르지 않은 줄은 건너뛰고 기존 서재에 추가해요.</p>{preview.invalidLines.length > 0 && <details><summary>건너뛸 줄 확인하기</summary><ul>{preview.invalidLines.map((item) => <li key={item.line}>{item.line}번째 줄: {item.text}</li>)}</ul></details>}<div className="preview-url-list"><ul>{preview.urls.slice(0, 5).map((item) => <li key={item.normalizedUrl}>{item.url}</li>)}</ul>{preview.urls.length > 5 && <p>외 {preview.urls.length - 5}개</p>}</div><button className="button" disabled={!preview.urls.length} onClick={saveBatch}>{preview.urls.length}개 글 담기</button></section>}
  </div>;
}
