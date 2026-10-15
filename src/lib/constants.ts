export const PRODUCT = {
  name: "오늘한입",
  curator: "한입이",
  headline: "모아둔 글, 오늘은 한입.",
  recommendationTitle: "한입이가 고른 오늘의 글",
  completionMessage: "오늘의 한입, 잘 읽었어요.",
  dailyCompletedMessage: "오늘의 한 편을 읽었어요.",
  recommendationDisclosure: "제목과 설명을 바탕으로 추천했어요",
  storageNotice: "데이터는 이 브라우저에 저장돼요. 기기 간 동기화는 지원하지 않아요.",
} as const;

export const STORAGE_KEY = "oneul-hanip-library";
export const LAST_VIEW_KEY = "oneul-hanip-last-view";
export const STORAGE_VERSION = 2;
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_BOOKMARKS = 10_000;
export const MAX_RECOMMENDATION_CANDIDATES = 30;
