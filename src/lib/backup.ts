import { bookmarkBackupSchema, bookmarkSchema } from "@/lib/schemas";
import { BACKUP_SCHEMA_VERSION, MAX_IMPORT_BYTES, MAX_BOOKMARKS } from "@/lib/constants";
import { parseBookmarkUrl } from "@/lib/url";
import type { Bookmark } from "@/types/library";

export function parseBackup(text:string) {
  if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw new Error("JSON 파일은 5 MB 이하로 선택해 주세요.");
  let json:unknown;
  try{json=JSON.parse(text.replace(/^\uFEFF/,""));}catch{throw new Error("올바른 JSON 파일이 아니에요.");}
  const result=bookmarkBackupSchema.safeParse(json);
  if(!result.success)throw new Error("오늘한입 백업 형식이나 필드가 올바르지 않아요. 기존 서재는 그대로 유지돼요.");
  return result.data.bookmarks.map(b=>{
    const parsed=parseBookmarkUrl(b.url);
    return bookmarkSchema.parse({...b,url:parsed.url,normalizedUrl:parsed.normalizedUrl,metadataStatus:b.metadataStatus==="pending"?"failed":b.metadataStatus});
  });
}

export function mergeBackup(existing:Bookmark[],incoming:Bookmark[],newId:()=>string) {
  const urls=new Set(existing.map(b=>parseBookmarkUrl(b.url).normalizedUrl));
  const ids=new Set(existing.map(b=>b.id));const additions:Bookmark[]=[];let skipped=0;
  for(const bookmark of incoming){
    const parsed=parseBookmarkUrl(bookmark.url);
    if(urls.has(parsed.normalizedUrl)){skipped++;continue;}
    let id=bookmark.id;
    if(ids.has(id)){id=newId();if(ids.has(id))throw new Error("항목 식별자를 만들지 못했어요. 다시 시도해 주세요.");}
    additions.push({...bookmark,id,normalizedUrl:parsed.normalizedUrl});urls.add(parsed.normalizedUrl);ids.add(id);
  }
  if(existing.length+additions.length>MAX_BOOKMARKS)throw new Error("서재의 최대 10,000개를 넘어요. 기존 데이터는 그대로 유지돼요.");
  return {additions,added:additions.length,skipped};
}
export function serializeBackup(bookmarks:Bookmark[],now=new Date()) {
  // 스키마에 선언된 사용자 데이터만 허용합니다. 환경변수나 추천 요청 정보는 포함하지 않습니다.
  const data=bookmarkBackupSchema.parse({schemaVersion:BACKUP_SCHEMA_VERSION,exportedAt:now.toISOString(),bookmarks});
  const text=JSON.stringify(data,null,2);
  if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw new Error("백업이 5 MB를 넘어요. 일부 글을 정리한 후 다시 시도해 주세요.");
  return text;
}
