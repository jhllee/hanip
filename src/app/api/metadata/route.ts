import { metadataRequestSchema } from "@/lib/schemas";
import { fetchSafeHtml, MetadataError } from "@/lib/server/safe-fetch";
import { parseMetadata } from "@/lib/server/metadata";

export const runtime = "nodejs";
const MAX_INPUT_BYTES = 8 * 1024;
let activeRequests = 0;

let windowStart = Date.now();
let windowRequests = 0;

async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing body");
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new MetadataError("INPUT_TIMEOUT", "요청을 읽는 데 시간이 오래 걸려 중단했어요."));
      void reader.cancel().catch(() => {});
    }, 3_000);
  });
  const read = async () => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_INPUT_BYTES) {
        void reader.cancel().catch(() => {});
        throw new MetadataError("INPUT_TOO_LARGE", "요청이 너무 커요.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
  try { return await Promise.race([read(), deadline]); }
  finally { clearTimeout(timer!); }
}

export async function POST(request: Request) {
  if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); windowRequests = 0; }
  if (activeRequests >= 8 || windowRequests >= 240) return Response.json({ error: "요청이 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429, headers: { "Retry-After": "60" } });
  windowRequests++;
  activeRequests++;
  try {
    const input = metadataRequestSchema.safeParse(await readJson(request));
    if (!input.success) return Response.json({ error: "올바른 URL을 입력해 주세요." }, { status: 400 });
    const result = await fetchSafeHtml(input.data.url);
    return Response.json(parseMetadata(result.body, result.finalUrl, result.contentType), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
    if (error instanceof MetadataError) return Response.json({ error: error.message, code: error.code }, { status: error.code === "INPUT_TOO_LARGE" ? 413 : error.code === "INPUT_TIMEOUT" ? 408 : error.code === "BLOCKED_URL" || error.code === "INVALID_URL" ? 400 : error.code === "TIMEOUT" ? 504 : 422 });
    return Response.json({ error: "글 정보를 가져오지 못했어요. 저장한 링크는 유지돼요." }, { status: 502 });
  } finally { activeRequests--; }
}
