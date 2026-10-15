import { httpUrlSchema } from "@/lib/schemas";

const trackingKeys = new Set(["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "_ga", "_gl"]);

export function parseBookmarkUrl(input: string) {
  const text = input.trim();
  if (!text || /[\s\u0000-\u001f\u007f\\]/u.test(text)) throw new Error("올바른 글 주소를 입력해 주세요.");
  // 프로토콜이 없는 도메인만 보완합니다. 임의 스킴과 상대 경로는 거절합니다.
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(text) && !/^[^/:]+\.[^/:]+:\d+(?:[/?#]|$)/.test(text);
  const candidate = hasScheme ? text : text.startsWith("//") ? `https:${text}` : `https://${text}`;
  const validated = httpUrlSchema.safeParse(candidate);
  if (!validated.success) throw new Error("http 또는 https 글 주소를 입력해 주세요.");
  const url = new URL(validated.data);
  if (!url.hostname.includes(".") && !url.hostname.startsWith("[")) throw new Error("도메인이 포함된 글 주소를 입력해 주세요.");
  if (url.hostname.length > 253 || !httpUrlSchema.safeParse(url.toString()).success) throw new Error("글 주소가 너무 길어요. 주소를 확인해 주세요.");
  const originalUrl = url.toString();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || trackingKeys.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  return { url: originalUrl, normalizedUrl: url.toString(), domain: url.hostname.replace(/^www\./, "") };
}

export const MAX_TXT_BYTES = 256 * 1024;
export const MAX_TXT_LINKS = 100;
export type TxtPreview = {
  urls: ReturnType<typeof parseBookmarkUrl>[];
  duplicates: number;
  invalidLines: { line: number; text: string }[];
  total: number;
};

export function previewTxt(text: string, existingUrls: Iterable<string>): TxtPreview {
  if (new TextEncoder().encode(text).length > MAX_TXT_BYTES) throw new Error("TXT 파일은 256 KB 이하로 선택해 주세요.");
  if (text.includes("\0")) throw new Error("UTF-8 텍스트 파일을 선택해 주세요.");
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).map((value, index) => ({ text: value.trim(), line: index + 1 })).filter((item) => item.text);
  if (lines.length > MAX_TXT_LINKS) throw new Error("한 번에 최대 100줄까지 가져올 수 있어요.");
  const seen = new Set(existingUrls);
  const preview: TxtPreview = { urls: [], duplicates: 0, invalidLines: [], total: lines.length };
  for (const line of lines) {
    try {
      const item = parseBookmarkUrl(line.text);
      if (seen.has(item.normalizedUrl)) preview.duplicates++;
      else { seen.add(item.normalizedUrl); preview.urls.push(item); }
    } catch { preview.invalidLines.push({ ...line, text: line.text.slice(0, 160) }); }
  }
  return preview;
}
