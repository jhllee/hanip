import "server-only";
import * as cheerio from "cheerio";
import { bookmarkMetadataSchema, httpUrlSchema } from "@/lib/schemas";

function clean(value: string | undefined, max: number) {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export function absoluteWebUrl(value: string | undefined, base: string) {
  if (!value?.trim()) return null;
  try {
    const parsed = httpUrlSchema.safeParse(new URL(value.trim(), base).toString());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
export function parseMetadata(body: Buffer, finalUrl: string, contentType = "") {
  const charset = /charset\s*=\s*["\']?([^;"\'\s]+)/i.exec(contentType)?.[1];
  const $ = cheerio.loadBuffer(body, { encoding: { defaultEncoding: "utf-8", transportLayerEncodingLabel: charset } });
  const meta = (key: string) => {
    const element = $("meta").toArray().find((item) => ($(item).attr("property") ?? $(item).attr("name"))?.toLowerCase() === key);
    return element ? $(element).attr("content") : undefined;
  };
  const domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  const favicon = $("link").toArray().find((item) => ($(item).attr("rel") ?? "").toLowerCase().split(/\s+/).includes("icon"));
  return bookmarkMetadataSchema.parse({
    title: clean(meta("og:title"), 1000) || clean($("title").first().text(), 1000) || domain,
    description: clean(meta("og:description"), 5000) || clean(meta("description"), 5000),
    domain,
    ogImageUrl: absoluteWebUrl(meta("og:image"), finalUrl) ?? absoluteWebUrl(meta("twitter:image"), finalUrl),
    faviconUrl: absoluteWebUrl(favicon ? $(favicon).attr("href") : undefined, finalUrl) ?? absoluteWebUrl("/favicon.ico", finalUrl),
  });
}
