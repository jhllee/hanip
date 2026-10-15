import type { Bookmark } from "@/types/library";
const entries=[
  {url:"https://nextjs.org/learn",title:"Next.js로 웹 개발 시작하기",description:"Next.js 공식 학습 자료입니다. 작은 프로젝트를 따라가며 웹 개발을 익혀보세요.",image:"https://nextjs.org/api/og?title=Learn+Next.js&type=learn&sig=e3f3ebadcd1f4416",days:18},
  {url:"https://developer.mozilla.org/ko/docs/Web/Accessibility",title:"모두가 사용할 수 있는 웹 접근성",description:"MDN의 웹 접근성 안내입니다. 다양한 사용자를 고려하는 웹의 기본을 살펴보세요.",days:12},
  {url:"https://www.w3.org/WAI/fundamentals/accessibility-intro/",title:"웹 접근성의 기초를 소개합니다",description:"W3C WAI가 제공하는 웹 접근성 입문 자료입니다.",days:8},
  {url:"https://www.rfc-editor.org/rfc/rfc9110.html",title:"HTTP Semantics: 웹 통신의 약속",description:"HTTP의 구조와 공통 개념을 정의하는 RFC 9110 문서입니다.",days:25},
  {url:"https://news.ycombinator.com/item?id=8863",title:"My YC app: Dropbox - Throw away your USB drive",description:"",days:6},
  {url:"https://example.com/oneul-hanip-sample-unavailable",title:"example.com",description:"",days:4,failed:true},
  {url:"https://web.dev/learn/css/",title:"CSS를 차근차근 배우는 가이드",description:"web.dev의 CSS 학습 자료입니다. 스타일링의 기본 개념을 살펴보세요.",days:2},
];
export function sampleBookmarks(now=new Date()):Bookmark[]{return entries.map((e,index)=>{
  const domain=new URL(e.url).hostname.replace(/^www\./,"");
  return {id:`hanip-sample-${index+1}`,url:e.url,normalizedUrl:e.url,title:e.title,description:e.description,domain,faviconUrl:null,ogImageUrl:e.image??null,createdAt:new Date(now.getTime()-e.days*86400000).toISOString(),isRead:false,isFavorite:index===1||index===3,readAt:null,metadataStatus:e.failed?"failed":"ready",aiGuide:null};
});}
