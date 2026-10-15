export const TOPICS = {
  design: { label: "디자인", words: ["디자인", "design", "ux", "ui", "접근성", "인터페이스", "피그마"] },
  development: { label: "개발", words: ["개발", "코딩", "javascript", "typescript", "react", "프로그래밍", "software", "next.js", "http", "api", "백엔드", "프론트엔드", "엔지니어", "스프링", "java"] },
  work: { label: "일과 생활", words: ["생산성", "커리어", "일상", "습관", "업무", "팀", "회고", "취업", "이직", "협업", "소통", "피드백", "스타트업", "관리자"] },
  science: { label: "과학과 기술", words: ["과학", "인공지능", "machine learning", "ai", "science", "데이터", "data", "알고리즘", "머신러닝", "딥러닝", "빅데이터"] },
  culture: { label: "문화와 생각", words: ["문화", "철학", "책", "예술", "영화", "글쓰기", "생각", "인문", "에세이"] },
} as const;
export type ReadingTopic = keyof typeof TOPICS;
export type CollectionTopic = ReadingTopic | "all" | "other";
type TopicBookmark = {title:string;description:string;isRead:boolean};
export function matchesCollectionTopic(bookmark: Pick<TopicBookmark,"title"|"description">, topic: CollectionTopic) {
  if(topic === "all") return true;
  const text = `${bookmark.title} ${bookmark.description}`;
  if(topic === "other") return !(Object.keys(TOPICS) as ReadingTopic[]).some(id=>matchesTopic(text,id));
  return matchesTopic(text,topic);
}
export function collectionTopicCounts(bookmarks: TopicBookmark[]) {
  const unread = bookmarks.filter(b=>!b.isRead);
  return ([{id:"all",label:"전체"},...Object.entries(TOPICS).map(([id,topic])=>({id,label:topic.label})),{id:"other",label:"기타"}] as {id:CollectionTopic;label:string}[])
    .map(topic=>({...topic,count:unread.filter(b=>matchesCollectionTopic(b,topic.id)).length}));
}
export function matchesTopic(text: string, topic: ReadingTopic) {
  const topicDef = (TOPICS as Record<string, { label: string; words: readonly string[] }>)[topic];
  if (!topicDef || !text) return false;
  const lower = text.toLowerCase();
  return topicDef.words.some((word) => /^[a-z]+$/.test(word) ? new RegExp(`\\b${word}\\b`, "i").test(lower) : lower.includes(word));
}
export function libraryTopics(bookmarks: {title?:string;description?:string}[]) {
  return (Object.keys(TOPICS) as ReadingTopic[]).map((id)=>({id,count:bookmarks.filter(b=>matchesTopic(`${b?.title ?? ""} ${b?.description ?? ""}`,id)).length})).filter(t=>t.count>0).sort((a,b)=>b.count-a.count).slice(0,3);
}
export function recommendationKey(dateKey:string,mode:string,topic:string|null=null) { return `${dateKey}:${mode}:${topic??"all"}`; }
export function canGuideTitle(title:string,domain:string) {
  const text=title.trim();
  return text.length>=8 && text.length<=300 && text.toLowerCase()!==domain.toLowerCase() && !/^(home|untitled|로그인|sign in|404|403|access denied|just a moment|example domain)/i.test(text) && !/^https?:\/\//i.test(text);
}
