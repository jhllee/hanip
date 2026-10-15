"use client";
import { create } from "zustand";
import { useLibrary } from "@/store/library";

type Notice={id:number;message:string;undo?:()=>boolean};
let sequence=0;
export const useNotices=create<{items:Notice[]}>(()=>({items:[]}));
export function notify(message:string,undo?:()=>boolean){const id=++sequence;useNotices.setState(s=>({items:[...s.items,{id,message,undo}].slice(-3)}));}
export function dismissNotice(id:number){useNotices.setState(s=>({items:s.items.filter(n=>n.id!==id)}));}
export function undoNotice(id:number){const item=useNotices.getState().items.find(n=>n.id===id);if(!item?.undo)return;const success=item.undo();dismissNotice(id);if(!success)notify("이후 변경이 있어 되돌리지 못했어요. 현재 서재를 확인해 주세요.");}
export function changeRead(id:string,isRead:boolean){
  const store=useLibrary.getState();const before=store.bookmarks.find(b=>b.id===id);if(!before||before.isRead===isRead)return;
  store.setRead(id,isRead);const applied=useLibrary.getState().bookmarks.find(b=>b.id===id)!;
  notify(isRead?"오늘의 한입, 잘 읽었어요.":"읽을거리로 다시 옮겼어요.",()=>{
    const latest=useLibrary.getState().bookmarks.find(b=>b.id===id);
    if(!latest||latest.isRead!==applied.isRead||latest.readAt!==applied.readAt)return false;
    useLibrary.getState().updateBookmark(id,{isRead:before.isRead,readAt:before.readAt});return true;
  });
}
export function deleteBookmark(id:string){
  const store=useLibrary.getState();const bookmark=store.bookmarks.find(b=>b.id===id);if(!bookmark)return;
  const recommendations=store.recommendations.filter(r=>r.selectedBookmarkId===id);
  store.removeBookmark(id);
  notify("서재에서 글을 삭제했어요.",()=>useLibrary.getState().restoreBookmark(bookmark.metadataStatus==="pending"?{...bookmark,metadataStatus:"failed"}:bookmark,recommendations));
}
