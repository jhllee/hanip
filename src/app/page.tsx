"use client";

import dynamic from "next/dynamic";

const LibraryApp = dynamic(() => import("@/components/library-app"), {
  ssr: false,
  loading: () => (
    <div className="boot-state" role="status"><span className="boot-brand">hanip.</span><p>서재를 준비하고 있어요…</p></div>
  ),
});

export default function Home() {
  return <LibraryApp />;
}
