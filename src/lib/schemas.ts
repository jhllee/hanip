import { z } from "zod";
import { BACKUP_SCHEMA_VERSION, MAX_BOOKMARKS } from "@/lib/constants";

// URL 형식만 검증합니다. 서버의 DNS/IP/리다이렉트 검증을 대체하지 않습니다.
export const httpUrlSchema = z.url().max(4096).refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "인증 정보가 없는 http 또는 https 주소를 입력해 주세요.");

const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const recommendationModeSchema = z.enum(["balanced", "light", "deep", "explore"]);
export const readingTopicSchema = z.enum(["design", "development", "work", "science", "culture"]);
export const aiGuideSchema = z.strictObject({ text: z.string().min(1).max(240), titleBasis: z.string().min(1).max(1000), generatedAt: z.iso.datetime({offset:true}) });
export const metadataStatusSchema = z.enum(["pending", "ready", "failed"]);

const bookmarkFieldsSchema = z.strictObject({
  id: z.string().min(1).max(128),
  url: httpUrlSchema,
  normalizedUrl: httpUrlSchema,
  title: z.string().trim().min(1).max(1000),
  description: z.string().max(5000),
  domain: z.string().min(1).max(253),
  faviconUrl: httpUrlSchema.nullable(),
  ogImageUrl: httpUrlSchema.nullable(),
  createdAt: isoDateTimeSchema,
  isRead: z.boolean(),
  isFavorite: z.boolean(),
  readAt: isoDateTimeSchema.nullable(),
  metadataStatus: metadataStatusSchema,
  aiGuide: aiGuideSchema.nullable().default(null),
});

export const bookmarkSchema = bookmarkFieldsSchema.refine((bookmark) => bookmark.isRead === (bookmark.readAt !== null), {
  path: ["readAt"],
  message: "완독 상태와 완독 일시가 일치해야 합니다.",
});

export const aiRecommendationSchema = z.strictObject({
  selectedBookmarkId: z.string().min(1).max(128),
  reason: z.string().trim().min(1).max(500),
});

// 후보 id 포함 여부는 Step 3에서 요청의 실제 후보 목록과 함께 검증합니다.
export const dailyRecommendationSchema = aiRecommendationSchema.extend({
  dateKey: z.iso.date(),
  mode: recommendationModeSchema,
  topic: readingTopicSchema.nullable().default(null),
  source: z.enum(["ai", "fallback"]),
  generatedAt: isoDateTimeSchema,
});

export const bookmarkBackupSchema = z.strictObject({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: isoDateTimeSchema,
  bookmarks: z.array(bookmarkSchema).max(MAX_BOOKMARKS),
});

// Zustand persist의 외부 version envelope와 별도로 state 내용도 검증합니다.
// 날짜+모드별 캐시를 여러 개 보관하고, 참조 유효성은 스토어에서 재검증합니다.
export const persistedLibrarySchema = z.strictObject({
  bookmarks: z.array(bookmarkSchema).max(MAX_BOOKMARKS),
  recommendations: z.array(dailyRecommendationSchema).max(366 * 24),
});

export const metadataRequestSchema = z.strictObject({ url: httpUrlSchema });
export const bookmarkMetadataSchema = bookmarkFieldsSchema.pick({
  title: true, description: true, domain: true, faviconUrl: true, ogImageUrl: true,
});

// API는 브라우저가 가진 북마크를 받되 후보 제한과 경과일 계산은 서버가 수행합니다.
export const recommendationRequestSchema = z.strictObject({
  mode: recommendationModeSchema,
  topic: readingTopicSchema.nullable().default(null),
  bookmarks: z.array(bookmarkFieldsSchema.pick({ id: true, title: true, description: true, createdAt: true, isRead: true, isFavorite: true })).max(MAX_BOOKMARKS).refine((items) => new Set(items.map((item) => item.id)).size === items.length, "중복된 id가 있어요."),
  excludeBookmarkId: z.string().min(1).max(128).optional(),
});

export const recommendationResponseSchema = aiRecommendationSchema.extend({ source: z.enum(["ai", "fallback"]), generatedAt: isoDateTimeSchema });

export const groundedAiRecommendationSchema = aiRecommendationSchema.extend({ evidence: z.strictObject({ field: z.enum(["title","description"]), quote: z.string().trim().min(2).max(180) }) });
export const guideRequestSchema = z.strictObject({items:z.array(z.strictObject({id:z.string().min(1).max(128), title:z.string().min(1).max(300), domain:z.string().min(1).max(253)})).min(1).max(10)});
