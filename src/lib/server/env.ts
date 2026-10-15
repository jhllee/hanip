import "server-only";
import { z } from "zod";

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_MODEL: z.string().trim().min(1).max(128),
});

// 호출 시에만 읽습니다. 키 미설정으로 빌드나 기본 추천이 중단되지 않습니다.
// 클라이언트·persist·백업에 이 결과를 전달하지 마세요.
export function getGeminiConfig() {
  const result = geminiEnvSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
  if (!result.success) return null;
  return { apiKey: result.data.GEMINI_API_KEY, model: result.data.GEMINI_MODEL };
}
