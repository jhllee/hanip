"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
export function DomainIcon({ url }: { url: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return <Globe size={14} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={14} height={14} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} />;
}
