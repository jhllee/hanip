"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Archive, ArrowDownUp, ArrowRight, BookOpen, Check, Heart, Library, LoaderCircle, Plus, Search, Settings2, Sun, X, Trash2, FlaskConical, LayoutGrid, List } from "lucide-react";
import { changeRead, deleteBookmark, notify } from "@/store/notifications";
import { Notices } from "./notices";
import { DataManagement, addSamples } from "./data-management";
import { TOPICS, libraryTopics, recommendationKey, type ReadingTopic, matchesTopic, collectionTopicCounts, matchesCollectionTopic, type CollectionTopic } from "@/lib/reading-topics";
import { requestVisibleGuides } from "@/lib/title-guide-client";
import { BookmarkDescription } from "./bookmark-description";
import { LAST_VIEW_KEY, PRODUCT } from "@/lib/constants";
import { localDateKey, savedLabel } from "@/lib/library-data";
import { hydrateLibrary, useLibrary, useStorageStatus } from "@/store/library";
import type { LibraryView, RecommendationMode, SortOrder } from "@/types/library";
import { BookmarkCover } from "./bookmark-cover";
import { SaveLinks } from "./save-links";
import { ArchiveTimeline } from "./archive-timeline";
import { BookmarkCard, originalLinkEvents } from "./bookmark-card";
import { z } from "zod";
import { recommendationController, useRecommendationStatus } from "@/lib/recommendation-client";
import { resumePendingMetadata } from "@/lib/metadata-queue";

const collectionLayoutsSchema = z.object({unread:z.enum(["cards","list"]),archive:z.enum(["cards","list"]),favorites:z.enum(["cards","list"])});
const LAYOUT_STORAGE_KEY = "oneul-hanip-collection-layouts";
type CollectionLayouts = z.infer<typeof collectionLayoutsSchema>;

const navigation = [
  { id: "today", label: "오늘", icon: Sun },
  { id: "unread", label: "읽을거리", icon: Library },
  { id: "archive", label: "보관함", icon: Archive },
  { id: "favorites", label: "즐겨찾기", icon: Heart },
] as const;

export default function LibraryApp() {
  const [view, setViewState] = useState<LibraryView>("today");
  const setView = (nextView: LibraryView) => {
    setViewState(nextView);
    try { localStorage.setItem(LAST_VIEW_KEY, nextView); } catch {}
  };
  const [collectionTopic,setCollectionTopic] = useState<CollectionTopic>("all");
  const [topic,setTopic] = useState<ReadingTopic|null>(null);
  const mode: RecommendationMode = "balanced";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [layouts, setLayouts] = useState<CollectionLayouts>({unread:"cards",archive:"cards",favorites:"cards"});
  const activeLayout = view === "today" ? "cards" : layouts[view];
  const changeLayout = (layout: "cards" | "list") => {
    if(view === "today") return;
    const next = {...layouts,[view]:layout};
    setLayouts(next);
    try { localStorage.setItem(LAYOUT_STORAGE_KEY,JSON.stringify(next)); } catch { notify("보기 방식은 이번 창에서만 적용돼요."); }
  };
  const [archiveSort, setArchiveSort] = useState<SortOrder>("newest");
  const [settings, setSettings] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const bookmarks = useLibrary((s) => s.bookmarks);
  const recommendations = useLibrary((s) => s.recommendations);
  const setRead = changeRead;
  const [finishedToday, setFinishedToday] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const hydrated = useStorageStatus((s) => s.hydrated);
  const storageError = useStorageStatus((s) => s.error);
  const dateKey = date ? localDateKey(date) : null;
  const finishedStorageKey = dateKey ? `hanip:finished:${dateKey}` : null;
  useEffect(() => {
    if (!finishedStorageKey) return;
    try {
      // 날짜·주제가 바뀔 때 브라우저에 저장한 완료 상태를 복원합니다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFinishedToday(localStorage.getItem(finishedStorageKey) === "true");
    } catch {}
  }, [finishedStorageKey]);
  const handleSelectTopic = (newTopic: ReadingTopic | null) => {
    setTopic(newTopic);
    setFinishedToday(false);
    setShowTopicPicker(false);
    if (finishedStorageKey) {
      try { localStorage.removeItem(finishedStorageKey); } catch {}
    }
    if (dateKey) {
      const cached = recommendations.find(
        (r) => r.dateKey === dateKey && r.mode === mode && (r.topic ?? null) === newTopic
      );
      const cachedBookmark = cached ? bookmarks.find((b) => b.id === cached.selectedBookmarkId) : null;
      const force = !cachedBookmark || cachedBookmark.isRead;
      void recommendationController.request(mode, dateKey, force, newTopic);
    }
  };
  const recommending = useRecommendationStatus((s)=>dateKey ? s.pending.includes(recommendationKey(dateKey,mode,topic)) : false);
  useEffect(()=>{
    if(hydrated && dateKey && view === "today") void recommendationController.request(mode,dateKey,false,topic);
  },[hydrated,dateKey,mode,topic,view,bookmarks,recommendations]);
  /* eslint-disable react-hooks/set-state-in-effect -- 브라우저에 저장한 화면·보기 설정은 마운트 후 복원합니다. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if(raw) {
        const parsed = collectionLayoutsSchema.safeParse(JSON.parse(raw));
        if(parsed.success) {
          // 브라우저에서 저장한 보기 설정만 복원합니다.
          setLayouts(parsed.data);
        }
      }
    } catch {}
    try {
      const saved = localStorage.getItem(LAST_VIEW_KEY) as LibraryView | null;
      if (saved && navigation.some((item) => item.id === saved)) {
        // 클라이언트 마운트 후 브라우저에 저장한 마지막 화면을 복원합니다.
        setViewState(saved);
      }
    } catch {}
    void hydrateLibrary().then(resumePendingMetadata);
    const update = () => setDate(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [settings]);
  const counts = {
    today: null,
    unread: bookmarks.filter((b) => !b.isRead).length,
    archive: bookmarks.filter((b) => b.isRead).length,
    favorites: bookmarks.filter((b) => b.isFavorite).length,
  };
  const recommendation = date ? recommendations.find((r) => r.dateKey === localDateKey(date) && r.mode === mode && (r.topic??null)===topic) : undefined;
  const selected = bookmarks.find((b) => b.id === recommendation?.selectedBookmarkId);
  const query = search.trim().toLocaleLowerCase("ko");
  const collectionTopics = collectionTopicCounts(bookmarks);
  const filtered = bookmarks.filter((b) => (view === "unread" ? !b.isRead : view === "archive" ? b.isRead : b.isFavorite) && (view !== "unread" || matchesCollectionTopic(b,collectionTopic)) && `${b.title} ${b.description} ${b.domain}`.toLocaleLowerCase("ko").includes(query)).sort((a, b) => { const timeA=Date.parse(view === "archive" ? a.readAt! : a.createdAt); const timeB=Date.parse(view === "archive" ? b.readAt! : b.createdAt); return (view === "archive" ? archiveSort : sort) === "newest" ? timeB-timeA : timeA-timeB; });
  const topics=libraryTopics(bookmarks.filter(b=>!b.isRead));
  const availableTopics = (Object.keys(TOPICS) as ReadingTopic[])
    .map((id) => ({
      id,
      label: TOPICS[id]?.label ?? id,
      count: bookmarks.filter((b) => !b?.isRead && matchesTopic(`${b?.title ?? ""} ${b?.description ?? ""}`, id)).length,
    }))
    .filter((t) => t.count > 0);
  const visibleGuideIds=view==="today" ? selected?.id??"" : filtered.slice(0,10).map(b=>b.id).join(",");
  useEffect(()=>{if(hydrated)void requestVisibleGuides(visibleGuideIds.split(","));},[hydrated,view,visibleGuideIds,bookmarks]);
  const title = navigation.find((n) => n.id === view)?.label ?? "오늘";
  const gotoLibrary = () => { setCollectionTopic("all"); setView("unread"); if(!bookmarks.length) { setShowSave(true); setTimeout(()=>urlInput.current?.focus(),0); } };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <header className="site-header">
        <div className="brand-lockup"><Link href="/" className="brand" aria-label="hanip 오늘한입 홈">hanip<span aria-hidden="true">.</span></Link><p className="brand-caption">오늘한입 · 나의 디지털 서재</p></div>
        <nav aria-label="서재 메뉴" className="navigation">
          {navigation.map(({ id, label }) => <button key={id} className={`nav-item ${view === id ? "selected" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => { setView(id); setSearch(""); }}><span>{label}</span>{hydrated && counts[id] !== null && <span className="nav-count">{counts[id]}</span>}</button>)}
        </nav>
        <div className="header-tools"><button className="header-add" aria-expanded={view === "unread" && showSave} onClick={()=>{setView("unread");setShowSave(true);setTimeout(()=>urlInput.current?.focus(),0);}}><Plus size={16}/><span>링크 추가</span></button><button ref={settingsButton} className="header-data" aria-label="데이터 관리" onClick={() => setSettings(true)}><Settings2 size={17}/><span>데이터 관리</span></button></div>
      </header>
      <div className="workspace">
        <main id="main-content" className={view === "today" ? "main-content today-page" : "main-content collection-page"} tabIndex={-1}>
          {storageError && <div role="alert" className="storage-alert">{storageError}</div>}
          <section className="page-heading">
            <div>
            <h1>{view === "today" ? "오늘 한입" : title}</h1>
            <p className="heading-description">{view === "today" ? PRODUCT.headline : view === "unread" ? "언젠가 읽고 싶었던 글, 여기 모아두었어요." : view === "archive" ? "읽고 난 글이, 나의 기록으로 남아요." : "다시 만나고 싶은 글을 가까이에 두세요."}</p>
            </div>
            {view === "today" && date && <time className="page-date" dateTime={date.toISOString()}>{new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(date)}</time>}
            {view !== "today" && <div className="search-field page-search">
              <Search size={17} aria-hidden="true"/><label className="sr-only" htmlFor="library-search">제목, 설명, 도메인 검색</label>
              <input id="library-search" placeholder="제목, 설명, 도메인으로 검색" value={search} onChange={e=>setSearch(e.target.value)}/>
              {search && <button className="icon-button" aria-label="검색어 지우기" onClick={()=>setSearch("")}><X size={16}/></button>}
            </div>}
          </section>
          {view === "unread" && showSave && (
            <SaveLinks
              inputRef={urlInput}
              onClose={() => setShowSave(false)}
              onSaved={() => {
                setShowSave(false);
                setView("unread");
                setSearch("");
                setCollectionTopic("all");
              }}
            />
          )}
          {!hydrated ? <div className="loading-state" role="status"><LoaderCircle className="loading-icon" size={22} /><span>서재를 불러오고 있어요.</span></div> : view === "today" ? <>
            <div className="recommendation-toolbar">
            {topics.length > 0 && (
              <section className="topic-bar" aria-label="관심 주제 선택">
                <div className="topic-chips" role="group">
                  <button
                    className={`topic-chip ${topic === null ? "active" : ""}`}
                    aria-pressed={topic === null}
                    onClick={() => handleSelectTopic(null)}
                  >
                    오늘의 추천
                  </button>
                  {[...new Set([...topics.map((t) => t.id), ...(topic ? [topic] : [])])].map((id) => (
                    <button
                      key={id}
                      className={`topic-chip ${topic === id ? "active" : ""}`}
                      aria-pressed={topic === id}
                      onClick={() => handleSelectTopic(id)}
                    >
                      {TOPICS[id]?.label ?? id}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <h2 className="selection-heading">{PRODUCT.recommendationTitle}</h2>
            </div>
            {selected && recommendation ? (
              finishedToday && selected.isRead ? (
                <article className="recommendation-card completed-celebration-card">
                  <div className="celebration-content">
                    <div className="celebration-badge">
                      <Check size={16} strokeWidth={2.5} />
                      <span>오늘의 독서 완료</span>
                    </div>
                    <h3 className="celebration-title">{PRODUCT.completionMessage}</h3>
                    <p className="celebration-article">
                      방금 읽은 글: <strong>{selected.title}</strong>
                    </p>
                    <p className="celebration-message">
                      읽은 글은 보관함에 남겨두었어요. 다음 호기심은 천천히 이어가세요.
                    </p>
                    <div className="celebration-actions">
                      <button className="button button-secondary" onClick={() => setView("archive")}>
                        <Archive size={15} /> 보관함 둘러보기
                      </button>
                      <button className="button button-secondary" onClick={gotoLibrary}>
                        <Library size={15} /> 내 서재 보기
                      </button>
                    </div>
                    {bookmarks.some((b) => !b.isRead && b.id !== selected.id) && (
                      <div className="celebration-next-topic">
                        <p className="celebration-next-label">다른 주제로 한 편 더 읽어볼까요?</p>
                        <div className="topic-chips celebration-chips">
                          <button
                            className={`topic-chip ${topic === null ? "active" : ""}`}
                            onClick={() => handleSelectTopic(null)}
                          >
                            <BookOpen size={13} /> 알아서 추천
                          </button>
                          {availableTopics.map((t) => (
                            <button
                              key={t.id}
                              className={`topic-chip ${topic === t.id ? "active" : ""}`}
                              onClick={() => handleSelectTopic(t.id)}
                            >
                              {t.label}
                              <span className="topic-count">{t.count}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ) : (
                <article className={`recommendation-card ${selected.isRead ? "completed" : ""}`}>
                  <BookmarkCover bookmark={selected} priority />
                  <div className="recommendation-body">
                    <p className="eyebrow">{selected.domain} · {savedLabel(selected.createdAt)}</p>
                    <h3>{selected.title}</h3>
                    <BookmarkDescription bookmark={selected} featured />
                    <div className="editor-note">
                      <span>한입이의 노트 <span className="badge">{recommendation.source === "fallback" ? "기본 추천" : "AI 추천"}</span></span>
                      <p>{recommendation.reason}</p>
                    </div>
                    {selected.isRead ? (
                      <div className="completed-panel" role="status">
                        {showTopicPicker ? (
                          <div className="completed-topic-picker" role="region" aria-label="다른 한입 주제 선택">
                            <div className="completed-panel-header">
                              <span className="completed-panel-icon"><BookOpen size={16} strokeWidth={2.2} /></span>
                              <div>
                                <strong>어떤 주제로 다른 한입을 읽을까요?</strong>
                                <p>초기화면처럼 원하는 주제를 골라 바로 읽을 수 있어요.</p>
                              </div>
                            </div>
                            <div className="topic-chips picker-chips">
                              <button
                                className={`topic-chip ${topic === null ? "active" : ""}`}
                                onClick={() => handleSelectTopic(null)}
                              >
                                <BookOpen size={13} /> 오늘의 추천 (알아서)
                              </button>
                              {availableTopics.map((t) => (
                                <button
                                  key={t.id}
                                  className={`topic-chip ${topic === t.id ? "active" : ""}`}
                                  onClick={() => handleSelectTopic(t.id)}
                                >
                                  {t.label}
                                  <span className="topic-count">{t.count}</span>
                                </button>
                              ))}
                            </div>
                            <div className="completed-footer">
                              <button className="text-button" onClick={() => setShowTopicPicker(false)}>
                                취소 (이전 선택지로)
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="completed-panel-header">
                              <span className="completed-panel-icon"><Check size={16} strokeWidth={2.5} /></span>
                              <div>
                                <strong>{PRODUCT.dailyCompletedMessage}</strong>
                                <p>다음으로 어떤 작업을 할까요?</p>
                              </div>
                            </div>
                            <div className="completed-choices">
                              <button
                                className="button completed-choice-btn"
                                onClick={() => {
                                  setFinishedToday(true);
                                  if (finishedStorageKey) try { localStorage.setItem(finishedStorageKey, "true"); } catch {}
                                }}
                              >
                                <Check size={15} /> 여기서 마무리
                              </button>
                              <button
                                className="button button-secondary completed-choice-btn"
                                disabled={recommending || !bookmarks.some((b) => !b.isRead && b.id !== selected.id)}
                                title={!bookmarks.some((b) => !b.isRead && b.id !== selected.id) ? "남은 미완독 글이 없어요." : undefined}
                                onClick={() => {
                                  if (availableTopics.length > 0) {
                                    setShowTopicPicker(true);
                                  } else {
                                    handleSelectTopic(null);
                                  }
                                }}
                              >
                                <BookOpen size={15} /> {recommending ? "고르는 중…" : "다른 한입"}
                              </button>
                              <button
                                className="button button-secondary completed-choice-btn"
                                onClick={() => setView("archive")}
                              >
                                <Archive size={15} /> 보관함
                              </button>
                              <button
                                className="button button-secondary button-danger completed-choice-btn"
                                onClick={() => {
                                  deleteBookmark(selected.id);
                                  if (dateKey && bookmarks.some((b) => !b.isRead && b.id !== selected.id)) {
                                    void recommendationController.request(mode, dateKey, true, topic);
                                  }
                                }}
                              >
                                <Trash2 size={15} /> 삭제
                              </button>
                            </div>
                            <div className="completed-footer">
                              <button
                                className="text-button"
                                onClick={() => {
                                  setRead(selected.id, false);
                                  setFinishedToday(false);
                                  setShowTopicPicker(false);
                                  if (finishedStorageKey) try { localStorage.removeItem(finishedStorageKey); } catch {}
                                }}
                              >
                                완독 취소
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="recommendation-actions">
                        <a className="button" href={selected.url} {...originalLinkEvents(selected.id)} target="_blank" rel="noopener noreferrer">
                          읽어보기 <ArrowRight size={17} />
                        </a>
                        <button className="button button-secondary" onClick={() => setRead(selected.id, true)}>
                          <Check size={16} />완독
                        </button>
                        <button
                          className="text-button"
                          disabled={recommending || !bookmarks.some((b)=>!b.isRead && b.id!==selected.id)}
                          title={!bookmarks.some((b)=>!b.isRead && b.id!==selected.id) ? "다른 미완독 글을 담아두면 바꿀 수 있어요." : undefined}
                          onClick={()=>{ if(dateKey) void recommendationController.request(mode,dateKey,true,topic); }}
                        >
                          {recommending ? "고르는 중…" : "다른 글 추천"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            ) : recommending ? <div className="today-empty loading-state" role="status"><LoaderCircle size={25} className="loading-icon" /><p>한입이가 오늘의 글을 고르고 있어요.</p></div> : <section className="today-empty"><div className="empty-illustration" aria-hidden="true"><span>h.</span></div><p className="eyebrow">A LITTLE READING, EVERY DAY</p><h3>{counts.unread > 0 ? topic ? "이 주제에 남은 읽을거리가 없어요." : "오늘 만날 한 편을 기다리고 있어요." : counts.archive > 0 ? "모아둔 글을 모두 읽었어요." : "첫 한입은, 마음에 든 글 하나부터."}</h3><p>{counts.unread > 0 ? topic ? "다른 주제를 골라보거나 모든 주제로 돌아가 보세요." : "잠시 후 오늘의 추천을 확인하거나 읽을거리에서 먼저 한 편을 만나보세요." : counts.archive > 0 ? "새로운 호기심을 담아두면 다음 한입이 시작돼요." : <>읽고 싶어 저장해 둔 링크가 있나요?<br />서재에 담아두면, 한입이가 다시 읽을 시간을 함께 찾아줄게요.</>}</p><button className="button button-secondary" onClick={gotoLibrary}>{counts.unread > 0 ? "읽을거리 보기" : "내 서재 둘러보기"}<ArrowRight size={16} /></button>{bookmarks.length===0 && <button className="text-button" onClick={()=>{addSamples();setView("unread");}}><FlaskConical size={15}/>샘플로 둘러보기</button>}<span className="empty-footnote">링크 한 편부터, 천천히 시작해 보세요.</span></section>}
            {selected && !selected.isRead && recommending && <p role="status" className="background-recommendation-note">한입이가 제목과 설명을 살펴보고 있어요.</p>}
            {selected && <p className="recommendation-disclosure">{PRODUCT.recommendationDisclosure}{recommendation?.source === "ai" ? " · 한입이 AI 추천" : " · 기본 추천"}</p>}
          </> : <>
            <div className={`list-toolbar ${view === "archive" ? "archive-toolbar" : ""}`}>
              {view === "unread" ? <section className="collection-topics" aria-label="읽을거리 주제 필터" title="제목과 설명 기준 · 한 글이 여러 주제에 포함될 수 있어요.">
                <div className="collection-topic-chips" role="group" aria-label="주제 선택">
                  {collectionTopics.filter(t=>t.count>0 || t.id === "all" || t.id === "other" || t.id === collectionTopic).map(t=><button key={t.id} className="collection-topic-chip" aria-pressed={collectionTopic===t.id} onClick={()=>setCollectionTopic(t.id)}>{t.label}<span>{t.count}</span></button>)}
                </div>
              </section> : <p className="collection-summary">{view === "archive" && filtered[0]?.readAt ? <><time dateTime={filtered[0].readAt}>{new Intl.DateTimeFormat("ko-KR", {year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date(filtered[0].readAt))}</time><span>{filtered.length}편의 독서 기록</span></> : `${filtered.length}개의 글`}</p>}
              <div className="collection-controls">
                <div className="layout-toggle" role="group" aria-label="보기 방식">
                  <button aria-label="카드형 보기" aria-pressed={activeLayout === "cards"} onClick={()=>changeLayout("cards")}><LayoutGrid size={16}/><span>카드형</span></button>
                  <button aria-label="목록형 보기" aria-pressed={activeLayout === "list"} onClick={()=>changeLayout("list")}><List size={17}/><span>목록형</span></button>
                </div>
                <label className="sort-control"><ArrowDownUp size={16}/><span className="sr-only">글 정렬</span><select value={view === "archive" ? archiveSort : sort} onChange={e=>(view === "archive" ? setArchiveSort : setSort)(e.target.value as SortOrder)}><option value="newest">{view === "archive" ? "최근 읽은순" : "최신 저장순"}</option><option value="oldest">{view === "archive" ? "먼저 읽은순" : "오래된순"}</option></select></label>
              </div>
            </div>
            <div className="sr-only" role="status">{filtered.length}{view === "archive" ? "편의 독서 기록" : "개의 글"}{view === "unread" && collectionTopic !== "all" && ` · ${collectionTopics.find(t=>t.id===collectionTopic)?.label}`}{query && ` · “${search.trim()}” 검색 결과`}</div>
            {filtered.length ? view === "archive" ? <ArchiveTimeline bookmarks={filtered} layout={activeLayout} hideFirstHeading /> : <div className={activeLayout === "cards" ? "bookmark-grid" : "bookmark-list"}>{filtered.map((b) => <BookmarkCard key={b.id} bookmark={b} compact={activeLayout === "list"} />)}</div> : <section className="list-empty"><span className="empty-symbol">{view === "favorites" ? <Heart size={28} strokeWidth={1.3} /> : view === "archive" ? <Archive size={28} strokeWidth={1.3} /> : <BookOpen size={28} strokeWidth={1.3} />}</span><h2>{query ? "찾는 글이 아직 없어요." : view === "archive" ? "완독한 글이 이곳에 남아요." : view === "favorites" ? "오래 간직하고 싶은 글이 있나요?" : view === "unread" && collectionTopic !== "all" ? "이 주제에 남은 읽을거리가 없어요." : "아직 담아둔 글이 없어요."}</h2><p>{query ? "다른 제목이나 도메인으로 검색해 보세요." : view === "archive" ? "한 편을 다 읽고 완독을 누르면 보관함으로 옮겨져요." : view === "favorites" ? "카드의 하트를 누르면 여기서 다시 만날 수 있어요." : view === "unread" && collectionTopic !== "all" ? "다른 주제를 고르거나 전체 글을 살펴보세요." : "마음에 드는 글의 링크로 나만의 서재를 시작해 보세요."}</p>{query && <button className="button button-secondary" onClick={() => setSearch("")}>검색 초기화</button>}{view === "unread" && collectionTopic !== "all" && <button className="button button-secondary" onClick={()=>{setCollectionTopic("all");setSearch("");}}>전체 읽을거리 보기</button>}</section>}
          </>}
          <footer className="page-footer"><span>hanip<span className="footer-dot">.</span> <small>오늘한입</small></span><p>모으는 즐거움에서, 읽는 기쁨으로.</p></footer>
        </main>
      </div>
      <Notices />
      <dialog ref={dialog} className="settings-dialog" onCancel={() => setSettings(false)} onClose={() => { setSettings(false); settingsButton.current?.focus(); }} aria-labelledby="settings-title"><div className="dialog-heading"><h2 id="settings-title">데이터 관리</h2><button className="icon-button" onClick={() => setSettings(false)} aria-label="데이터 관리 닫기"><X size={20} /></button></div><p>{PRODUCT.storageNotice}</p><DataManagement /></dialog>
    </div>
  );
}
