/* eslint-disable @typescript-eslint/no-require-imports -- Node 테스트의 격리 로더입니다. */
const {test}=require('node:test');const assert=require('node:assert/strict');const loader=require('./load-source.cjs');
const load=loader();const topics=load('src/lib/reading-topics.ts');const logic=load('src/lib/recommendation.ts');
const item=(id,title,extra={})=>({id,title,description:'',createdAt:new Date().toISOString(),isRead:false,isFavorite:false,...extra});
test('버블: 실제 제목·설명에 있는 주제 최대3개, 짧은 영문 키워드 경계',()=>{
  assert.equal(topics.matchesTopic('daily reading','science'),false);
  assert.equal(topics.matchesTopic('AI 가이드','science'),true);
  assert.deepEqual(topics.libraryTopics([item('a','디자인 시스템'),item('b','React 개발')]).map(t=>t.id).sort(),['design','development']);
  assert.ok(topics.libraryTopics([item('a','디자인 개발 업무 과학 철학')]).length<=3);
});
test('버블: 선택한 주제 밖 후보 제거, 빈 주제 기본 추천 없음',()=>{
  const input={mode:'balanced',topic:'design',bookmarks:[item('a','디자인 가이드'),item('b','React 개발')]};
  assert.deepEqual(logic.candidatesFor(input).map(i=>i.id),['a']);
  assert.equal(logic.fallbackRecommendation({...input,bookmarks:[item('b','React 개발')]}),null);
  assert.notEqual(topics.recommendationKey('2026-10-13','light','design'),topics.recommendationKey('2026-10-13','light','development'));
});
test('안내: 도메인·차단·모호한 제목에 생성 시도하지 않음',()=>{
  for(const title of ['example.com','Example Domain','403 Forbidden','짧은 제목'])assert.equal(topics.canGuideTitle(title,'example.com'),false);
  assert.equal(topics.canGuideTitle('웹 접근성 기초 안내','example.com'),true);
});
function server(result){let calls=0;const guide=loader({'@/lib/server/env':{getGeminiConfig:()=>({apiKey:'test',model:'test'})},'@/lib/server/recommendation':{acquireAiSlot:()=>()=>{},AI_TIMEOUT_MS:100},'@google/genai':{GoogleGenAI:class{constructor(){this.models={generateContent:async()=>{calls++;return {text:JSON.stringify(result)};}};}}}})('src/lib/server/ai-guide.ts');return {guide,calls:()=>calls};}
test('AI 안내: 제목에서 그대로 발췌한 주제만 표시, 잘못된 구절·id 거절',async()=>{
  const s=server({items:[{id:'a',topic:'웹 접근성'},{id:'b',topic:'제목에 없는 내용'},{id:'unknown',topic:'웹 접근성'}]});
  const result=await s.guide.titleGuides([{id:'a',title:'웹 접근성 기초 안내',domain:'example.com'},{id:'b',title:'자바스크립트 기초 안내',domain:'example.com'}]);
  assert.match(result.items[0].guide.text,/웹 접근성/);assert.equal(result.items[0].guide.titleBasis,'웹 접근성 기초 안내');assert.equal(result.items[1].guide,null);assert.equal(result.items.length,2);
});
test('AI 안내: 원문 불명확 판정과 불분명한 입력은 null 또는 미호출',async()=>{
  const s=server({items:[{id:'a',topic:null}]});assert.equal((await s.guide.titleGuides([{id:'a',title:'어떤 링크의 페이지 안내',domain:'example.com'}])).items[0].guide,null);
  const v=server({items:[]});await v.guide.titleGuides([{id:'a',title:'example.com',domain:'example.com'}]);assert.equal(v.calls(),0);
});
test('AI 안내 클라이언트: 기존 설명을 덮지 않고 늦은 응답의 제목을 확인',async()=>{
  const originalFetch=global.fetch;const books=[{id:'a',title:'웹 접근성 기초 안내',description:'원래 설명',domain:'example.com',metadataStatus:'ready'},{id:'b',title:'웹 접근성 기초 안내',description:'',domain:'example.com',metadataStatus:'ready'}];
  const updates=[];let payload;
  const store={bookmarks:books,updateBookmark:(id,p)=>updates.push({id,...p})};
  const client=loader({'@/store/library':{useLibrary:{getState:()=>store}}})('src/lib/title-guide-client.ts');
  global.fetch=async(_u,o)=>{payload=JSON.parse(o.body);books[1].title='다른 제목';return Response.json({available:true,items:[{id:'b',guide:{text:'제목 기준 안내',titleBasis:'웹 접근성 기초 안내',generatedAt:new Date().toISOString()}}]});};
  try{await client.requestVisibleGuides(['a','b']);assert.deepEqual(payload.items.map(i=>i.id),['b']);assert.equal(updates.length,0);}finally{global.fetch=originalFetch;}
});

test('읽을거리 주제: 여러 주제 중복 허용, 기타와 완독 제외, 원래 제목·설명만 사용',()=>{
  const books=[item('a','React 디자인 가이드'),item('b','어떤 글',{description:'업무 습관에 대한 글'}),item('c','독립된 이야기'),item('d','React 개발',{isRead:true})];
  const counts=Object.fromEntries(topics.collectionTopicCounts(books).map(t=>[t.id,t.count]));
  assert.equal(counts.all,3);assert.equal(counts.design,1);assert.equal(counts.development,1);assert.equal(counts.work,1);assert.equal(counts.other,1);
  assert.equal(topics.matchesCollectionTopic(books[0],'design'),true);assert.equal(topics.matchesCollectionTopic(books[0],'development'),true);
  assert.equal(topics.matchesCollectionTopic(books[2],'other'),true);
  assert.equal(topics.matchesCollectionTopic({...books[2],aiGuide:{text:'React 개발'}},'development'),false);
});
test('읽을거리 주제: 메타데이터 갱신과 완독 후 개수 재계산, 빈 서재 전체·기타0',()=>{
  const books=[item('a','example.com')];assert.equal(topics.collectionTopicCounts(books).find(t=>t.id==='other').count,1);
  books[0].title='React 개발 가이드';assert.equal(topics.collectionTopicCounts(books).find(t=>t.id==='other').count,0);
  assert.equal(topics.collectionTopicCounts(books).find(t=>t.id==='development').count,1);
  books[0].isRead=true;assert.ok(topics.collectionTopicCounts(books).every(t=>t.count===0));
  assert.ok(topics.collectionTopicCounts([]).every(t=>t.count===0));
});
