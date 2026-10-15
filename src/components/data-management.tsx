"use client";
import { useRef, useState } from "react";
import { Download, FileUp, Library, FlaskConical } from "lucide-react";
import { useLibrary, useStorageStatus } from "@/store/library";
import { parseBackup,mergeBackup,serializeBackup } from "@/lib/backup";
import { sampleBookmarks } from "@/lib/samples";
import { MAX_IMPORT_BYTES } from "@/lib/constants";
import { localDateKey } from "@/lib/library-data";
import { notify } from "@/store/notifications";
import type { Bookmark } from "@/types/library";

export function addSamples(){const result=useLibrary.getState().addBookmarks(sampleBookmarks());notify(result.added?`샘플 ${result.added}개를 담았어요. 기존 글은 그대로 유지돼요.`:"샘플이 이미 서재에 있어요.");return result;}
export function DataManagement(){
  const [error,setError]=useState("");const [result,setResult]=useState("");const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState<{name:string;bookmarks:Bookmark[];added:number;skipped:number}|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);const hydrated=useStorageStatus(s=>s.hydrated);
  const exportFile=()=>{setError("");setResult("");try{
    const text=serializeBackup(useLibrary.getState().bookmarks);const blob=new Blob([text],{type:"application/json;charset=utf-8"});const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download=`오늘한입-${localDateKey()}.json`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setResult("백업 파일을 내려받았어요.");
  }catch(e){setError(e instanceof Error?e.message:"백업을 만들지 못했어요.");}};
  const selectFile=async(file:File|undefined)=>{if(!file)return;setBusy(true);setError("");setResult("");setPreview(null);
    try{
      if(!/\.json$/i.test(file.name))throw new Error("오늘한입 JSON 백업 파일을 선택해 주세요.");
      if(file.size>MAX_IMPORT_BYTES)throw new Error("JSON 파일은 5 MB 이하로 선택해 주세요.");
      let text:string;try{text=new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer());}catch{throw new Error("UTF-8 JSON 파일을 선택해 주세요.");}
      const bookmarks=parseBackup(text);const merged=mergeBackup(useLibrary.getState().bookmarks,bookmarks,()=>crypto.randomUUID());
      setPreview({name:file.name,bookmarks,added:merged.added,skipped:merged.skipped});
    }catch(e){setError(e instanceof Error?e.message:"파일을 확인하지 못했어요.");}finally{setBusy(false);if(fileInput.current)fileInput.current.value="";}
  };
  const importFile=()=>{if(!preview)return;setError("");try{
    const merged=mergeBackup(useLibrary.getState().bookmarks,preview.bookmarks,()=>crypto.randomUUID());
    useLibrary.getState().addBookmarks(merged.additions);
    const suffix=useStorageStatus.getState().error?" 브라우저 저장에 실패했으니 백업 파일을 보관해 주세요.":"";
    setResult(`${merged.added}개를 가져왔어요. 중복 ${merged.skipped}개는 건너뛰었어요.${suffix}`);setPreview(null);
  }catch(e){setError(e instanceof Error?e.message:"가져오지 못했어요. 기존 서재는 유지돼요.");}};
  return <div className="data-management">
    <div className="settings-notice"><Library size={20}/><div><strong>나의 브라우저, 나의 서재</strong><p>브라우저 데이터를 삭제하면 저장한 글도 사라질 수 있어요. 가끔 백업해 두세요.</p></div></div>
    <section className="data-section"><h3>서재 백업</h3><p>저장한 글과 완독·즐겨찾기·AI 안내를 JSON 파일에 담아요. API 키는 포함하지 않아요.</p><div className="data-buttons"><button className="button button-secondary" disabled={!hydrated||busy} onClick={exportFile}><Download size={16}/>JSON 내보내기</button><button className="button button-secondary" disabled={!hydrated||busy} onClick={()=>fileInput.current?.click()}><FileUp size={16}/>{busy?"파일 확인 중…":"JSON 가져오기"}</button></div><input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={e=>{void selectFile(e.target.files?.[0]);}}/></section>
    {preview&&<section className="backup-preview" aria-label="JSON 가져오기 미리보기"><h3>가져올 글을 확인해 주세요.</h3><p className="preview-filename">{preview.name}</p><p>새 글 <strong>{preview.added}개</strong> · 중복 {preview.skipped}개</p><p className="input-help">기존 글은 덮어쓰지 않아요. 최대 5 MB의 오늘한입 백업을 가져올 수 있어요.</p><div className="data-buttons"><button className="button" disabled={!preview.added} onClick={importFile}>서재에 병합하기</button><button className="text-button" onClick={()=>setPreview(null)}>취소</button></div></section>}
    {error&&<p className="save-error" role="alert">{error}</p>}{result&&<p className="save-result" role="status">{result}</p>}
    <section className="data-section"><h3>가볍게 둘러보기</h3><p>설명이 있는 글, 텍스트 커버, 정보 가져오기 실패 사례 등 샘플 7개를 담아요. 여러 번 눌러도 같은 글은 다시 담지 않아요.</p><button className="button button-secondary" disabled={!hydrated||busy} onClick={()=>{setError("");try{const r=addSamples();setResult(`샘플 ${r.added}개 추가 · 중복 ${r.skipped}개 건너뜀`);}catch{setError("서재에 공간이 부족해 샘플을 담지 못했어요.");}}}><FlaskConical size={16}/>샘플로 둘러보기</button></section>
  </div>;
}
