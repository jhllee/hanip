import { recommendationRequestSchema } from "@/lib/schemas";
import { recommend } from "@/lib/server/recommendation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return Response.json({error:"추천할 글을 보내 주세요."},{status:400});
  const timer = setTimeout(() => { void reader.cancel().catch(()=>{}); },3_000);
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const {done,value} = await reader.read(); if(done) break;
      size += value.byteLength;
      if(size > 2*1024*1024) { void reader.cancel().catch(()=>{}); return Response.json({error:"추천 요청이 너무 커요."},{status:413}); }
      chunks.push(value);
    }
    const parsed = recommendationRequestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if(!parsed.success) return Response.json({error:"추천 요청을 확인해 주세요."},{status:400});
    clearTimeout(timer);
    const result = await recommend(parsed.data);
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({error:"추천 요청을 읽지 못했어요."},{status:400}); }
  finally { clearTimeout(timer); }
}
