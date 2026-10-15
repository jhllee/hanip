# 오늘한입 (Hanip)

**모아둔 글, 오늘은 한입.**

읽고 싶어서 저장했지만 어느새 쌓여버린 글들 중에서 오늘 읽을 한 편을 골라주는 개인 지식 서재입니다.  
AI 큐레이터 **한입이**와 함께 모으는 즐거움을 읽는 기쁨으로 이어갑니다.

---

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| **오늘의 한 편 추천** | 저장 경과일과 관심도를 고려해 오늘 읽을 글 1편 추천, AI가 제목·설명 기반 추천 이유 제공 |
| **링크 수집 & 메타데이터** | 단일 URL 저장 및 TXT 일괄 가져오기, OpenGraph 제목·설명·이미지 자동 추출, 중복 방지 |
| **서재 탐색 & 주제 필터** | 읽을거리/보관함/즐겨찾기 뷰, 관심 주제별 필터 칩, 카드형 및 목록형 레이아웃 |
| **독서 기록 (아카이브)** | 완독 날짜별 타임라인 아카이브, 완독·삭제 실행 취소 지원 |
| **로컬 퍼스트 & 백업** | 브라우저 로컬 저장(로그인 불필요), 서재 데이터 JSON 내보내기/가져오기 |

---

## 인터페이스 디자인

차분한 크림색, 먹색, 살구색 톤과 텍스트 커버, 군더더기 없는 카드 그리드를 적용한 에디토리얼 매거진 인터페이스입니다. 과도한 장식을 줄이고 글의 제목과 기록 본연에 집중할 수 있도록 구성했습니다.

- **오늘 화면**: 진입 즉시 오늘의 추천 글과 추천 이유 확인, 서재 내 주제 칩으로 범위 탐색
- **읽을거리**: 카드형(커버 중심)과 목록형(제목·도메인 중심) 보기 지원, 관심 주제별 필터
- **보관함**: 완독한 날짜별로 묶인 타임라인으로 나의 독서 여정을 기록

---

## 기술적 특징

- **안전한 웹 수집 (SSRF 방어)**:
  - 사설망 IP 및 루프백 등 내부망 접근 차단
  - DNS Lookup 검증 후 확인된 IP로 고정 요청하여 DNS Rebinding 방지
  - 비정상적인 MIME 타입 및 스트림 응답 크기 제한
- **신뢰성 높은 AI 큐레이션**:
  - 본문 내용을 임의로 추측하거나 환각하지 않도록 제목과 설명 기반의 구조화된 스키마(Zod) 검증
  - Gemini API 미설정, 지연, 오류 발생 시에도 규칙 기반 기본 추천(Fallback)으로 즉시 전환
  - 인스턴스별 호출 상한(동시 2회, 분당 10회, 일 100회)으로 API 비용 보호
- **낙관적 UI 및 비동기 상태 제어**:
  - 빠른 초기 렌더링을 위해 기본 추천을 즉시 표시한 뒤 백그라운드에서 AI 응답을 안전하게 반영
  - 이미 원문을 열었거나 완독한 상태에서는 늦은 응답이 화면을 덮어쓰지 않도록 제어

---

## 기술 스택

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Lucide React
- **State & Storage**: Zustand, Browser localStorage
- **AI**: Google GenAI SDK (`@google/genai`)
- **Validation & Parsing**: Zod, Cheerio
- **Deployment**: Vercel

---

## 로컬 실행

Node.js **22.12 이상**이 필요합니다. (권장: Node.js 24)

```sh
git clone https://github.com/jhllee/hanip.git
cd hanip
npm ci
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속합니다.  
API 키 없이도 저장, 검색, 기본 추천, 완독 등 핵심 기능이 모두 동작합니다.

### AI 설정 (선택)

Gemini 큐레이션 기능을 사용하려면 `.env.local` 파일을 생성하고 키를 설정합니다.

```sh
cp .env.example .env.local
```

`.env.local`:
```dotenv
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
```

### 테스트 및 빌드 검증

```sh
npm test        # 저장소, 링크 수집, 추천, AI, 백업 단위 테스트
npm run lint    # ESLint 검증
npm run build   # Next.js 프로덕션 빌드
```

---

## Vercel 배포

1. [Vercel](https://vercel.com/new)에서 `jhllee/hanip` 저장소를 Import합니다.
2. Framework Preset은 **Next.js**, Build Command는 `npm run build`를 사용합니다.
3. AI 기능을 사용할 경우 Environment Variables에 `GEMINI_API_KEY`와 `GEMINI_MODEL`을 등록합니다.
4. **Deploy**를 클릭하면 배포가 완료됩니다.

---

## 데이터 저장 및 프라이버시

- 모든 서재 데이터는 **사용자의 브라우저(localStorage)**에 로컬 저장됩니다.
- 서버로 사용자 개인 데이터를 전송하거나 수집하지 않으며, AI 추천 및 메타데이터 조회 시에만 필요한 최소한의 텍스트(제목·설명)와 공개 URL을 요청합니다.
- 브라우저 변경이나 데이터 유실에 대비해 **데이터 관리 → JSON 내보내기**로 언제든 백업할 수 있습니다.
