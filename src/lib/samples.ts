import type { Bookmark } from "@/types/library";

const entries = [
  {
    url: "https://yozm.wishket.com/magazine/detail/2200/",
    title: "서비스 기획할 때 ‘VOC’ 꼭 필요할까?",
    description: "서비스 기획을 시작하는 첫 번째 방법은 ‘고객의 목소리를 분석하는 것’입니다. 서비스 기획에서 의미 있는 VOC를 선별해 내는 기준을 살펴봅니다.",
    image: "https://yozm.wishket.com/media/news/2200/image5.jpg",
    days: 20,
  },
  {
    url: "https://yozm.wishket.com/magazine/detail/2140/",
    title: "‘CX가 왜 필요하냐’고 묻는 관리자를 설득하는 방법",
    description: "CS 관련 시스템 도입에 의문을 제기하는 관리자를 설득하고, CX 체계를 구축하기 위한 실전 설득 노하우를 소개합니다.",
    image: "https://yozm.wishket.com/media/news/2140/image3.png",
    days: 16,
  },
  {
    url: "https://yozm.wishket.com/magazine/detail/2020/",
    title: "개발자도 알기 쉬운 모션 디자인 가이드 제작 팁",
    description: "디자이너와 개발자가 원활하게 소통하기 위해 모션 디자인 가이드를 개발자 친화적인 언어로 전달하는 팁을 공유합니다.",
    image: "https://yozm.wishket.com/media/news/2020/image10.png",
    days: 12,
  },
  {
    url: "https://yozm.wishket.com/magazine/detail/2000/",
    title: "“좀 더 좋은 UX 라이팅”에 숨은 두 가지 의미",
    description: "효율적인 사용성 텍스트와 브랜드 개성을 살리는 텍스트의 차이를 짚어보고, 좋은 UX 라이팅의 기준을 알아봅니다.",
    image: "https://yozm.wishket.com/media/news/2000/image1.jpg",
    days: 9,
  },
  {
    url: "https://yozm.wishket.com/magazine/detail/2150/",
    title: "베푸는 방법과 비판을 받아들이는 방법",
    description: "좋은 협업과 건강한 팀 문화를 만들기 위해 필요한 소통의 기술과 겸손, 존중, 신뢰(HRT)의 태도를 공유합니다.",
    image: "https://yozm.wishket.com/media/news/2150/diverse-people-holding-emoji-icons.jpg",
    days: 7,
  },
  {
    url: "https://yozm.wishket.com/magazine/detail/2080/",
    title: "스타트업이 고객과 대화하는 법",
    description: "고객과의 대화를 최우선 순위에 두고 제품과 사업의 방향을 끊임없이 조정해 나가는 스타트업의 실행 전략입니다.",
    image: "https://yozm.wishket.com/media/news/2080/image2.jpg",
    days: 5,
  },
  {
    url: "https://yozm.wishket.com/magazine/detail/1920/",
    title: "오프라인 매장뿐인 프라이마크의 이유 있는 고집",
    description: "온라인 쇼핑 시대에 모델과 광고도 없이 오프라인 매장 경험에만 집중해 성공을 거둔 패스트패션 기업 이야기입니다.",
    image: "https://yozm.wishket.com/media/news/1920/image3.png",
    days: 3,
  },
  {
    url: "https://yozm.wishket.com/magazine/detail/1720/",
    title: "야놀자는 정말 테크 기업일까?",
    description: "글로벌 트래블 테크 기업으로의 전환을 선언한 야놀자의 비즈니스 모델과 기술 전략을 심층적으로 분석합니다.",
    image: "https://yozm.wishket.com/media/news/1720/220922_%EC%9A%94%EC%A6%98it-%EC%8D%B8%EB%84%A4%EC%9D%BC-001__5_.png",
    days: 1,
  },
];

export function sampleBookmarks(now = new Date()): Bookmark[] {
  return entries.map((e, index) => {
    const domain = new URL(e.url).hostname.replace(/^www\./, "");
    return {
      id: `hanip-sample-${index + 1}`,
      url: e.url,
      normalizedUrl: e.url,
      title: e.title,
      description: e.description,
      domain,
      faviconUrl: null,
      ogImageUrl: e.image ?? null,
      createdAt: new Date(now.getTime() - e.days * 86400000).toISOString(),
      isRead: false,
      isFavorite: index === 0 || index === 2,
      readAt: null,
      metadataStatus: "ready",
      aiGuide: null,
    };
  });
}
