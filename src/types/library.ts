import type { z } from "zod";
import type {
  aiRecommendationSchema, bookmarkBackupSchema, bookmarkMetadataSchema,
  bookmarkSchema, dailyRecommendationSchema, metadataRequestSchema,
  metadataStatusSchema, persistedLibrarySchema, recommendationModeSchema,
  recommendationRequestSchema,
} from "@/lib/schemas";

export type Bookmark = z.input<typeof bookmarkSchema>;
export type MetadataStatus = z.infer<typeof metadataStatusSchema>;
export type RecommendationMode = z.infer<typeof recommendationModeSchema>;
export type DailyRecommendation = z.input<typeof dailyRecommendationSchema>;
export type AiRecommendation = z.infer<typeof aiRecommendationSchema>;
export type BookmarkBackup = z.infer<typeof bookmarkBackupSchema>;
export type PersistedLibrary = z.infer<typeof persistedLibrarySchema>;
export type MetadataRequest = z.infer<typeof metadataRequestSchema>;
export type BookmarkMetadata = z.infer<typeof bookmarkMetadataSchema>;
export type RecommendationRequest = z.input<typeof recommendationRequestSchema>;

// Gemini에 전달할 수 있는 필드만 정의합니다. URL과 본문은 포함하지 않습니다.
export type RecommendationCandidate = Pick<Bookmark, "id" | "title" | "description" | "isFavorite"> & {
  savedDays: number;
};
export type LibraryView = "today" | "unread" | "archive" | "favorites";
export type SortOrder = "newest" | "oldest";
