import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { httpUrlSchema } from "@/lib/schemas";

export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const METADATA_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 5;
export class MetadataError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export function isPublicIp(address: string) {
  try { return ipaddr.process(address).range() === "unicast"; }
  catch { return false; }
}
export type Address = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<Address[]>;
const resolve: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

export async function validateTarget(input: string, resolver: Resolver = resolve) {
  const parsed = httpUrlSchema.safeParse(input);
  if (!parsed.success) throw new MetadataError("INVALID_URL", "올바른 http 또는 https 주소가 아니에요.");
  const url = new URL(parsed.data);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname === "localhost" || /\.(localhost|local|internal|lan|home|test|invalid)$/.test(hostname) || (!hostname.includes(".") && !isIP(hostname))) throw new MetadataError("BLOCKED_URL", "외부에 공개된 글 주소만 가져올 수 있어요.");
  if (url.port && !["80", "443"].includes(url.port)) throw new MetadataError("BLOCKED_URL", "일반 웹 포트의 글 주소만 가져올 수 있어요.");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolver(hostname);
  if (!addresses.length || addresses.some((item) => !isPublicIp(item.address))) throw new MetadataError("BLOCKED_URL", "외부에 공개된 글 주소만 가져올 수 있어요.");
  return { url, address: addresses[0] };
}

export function requestPage(url: URL, address: Address, signal: AbortSignal): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolvePage, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(url, {
      method: "GET", agent: false, signal, family: address.family,
      // 검증된 IP로 연결을 고정합니다. Host 및 TLS 인증서는 원래 도메인을 사용합니다.
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      maxHeaderSize: 16 * 1024,
      headers: { "User-Agent": "OneulHanip/0.1 Metadata", Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
    }, (res) => {
      const status = res.statusCode ?? 0;
      const headers = res.headers;
      res.on("error", reject);
      res.on("aborted", () => reject(new MetadataError("NETWORK", "글 정보 요청이 중단됐어요.")));
      if ([301, 302, 303, 307, 308].includes(status)) {
        resolvePage({ status, headers, body: Buffer.alloc(0) });
        res.destroy();
        return;
      }
      if (status < 200 || status >= 300) {
        reject(new MetadataError("HTTP_ERROR", "페이지에서 글 정보를 가져오지 못했어요.")); res.destroy(); return;
      }
      if (!/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(headers["content-type"] ?? "")) {
        reject(new MetadataError("NOT_HTML", "HTML 페이지의 글 정보만 가져올 수 있어요.")); res.destroy(); return;
      }
      if ((headers["content-encoding"] && headers["content-encoding"] !== "identity") || Number(headers["content-length"] ?? 0) > MAX_HTML_BYTES) {
        reject(new MetadataError("TOO_LARGE", "페이지가 너무 크거나 지원하지 않는 압축 형식이에요.")); res.destroy(); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) { reject(new MetadataError("TOO_LARGE", "페이지가 너무 커서 글 정보를 가져오지 못했어요.")); res.destroy(); }
        else chunks.push(chunk);
      });
      res.on("end", () => resolvePage({ status, headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

type Dependencies = { resolver?: Resolver; request?: typeof requestPage; timeoutMs?: number };
export async function fetchSafeHtml(input: string, dependencies: Dependencies = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? METADATA_TIMEOUT_MS);
  // DNS 대기까지 포함해 전체 요청에 제한 시간을 적용합니다.
  const deadline = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new MetadataError("TIMEOUT", "시간이 오래 걸려 글 정보 가져오기를 중단했어요.")), { once: true });
  });
  const work = async () => {
    let target = input;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const { url, address } = await validateTarget(target, dependencies.resolver);
      controller.signal.throwIfAborted();
      const result = await (dependencies.request ?? requestPage)(url, address, controller.signal);
      if ([301, 302, 303, 307, 308].includes(result.status)) {
        if (!result.headers.location || redirects === MAX_REDIRECTS) throw new MetadataError("REDIRECT", "이동할 페이지를 확인하지 못했어요.");
        target = new URL(result.headers.location, url).toString();
        continue;
      }
      return { body: result.body, finalUrl: url.toString(), contentType: result.headers["content-type"] ?? "" };
    }
    throw new MetadataError("REDIRECT", "페이지 이동이 너무 많아요.");
  };
  try { return await Promise.race([work(), deadline]); }
  finally { clearTimeout(timer); }
}
