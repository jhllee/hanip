"use client";
import { z } from "zod";
import { aiGuideSchema } from "@/lib/schemas";
import { useLibrary } from "@/store/library";
import { canGuideTitle } from "@/lib/reading-topics";
const responseSchema=z.object({available:z.boolean(),items:z.array(z.object({id:z.string(),guide:aiGuideSchema.nullable()})).max(10)});
const attempted=new Set<string>();let running=false;
export async function requestVisibleGuides(ids:string[]) {
  if(running)return;
  const items=useLibrary.getState().bookmarks.filter(b=>ids.includes(b.id) && !b.description.trim() && !b.aiGuide && b.metadataStatus!=="pending" && canGuideTitle(b.title,b.domain) && !attempted.has(`${b.id}:${b.title}`)).slice(0,10);
  if(!items.length)return;running=true;items.forEach(b=>attempted.add(`${b.id}:${b.title}`));
  try {
    const response=await fetch("/api/title-guides",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:items.map(({id,title,domain})=>({id,title,domain}))}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)return;const data=responseSchema.parse(await response.json());
    for(const result of data.items){const current=useLibrary.getState().bookmarks.find(b=>b.id===result.id);const original=items.find(b=>b.id===result.id);
      if(result.guide && current && original && !current.description.trim() && current.title===original.title && result.guide.titleBasis===current.title)useLibrary.getState().updateBookmark(current.id,{aiGuide:result.guide});
    }
  }catch{/* 안내 실패로 원문 읽기와 완독을 막지 않습니다. */}finally{running=false;}
}
