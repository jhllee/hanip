"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="error-page">
      <span className="boot-brand">hanip.</span>
      <p className="eyebrow">오늘한입</p>
      <h1>서재를 잠시 펼치지 못했어요.</h1>
      <p>저장한 글을 다시 불러올 수 있도록 잠시 후 다시 시도해 주세요.</p>
      <div className="error-actions"><button className="button" onClick={reset}>다시 시도</button><button className="button button-secondary" onClick={()=>window.location.reload()}>페이지 새로고침</button></div>
    </main>
  );
}
