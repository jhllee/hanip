/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS로 실제 TypeScript 저장소를 격리 로드하는 Node 테스트입니다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function setup(raw = null, failWrites = false) {
  const entries = new Map(raw === null ? [] : [['oneul-hanip-library', raw]]);
  global.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { if (failWrites) throw new Error('QuotaExceededError'); entries.set(key, value); },
    removeItem: (key) => entries.delete(key),
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    new Function('require', 'module', 'exports', source)((id) => id.startsWith('@/') ? load(path.resolve('src', id.slice(2) + '.ts')) : require(id), loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return { ...load(path.resolve('src/store/library.ts')), entries, data: load(path.resolve('src/lib/library-data.ts')) };
}
function bookmark(id = 'one') {
  return { id, url: `https://example.com/${id}`, normalizedUrl: `https://example.com/${id}`, title: '저장한 글', description: '', domain: 'example.com', faviconUrl: null, ogImageUrl: null, createdAt: '2026-10-01T00:00:00.000Z', isRead: false, isFavorite: false, readAt: null, metadataStatus: 'ready' };
}
const rec = { dateKey: '2026-10-13', mode: 'balanced', selectedBookmarkId: 'one', reason: '오래전에 저장한 글이에요.', source: 'fallback', generatedAt: '2026-10-13T00:00:00.000Z' };

test('빈 서재 hydration은 오류 없이 완료되고 자동 샘플을 만들지 않는다', async () => {
  const s = setup();
  assert.equal(s.useStorageStatus.getState().hydrated, false);
  await s.hydrateLibrary();
  assert.equal(s.useStorageStatus.getState().hydrated, true);
  assert.equal(s.useStorageStatus.getState().error, null);
  assert.equal(s.useLibrary.getState().bookmarks.length, 0);
});
test('저장·추천·즐겨찾기는 재시작 후 복원된다', async () => {
  const s = setup(); await s.hydrateLibrary();
  assert.equal(s.useLibrary.getState().addBookmark(bookmark()), true);
  assert.equal(s.useLibrary.getState().addBookmark(bookmark('one')), false);
  s.useLibrary.getState().toggleFavorite('one');
  s.useLibrary.getState().saveRecommendation(rec);
  const restored = setup(s.entries.get('oneul-hanip-library')); await restored.hydrateLibrary();
  assert.equal(restored.useLibrary.getState().bookmarks[0].isFavorite, true);
  assert.deepEqual(restored.useLibrary.getState().recommendations, [{...rec,topic:null}]);
});
test('완독 후 추천 완료 상태를 유지하고 읽음 취소 시 readAt을 지운다', async () => {
  const s = setup(); await s.hydrateLibrary(); const store = s.useLibrary;
  store.getState().addBookmark(bookmark()); store.getState().saveRecommendation(rec);
  store.getState().setRead('one', true);
  assert.equal(store.getState().bookmarks[0].isRead, true);
  assert.ok(store.getState().bookmarks[0].readAt);
  assert.equal(store.getState().recommendations.length, 1);
  store.getState().setRead('one', false);
  assert.equal(store.getState().bookmarks[0].readAt, null);
  store.getState().removeBookmark('one');
  assert.equal(store.getState().recommendations.length, 0);
});
test('손상·미지원 버전의 원본을 덮어쓰지 않는다', async () => {
  for (const raw of ['{bad json', JSON.stringify({version: 9, state: {bookmarks: [], recommendations: []}})]) {
    const s = setup(raw); await s.hydrateLibrary();
    assert.equal(s.useStorageStatus.getState().writesBlocked, true);
    s.useLibrary.getState().addBookmark(bookmark());
    assert.equal(s.entries.get('oneul-hanip-library'), raw);
  }
});
test('v0 데이터에 추천 배열을 보충하고 v2로 마이그레이션한다', async () => {
  const s = setup(JSON.stringify({ version: 0, state: { bookmarks: [bookmark()] } })); await s.hydrateLibrary();
  assert.equal(s.useLibrary.getState().bookmarks.length, 1);
  assert.equal(JSON.parse(s.entries.get('oneul-hanip-library')).version, 2);
});
test('저장 실패를 알리고 메모리의 변경 사항은 유지한다', async () => {
  const s = setup(null, true); await s.hydrateLibrary();
  s.useLibrary.getState().addBookmark(bookmark());
  assert.equal(s.useLibrary.getState().bookmarks.length, 1);
  assert.match(s.useStorageStatus.getState().error, /저장하지 못했어요/);
});
test('없는 추천 참조를 제거하고 중복 북마크는 거절한다', () => {
  const s = setup();
  assert.deepEqual(s.data.validateLibrary({bookmarks: [], recommendations: [rec]}).recommendations, []);
  assert.throws(() => s.data.validateLibrary({bookmarks: [bookmark(), bookmark()], recommendations: []}));
});

test('여러 글 저장 시 중복을 건너뛰고 잘못된 항목은 전체 저장 전에 거절한다', async () => {
  const s=setup(); await s.hydrateLibrary();
  assert.deepEqual(s.useLibrary.getState().addBookmarks([bookmark('one'), bookmark('one'), bookmark('two')]), {added:2,skipped:1});
  assert.throws(() => s.useLibrary.getState().addBookmarks([bookmark('three'), {...bookmark('four'), url:'file:///etc/passwd'}]));
  assert.equal(s.useLibrary.getState().bookmarks.length,2);
});

test('v1 서재를 v2로 보존하며 안내와 주제별 추천을 독립적으로 저장한다',async()=>{
  const s=setup(JSON.stringify({version:1,state:{bookmarks:[bookmark()],recommendations:[rec]}}));await s.hydrateLibrary();
  assert.equal(s.useLibrary.getState().bookmarks[0].aiGuide,null);
  s.useLibrary.getState().updateBookmark('one',{aiGuide:{text:'제목 기준 안내',titleBasis:'저장한 글',generatedAt:new Date().toISOString()}});
  s.useLibrary.getState().saveRecommendation({...rec,topic:'design'});
  s.useLibrary.getState().saveRecommendation({...rec,topic:'development'});
  assert.equal(s.useLibrary.getState().recommendations.length,3);
  const restored=setup(s.entries.get('oneul-hanip-library'));await restored.hydrateLibrary();
  assert.equal(restored.useLibrary.getState().bookmarks[0].description,'');
  assert.equal(restored.useLibrary.getState().bookmarks[0].aiGuide.text,'제목 기준 안내');
});
