/* eslint-disable @typescript-eslint/no-require-imports -- Node 테스트에서 실제 데이터 계약을 검증합니다. */
const {test}=require('node:test');const assert=require('node:assert/strict');const loader=require('./load-source.cjs');
const load=loader();const backup=load('src/lib/backup.ts');const samples=load('src/lib/samples.ts');
const b=(id='a',extra={})=>({id,url:`https://example.com/${id}`,normalizedUrl:`https://example.com/${id}`,title:'테스트 글',description:'원래 설명',domain:'example.com',faviconUrl:null,ogImageUrl:null,createdAt:'2026-10-01T00:00:00.000Z',isRead:false,isFavorite:false,readAt:null,metadataStatus:'ready',aiGuide:null,...extra});
const file=bookmarks=>JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),bookmarks});
test('백업: 내보내기와 읽음·즐겨찾기·AI 안내의 왕복 검증',()=>{
  const bookmark=b('a',{isRead:true,readAt:'2026-10-13T00:00:00.000Z',isFavorite:true,aiGuide:{text:'제목 기준 안내',titleBasis:'테스트 글',generatedAt:new Date().toISOString()}});
  const text=backup.serializeBackup([bookmark]);assert.deepEqual(backup.parseBackup(text),[bookmark]);
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['bookmarks','exportedAt','schemaVersion']);
  assert.ok(!text.includes('GEMINI_API_KEY'));
});
test('백업: 잘못된 JSON·버전·필드·URL·읽음 일시·초과 크기는 전체 거절',()=>{
  for(const text of ['{broken',JSON.stringify({schemaVersion:2,exportedAt:new Date().toISOString(),bookmarks:[]}),file([b('a',{url:'javascript:alert(1)'})]),file([b('a',{ogImageUrl:'file:///etc/passwd'})]),file([b('a',{isRead:true,readAt:null})]),file([b('a',{apiKey:'secret'})]),'x'.repeat(5*1024*1024+1)])assert.throws(()=>backup.parseBackup(text));
});
test('백업: normalizedUrl을 신뢰하지 않고 fragment/추적 중복을 재계산한다',()=>{
  const existing=[b()];const incoming=backup.parseBackup(file([b('other',{url:'https://example.com/a?utm_source=mail#part',normalizedUrl:'https://wrong.example/'}),b('new')]));
  const result=backup.mergeBackup(existing,incoming,()=> 'replacement');assert.equal(result.added,1);assert.equal(result.skipped,1);assert.equal(existing.length,1);assert.equal(existing[0].title,'테스트 글');
});
test('백업: 다른 URL의 id 충돌 재발급, 파일 안 중복 및 콘텐츠 쿼리 보존',()=>{
  const result=backup.mergeBackup([b()],backup.parseBackup(file([b('a',{url:'https://example.com/new'}),b('b',{url:'https://example.com/new#part'}),b('c',{url:'https://example.com/read?id=1'}),b('d',{url:'https://example.com/read?id=2'})])),()=> 'fresh');
  assert.equal(result.added,3);assert.equal(result.skipped,1);assert.equal(result.additions[0].id,'fresh');
});
test('백업: 빈 백업은 유효하고 pending은 재시도 가능한 실패 상태로 복원',()=>{
  assert.deepEqual(backup.parseBackup(file([])),[]);assert.equal(backup.parseBackup(file([b('a',{metadataStatus:'pending'})]))[0].metadataStatus,'failed');
});
test('샘플: 8개, 고유 URL, 실존 아티클 및 이미지 포함',()=>{
  const items=samples.sampleBookmarks();assert.equal(items.length,8);assert.equal(new Set(items.map(i=>i.normalizedUrl)).size,8);
  assert.ok(items.every(i=>i.ogImageUrl));assert.ok(items.every(i=>i.metadataStatus==='ready'));
  assert.equal(backup.mergeBackup(items,samples.sampleBookmarks(),()=> 'fresh').added,0);
});
function setup(){const entries=new Map();global.localStorage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};const source=loader();const library=source('src/store/library.ts').useLibrary;return {library,...source('src/store/notifications.ts')};}
test('완독 실행 취소: readAt 복원, 이후 즐겨찾기 변경 유지',()=>{
  const s=setup();s.library.getState().addBookmark(b());s.changeRead('a',true);assert.equal(s.library.getState().bookmarks[0].isRead,true);
  s.library.getState().toggleFavorite('a');s.undoNotice(s.useNotices.getState().items[0].id);
  assert.equal(s.library.getState().bookmarks[0].isRead,false);assert.equal(s.library.getState().bookmarks[0].readAt,null);assert.equal(s.library.getState().bookmarks[0].isFavorite,true);
});
test('삭제 실행 취소: 항목 복원, 이후 다른 항목 변경 유지, 중복 주소 덮어쓰기 금지',()=>{
  const s=setup();s.library.getState().addBookmarks([b(),b('b')]);s.deleteBookmark('a');assert.equal(s.library.getState().bookmarks.length,1);
  s.library.getState().toggleFavorite('b');s.undoNotice(s.useNotices.getState().items[0].id);assert.equal(s.library.getState().bookmarks.length,2);assert.equal(s.library.getState().bookmarks.find(b=>b.id==='b').isFavorite,true);
  s.deleteBookmark('a');const notice=s.useNotices.getState().items.at(-1);s.library.getState().addBookmark(b('new',{url:'https://example.com/a',normalizedUrl:'https://example.com/a'}));s.undoNotice(notice.id);
  assert.equal(s.library.getState().bookmarks.some(b=>b.id==='a'),false);assert.equal(s.library.getState().bookmarks.some(b=>b.id==='new'),true);
});
test('완독 실행 취소: 삭제되거나 이후 읽음 상태가 바뀌면 덮어쓰지 않는다',()=>{
  const s=setup();s.library.getState().addBookmark(b());s.changeRead('a',true);const notice=s.useNotices.getState().items[0];s.library.getState().removeBookmark('a');s.undoNotice(notice.id);assert.equal(s.library.getState().bookmarks.length,0);
});
