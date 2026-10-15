/* eslint-disable @typescript-eslint/no-require-imports -- Node의 CommonJS 테스트 실행기입니다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const loadSource = require('./load-source.cjs');
const load = loadSource();
const urls = load('src/lib/url.ts');
const safe = load('src/lib/server/safe-fetch.ts');
const parser = load('src/lib/server/metadata.ts');
const publicDns = async () => [{address: '93.184.216.34', family: 4}];
const response = (status = 200, headers = {}, body = '<title>글</title>') => ({status, headers, body: Buffer.from(body)});

test('URL: 프로토콜 보완, 추적/fragment 제거, 콘텐츠 쿼리·순서 보존', () => {
  const actual = urls.parseBookmarkUrl(' EXAMPLE.com/read?id=7&sig=abc&utm_source=mail&fbclid=x#part ');
  assert.equal(actual.url, 'https://example.com/read?id=7&sig=abc&utm_source=mail&fbclid=x#part');
  assert.equal(actual.normalizedUrl, 'https://example.com/read?id=7&sig=abc');
  assert.notEqual(urls.parseBookmarkUrl('example.com/?id=1').normalizedUrl, urls.parseBookmarkUrl('example.com/?id=2').normalizedUrl);
  assert.equal(urls.parseBookmarkUrl('example.com/?b=2&a=1').normalizedUrl, 'https://example.com/?b=2&a=1');
});
test('URL: 잘못된 스킴, 인증정보, 공백, 상대경로, 빈 값 거절', () => {
  for (const input of ['javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com', '/article', '', 'example .com', 'https://example.com\\@127.0.0.1']) assert.throws(() => urls.parseBookmarkUrl(input));
});
test('TXT: BOM/CRLF, 기존 및 파일 내부 중복, 잘못된 줄', () => {
  const preview = urls.previewTxt('\uFEFFexample.com/one\r\n\r\nhttps://example.com/one#part\r\nexample.com/two\r\nnot a url\r\n', ['https://example.com/two']);
  assert.equal(preview.urls.length, 1); assert.equal(preview.duplicates, 2);
  assert.equal(preview.invalidLines[0].line, 5); assert.equal(preview.total, 4);
});
test('TXT: 파일 크기·줄 수·바이너리 제한, 빈 파일', () => {
  assert.throws(() => urls.previewTxt('x'.repeat(urls.MAX_TXT_BYTES + 1), []));
  assert.throws(() => urls.previewTxt(Array(101).fill('example.com').join('\n'), []));
  assert.throws(() => urls.previewTxt('example.com\0', []));
  assert.equal(urls.previewTxt('\n\n', []).total, 0);
});
test('SSRF: IPv4/IPv6/IPv4-mapped 및 특수 대역 차단', async () => {
  for (const host of ['127.0.0.1', '2130706433', '0x7f000001', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '[::1]', '[::]', '[fc00::1]', '[fe80::1]', '[::ffff:127.0.0.1]', '[2001:db8::1]']) {
    await assert.rejects(() => safe.validateTarget(`http://${host}/`, publicDns));
  }
  assert.equal(safe.isPublicIp('8.8.8.8'), true);
});
test('SSRF: DNS에 내부 주소가 하나라도 있으면 차단, 내부 도메인·포트 제한', async () => {
  await assert.rejects(() => safe.validateTarget('https://article.example/', async () => [{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]));
  await assert.rejects(() => safe.validateTarget('https://article.example/', async () => []));
  for (const url of ['http://localhost', 'http://foo.local', 'https://article.example:8080']) await assert.rejects(() => safe.validateTarget(url, publicDns));
  assert.equal((await safe.validateTarget('https://article.example', publicDns)).address.address, '93.184.216.34');
});
test('SSRF: 리다이렉트 내부망 목적지에 연결하지 않는다', async () => {
  let calls = 0;
  await assert.rejects(() => safe.fetchSafeHtml('https://article.example/', {resolver:publicDns, request:async () => {calls++; return response(302,{location:'http://127.0.0.1/secret'});}}));
  assert.equal(calls, 1);
});
test('메타데이터 요청: 상대 리다이렉트, 최대 횟수 및 DNS 타임아웃', async () => {
  let calls = 0;
  const result = await safe.fetchSafeHtml('https://article.example/start', {resolver:publicDns, request:async () => ++calls === 1 ? response(302,{location:'/end'}) : response()});
  assert.equal(result.finalUrl, 'https://article.example/end');
  await assert.rejects(() => safe.fetchSafeHtml('https://article.example/', {resolver:publicDns, request:async () => response(302,{location:'/loop'})}), /이동할/);
  await assert.rejects(() => safe.fetchSafeHtml('https://article.example/', {resolver:() => new Promise(() => {}), timeoutMs:20}), /중단/);
});
test('HTML 파싱: OG 우선, 최종 URL 기준 상대 경로, 안전한 이미지 fallback', () => {
  const meta = parser.parseMetadata(Buffer.from('<title>기본 제목</title><meta property="og:title" content="오늘의 &amp; 글"><meta name="description" content="기본 설명"><meta property="og:description" content="OG 설명"><meta property="og:image" content="javascript:alert(1)"><meta name="twitter:image" content="../cover.png"><link rel="shortcut icon" href="/icon.png">'), 'https://example.com/posts/a');
  assert.equal(meta.title, '오늘의 & 글'); assert.equal(meta.description, 'OG 설명');
  assert.equal(meta.ogImageUrl, 'https://example.com/cover.png'); assert.equal(meta.faviconUrl, 'https://example.com/icon.png');
  assert.equal(parser.parseMetadata(Buffer.from('<html></html>'), 'https://example.com/a').title, 'example.com');
  assert.equal(parser.absoluteWebUrl('data:image/png;base64,x', 'https://example.com'), null);
});

function mockTransport(status, headers, chunks = []) {
  let captured;
  const request = (url, options, callback) => {
    captured = {url, options};
    const req = new EventEmitter();
    req.end = () => queueMicrotask(() => {
      const res = new PassThrough();
      res.statusCode = status; res.headers = headers;
      callback(res);
      for (const chunk of chunks) if (!res.destroyed) res.write(chunk);
      if (!res.destroyed) res.end();
    });
    return req;
  };
  return {request, captured:() => captured};
}
test('네트워크 계층: 검증된 IP lookup 고정, Host는 원본 도메인 유지', async () => {
  const mock = mockTransport(200, {'content-type':'text/html'}, [Buffer.from('<title>글</title>')]);
  const source = loadSource({'node:https': {request:mock.request}})('src/lib/server/safe-fetch.ts');
  const result = await source.requestPage(new URL('https://article.example/'), {address:'93.184.216.34',family:4}, new AbortController().signal);
  assert.equal(result.status, 200); assert.equal(mock.captured().url.hostname,'article.example');
  mock.captured().options.lookup('article.example', {}, (error, address, family) => {assert.equal(error,null);assert.equal(address,'93.184.216.34');assert.equal(family,4);});
  assert.equal(mock.captured().options.agent,false);
});
test('네트워크 계층: 비HTML·큰 헤더상 크기·스트림 크기·압축 응답 거절', async () => {
  for (const [headers, chunks] of [
    [{'content-type':'application/json'}, []],
    [{'content-type':'text/html','content-length':String(safe.MAX_HTML_BYTES+1)}, []],
    [{'content-type':'text/html'}, [Buffer.alloc(safe.MAX_HTML_BYTES),Buffer.from('x')]],
    [{'content-type':'text/html','content-encoding':'gzip'}, []],
  ]) {
    const mock=mockTransport(200,headers,chunks);
    const source=loadSource({'node:https':{request:mock.request}})('src/lib/server/safe-fetch.ts');
    await assert.rejects(() => source.requestPage(new URL('https://article.example/'),{address:'93.184.216.34',family:4},new AbortController().signal));
  }
});

test('메타데이터 API: 잘못된 JSON·스킴·크기·내부망 URL을 거절한다', async () => {
  const route=loadSource()('src/app/api/metadata/route.ts');
  for(const [body,status] of [['{bad',400],[JSON.stringify({url:'file:///etc/passwd'}),400],['x'.repeat(9000),413],[JSON.stringify({url:'http://127.0.0.1/'}),400]]) {
    const res=await route.POST(new Request('https://app.example/api/metadata',{method:'POST',body}));
    assert.equal(res.status,status);
  }
});

test('백그라운드 큐: 중복 요청 방지, 순차 처리, 실패 후 다음 글 갱신', async () => {
  const originalFetch=global.fetch;
  const bookmarks=[{id:'a',url:'https://a.example',metadataStatus:'pending'},{id:'b',url:'https://b.example',metadataStatus:'pending'}];
  let complete;
  const done=new Promise(resolve=>{complete=resolve;});
  const store={bookmarks,updateBookmark:(id,patch)=>{Object.assign(bookmarks.find(b=>b.id===id),patch);if(id==='b'&&patch.metadataStatus==='ready')complete();}};
  const queue=loadSource({'@/store/library':{useLibrary:{getState:()=>store}}})('src/lib/metadata-queue.ts');
  let active=0,maxActive=0,calls=0;
  global.fetch=async()=>{active++;maxActive=Math.max(maxActive,active);const n=++calls;await Promise.resolve();active--;if(n===1)throw new Error('offline');return Response.json({title:'새 제목',description:'설명',domain:'b.example',faviconUrl:null,ogImageUrl:null});};
  try {
    queue.enqueueMetadata('a');queue.enqueueMetadata('a');queue.enqueueMetadata('b');
    await done;
    assert.equal(calls,2);assert.equal(maxActive,1);
    assert.equal(bookmarks[0].metadataStatus,'failed');assert.equal(bookmarks[1].title,'새 제목');
  } finally {global.fetch=originalFetch;}
});
