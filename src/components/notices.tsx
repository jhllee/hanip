"use client";
import { X, Undo2 } from "lucide-react";
import { useNotices,dismissNotice,undoNotice } from "@/store/notifications";
export function Notices(){const items=useNotices(s=>s.items);return <div className="notice-stack" aria-label="서재 알림">{items.map(item=><div key={item.id} className="notice"><p role="status">{item.message}</p>{item.undo&&<button className="notice-undo" onClick={()=>undoNotice(item.id)}><Undo2 size={15}/>실행 취소</button>}<button className="icon-button" aria-label={`${item.message} 알림 닫기`} onClick={()=>dismissNotice(item.id)}><X size={16}/></button></div>)}</div>;}
