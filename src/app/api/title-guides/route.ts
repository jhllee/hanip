import { guideRequestSchema } from "@/lib/schemas";
import { titleGuides } from "@/lib/server/ai-guide";
export const runtime="nodejs";
export async function POST(request:Request) {
  const reader=request.body?.getReader(); if(!reader)return Response.json({error:"제목을 확인해 주세요."},{status:400});
  const timer=setTimeout(()=>{void reader.cancel().catch(()=>{});},3000);
  try {
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16*1024){void reader.cancel().catch(()=>{});return Response.json({error:"요청이 너무 커요."},{status:413});}chunks.push(value);}
    const parsed=guideRequestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));if(!parsed.success)return Response.json({error:"제목을 확인해 주세요."},{status:400});
    clearTimeout(timer);return Response.json(await titleGuides(parsed.data.items),{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({items:[],available:false});}finally{clearTimeout(timer);}
}
