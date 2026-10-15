import type { Metadata } from "next";
import { PRODUCT } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${PRODUCT.name} — ${PRODUCT.headline}`, template: `%s | ${PRODUCT.name}` },
  description: "저장한 글 중 매일 한 편, 한입이와 다시 읽는 개인 지식 서재.",
  applicationName: PRODUCT.name,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
