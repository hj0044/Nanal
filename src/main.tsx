import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  advanceDay, backgroundLabels, chooseEvent, createGame, createSeed, startNextWeek,
  type Background, type Character, type CharacterDraft, type GameState, type Palette,
  type SensitiveTopic, type Tab,
} from "./game";
import "./style.css";

const SAVE_KEY = "nanal-save-v1";
const backgroundChoices: Background[] = ["student", "jobseeker", "worker"];
const namePool = ["서윤", "민준", "지우", "하린", "도현", "예진", "시우", "유나"];
const regions = ["서울", "인천", "경기", "부산", "대구"];
const housingChoices = ["가족과 동거", "자취", "기숙사", "전세·월세 동거"];
const emptyDraft: CharacterDraft = { name: "", age: "", year: "", background: "", gender: "", region: "", housing: "", education: "", family: "", startingMoney: "" };

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1 || !parsed.character || !parsed.stats || !Array.isArray(parsed.contacts)) return null;
    return parsed;
  } catch { return null; }
}
function App() {
  const [game, setGame] = useState<GameState | null>(() => readSave());
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft);
  const [tab, setTab] = useState<Tab>("life");
  const [showSettings, setShowSettings] = useState(false);
  const [showCreator, setShowCreator] = useState(!readSave());
  const [importMessage, setImportMessage] = useState("");
  const [nightNow, setNightNow] = useState(false);

  useEffect(() => {
    if (!game) { document.documentElement.dataset.palette = "clean"; return; }
    if (game.settings.nightMode === "device") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => setNightNow(media.matches);
      update();
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    if (game.settings.nightMode === "schedule") {
      const update = () => {
        const [sh, sm] = game.settings.nightStart.split(":").map(Number);
        const [eh, em] = game.settings.nightEnd.split(":").map(Number);
        const now = new Date(); const current = now.getHours() * 60 + now.getMinutes();
        const start = sh * 60 + sm; const end = eh * 60 + em;
        setNightNow(start > end ? current >= start || current < end : current >= start && current < end);
      };
      update();
      const timer = window.setInterval(update, 60_000);
      return () => window.clearInterval(timer);
    }
    setNightNow(false);
  }, [game?.settings.nightMode, game?.settings.nightStart, game?.settings.nightEnd]);

  useEffect(() => {
    if (!game) return;
    const scheduled = game.settings.nightMode !== "off" && nightNow;
    document.documentElement.dataset.palette = scheduled ? "dark" : game.settings.palette;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* storage quota is surfaced on manual export */ }
  }, [game, nightNow]);

  const updateGame = (fn: (current: GameState) => GameState) => setGame((current) => current ? fn(current) : current);
  const canStart = Boolean(draft.name.trim() && draft.age && draft.year && draft.background && draft.gender && draft.region && draft.housing);
  const start = () => {
    if (!canStart || !draft.background || !draft.age || !draft.year || !draft.gender) return;
    const character: Character = {
      ...draft, name: draft.name.trim(), age: Number(draft.age), year: Number(draft.year),
      background: draft.background, gender: draft.gender,
      education: draft.education || undefined, family: draft.family || undefined,
      startingMoney: draft.startingMoney ? Number(draft.startingMoney) : undefined,
    };
    const seed = createSeed(`${character.name}:${character.age}:${character.year}:${character.background}:${Date.now()}`);
    setGame(createGame(character, seed));
    setShowCreator(false);
    setTab("life");
  };
  const randomize = () => {
    const background = backgroundChoices[Math.floor(Math.random() * backgroundChoices.length)];
    const age = background === "student" ? 19 + Math.floor(Math.random() * 8) : background === "jobseeker" ? 20 + Math.floor(Math.random() * 11) : 22 + Math.floor(Math.random() * 9);
    const education = background === "student" ? "대학 재학·휴학" : background === "jobseeker" ? ["고등학교 졸업", "대학교 졸업", "대학원·전문 과정"][Math.floor(Math.random() * 3)] : ["대학교 졸업", "직업교육·자격 과정"][Math.floor(Math.random() * 2)];
    const money = background === "student" ? [100000, 300000, 700000][Math.floor(Math.random() * 3)] : background === "jobseeker" ? [200000, 600000, 1500000][Math.floor(Math.random() * 3)] : [800000, 1800000, 3500000][Math.floor(Math.random() * 3)];
    setDraft({
      name: namePool[Math.floor(Math.random() * namePool.length)],
      age, year: 2020 + Math.floor(Math.random() * 7), background,
      gender: Math.random() > 0.5 ? "남성" : "여성",
      region: regions[Math.floor(Math.random() * regions.length)],
      housing: housingChoices[Math.floor(Math.random() * housingChoices.length)],
      education,
      family: ["가족과 동거", "독립 생활", "배우자·자녀와 거주", "기숙사 생활"][Math.floor(Math.random() * 4)],
      startingMoney: String(money),
    });
  };
  const setPalette = (palette: Palette) => updateGame((current) => ({ ...current, settings: { ...current.settings, palette } }));
  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as GameState;
      if (parsed.version !== 1 || !parsed.character || !parsed.stats || !Array.isArray(parsed.contacts)) throw new Error("다른 형식의 저장 파일입니다.");
      setGame(parsed); setShowCreator(false); setImportMessage("저장 파일을 불러왔어요.");
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "파일을 읽지 못했어요."); }
  };

  if (!game || showCreator) {
    return <Creator draft={draft} setDraft={setDraft} canStart={canStart} randomize={randomize} start={start} onImport={handleImport} importMessage={importMessage} hasSave={Boolean(game)} onContinue={() => setShowCreator(false)} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">n</span><span>Nanal</span></div>
        <div className="topbar-actions">
          <span className="save-indicator"><i /> 자동 저장</span>
          <button className="icon-button" aria-label="설정 열기" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </header>
      <main className="main-content">
        {tab === "life" && <LifeView game={game} onAdvance={() => updateGame(advanceDay)} onChoice={(id) => updateGame((current) => chooseEvent(current, id))} onNextWeek={() => updateGame(startNextWeek)} />}
        {tab === "people" && <PeopleView game={game} />}
        {tab === "work" && <WorkView game={game} />}
        {tab === "goals" && <GoalsView game={game} />}
        {tab === "record" && <RecordView game={game} />}
      </main>
      <nav className="bottom-nav" aria-label="주요 메뉴">
        {([
          ["life", "⌂", "생활"], ["people", "♡", "인물"], ["work", "▣", "일·경제"], ["goals", "✳", "목표"], ["record", "≡", "기록"],
        ] as [Tab, string, string][]).map(([key, icon, label]) => (
          <button key={key} className={tab === key ? "nav-item active" : "nav-item"} onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined}>
            <span className="nav-icon">{icon}</span><span>{label}</span>
          </button>
        ))}
      </nav>
      {showSettings && <Settings game={game} onClose={() => setShowSettings(false)} onPalette={setPalette}
        onUpdate={(patch) => updateGame((current) => ({ ...current, settings: { ...current.settings, ...patch } }))}
        onExport={() => exportSave(game)} onImport={handleImport} importMessage={importMessage} />}
    </div>
  );
}

function Creator({ draft, setDraft, canStart, randomize, start, onImport, importMessage, hasSave, onContinue }: {
  draft: CharacterDraft; setDraft: React.Dispatch<React.SetStateAction<CharacterDraft>>; canStart: boolean;
  randomize: () => void; start: () => void; onImport: (file?: File) => void; importMessage: string; hasSave: boolean; onContinue: () => void;
}) {
  const set = (key: keyof CharacterDraft, value: string) => setDraft((current) => ({ ...current, [key]: key === "age" || key === "year" ? (value ? Number(value) : "") : value } as CharacterDraft));
  const select = (label: string, key: keyof CharacterDraft, values: string[], placeholder: string) => (
    <label className="field"><span>{label}</span><select value={draft[key]} onChange={(event) => set(key, event.target.value)}><option value="">{placeholder}</option>{values.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
  );
  return (
    <div className="creator-page">
      <header className="topbar creator-top"><div className="brand"><span className="brand-mark">n</span><span>Nanal</span></div><span className="prototype-label">첫 주 플레이 테스트</span></header>
      <div className="creator-wrap">
        <div className="eyebrow">YOUR LIFE, YOUR START</div>
        <h1>어떤 삶으로<br /><em>시작해 볼까요?</em></h1>
        <p className="creator-lead">정해진 주인공은 없어요. 시작할 인물과 상황을 직접 정하거나, 추천 설정을 받아 고쳐도 돼요.</p>
        <div className="creator-card">
          <div className="card-heading"><div><span className="section-kicker">CHARACTER SETUP</span><h2>시작 설정</h2></div><button className="text-button" onClick={randomize}>✦ 추천 설정 만들기</button></div>
          <label className="field"><span>이름</span><input maxLength={12} value={draft.name} placeholder="직접 입력하거나 추천 설정 이용" onChange={(event) => set("name", event.target.value)} /></label>
          <div className="field-row">
            {select("시작 나이", "age", Array.from({ length: 12 }, (_, i) => String(19 + i)), "나이 선택")}
            {select("시작 연도", "year", Array.from({ length: 7 }, (_, i) => String(2020 + i)), "연도 선택")}
          </div>
          <div className="field-row">
            <label className="field"><span>시작 배경</span><select value={draft.background} onChange={(event) => set("background", event.target.value)}><option value="">배경 선택</option>{backgroundChoices.map((key) => <option key={key} value={key}>{backgroundLabels[key]}</option>)}</select></label>
            {select("성별", "gender", ["남성", "여성"], "선택")}
          </div>
          <div className="field-row">
            {select("지역", "region", regions, "지역 선택")}
            {select("주거 형태", "housing", housingChoices, "주거 선택")}
          </div>
          <details className="optional-fields"><summary>학력·가족·초기 자산 설정</summary>
            <div className="field-row">
              {select("학력", "education", ["고등학교 졸업", "대학 재학·휴학", "대학교 졸업", "대학원·전문 과정", "직업교육·자격 과정"], "선택 사항")}
              {select("가족·동거", "family", ["가족과 동거", "독립 생활", "배우자·자녀와 거주", "기숙사 생활", "직접 설정"], "선택 사항")}
            </div>
            <label className="field"><span>시작 현금 자산 (원, 선택 사항)</span><input type="number" min="0" max="1000000000" step="10000" value={draft.startingMoney} placeholder="비워두면 배경에 맞춰 추천" onChange={(event) => set("startingMoney", event.target.value)} /></label>
          </details>
          <p className="microcopy">설정은 시작 전에 확인하고 수정할 수 있어요. 나이·연도·배경이 일반적인 조합과 달라도 직접 선택한 설정을 존중해요.</p>
          <button className="primary-button full" disabled={!canStart} onClick={start}>이 설정으로 시작 <span>→</span></button>
          {hasSave && <button className="secondary-button full" onClick={onContinue}>저장된 생활 이어하기</button>}
          <label className="upload-link">저장 파일 불러오기<input type="file" accept="application/json,.json" onChange={(event) => onImport(event.target.files?.[0])} /></label>
          {importMessage && <p className="inline-message">{importMessage}</p>}
        </div>
        <div className="creator-footnote">Nanal은 현재 프로토타입이에요. 게임 속 수치와 확률은 플레이 테스트용 임시 값입니다.</div>
      </div>
    </div>
  );
}

function LifeView({ game, onAdvance, onChoice, onNextWeek }: { game: GameState; onAdvance: () => void; onChoice: (id: string) => void; onNextWeek: () => void }) {
  const [showResult, setShowResult] = useState(false);
  const intro = useMemo(() => {
    const context = `${game.character.age}세로 ${game.character.region}에서 ${game.character.housing} 생활을 이어가고 있다.`;
    const study = game.character.education ? ` 현재 학력은 ${game.character.education}이다.` : "";
    const family = game.character.family ? ` ${game.character.family} 상황도 생활의 한 부분이다.` : "";
    const path = game.character.background === "student" ? "학교와 생활의 균형을 찾아간다." : game.character.background === "jobseeker" ? "일을 찾는 준비와 하루의 리듬을 함께 살펴본다." : "일과 생활 사이에서 이번 주의 우선순위를 정한다.";
    return `${context}${study}${family} ${path}`;
  }, [game.character]);
  const dateLabel = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(game.character.year, 0, (game.week - 1) * 7 + game.day));
  useEffect(() => { setShowResult(Boolean(game.lastChoice)); }, [game.lastChoice]);
  return (
    <>
      <div className="welcome-row"><div><div className="eyebrow">{dateLabel} · {backgroundLabels[game.character.background]}</div><h1>안녕, {game.character.name}<span className="wave">.</span></h1><div className="profile-line">{game.character.age}세 · {game.character.region} · {game.character.housing}</div></div><div className="avatar-mini">{game.character.name.slice(0, 1)}</div></div>
      <section className="hero-card">
        <div className="hero-top"><span className="week-chip">{game.week}주차 · {game.day}일</span><span className="live-dot">이번 주 진행 중</span></div>
        <p>{intro}</p>
        <div className="week-track" aria-label="이번 주 진행"><span style={{ width: `${Math.max(8, (game.day / 7) * 100)}%` }} /></div>
        <div className="track-labels"><span>월요일</span><span>일요일</span></div>
      </section>
      <section className="stats-grid" aria-label="현재 상태">
        <StatCard label="생활비" value={formatMoney(game.stats.money)} detail="보유 자금" tone="mint" />
        <StatCard label="컨디션" value={`${game.stats.energy}%`} detail="에너지" tone="blue" />
        <StatCard label="기분" value={`${game.stats.mood}%`} detail="최근 흐름" tone="peach" />
        <StatCard label="스트레스" value={`${game.stats.stress}%`} detail="낮을수록 여유" tone="lavender" />
      </section>
      {game.phase === "event" && game.pendingEvent && <EventPanel event={game.pendingEvent} onChoice={onChoice} />}
      {game.phase === "summary" && <section className="panel summary-panel"><div className="section-kicker">WEEKLY REVIEW</div><h2>이번 주를 돌아봤어요</h2><p>선택과 일정이 생활에 남았어요. 결과는 한 번의 성공이나 실패로 단정되지 않고 다음 주로 이어집니다.</p><div className="summary-chips"><span>에너지 {game.stats.energy}%</span><span>기분 {game.stats.mood}%</span><span>관계 {Math.round(game.contacts.reduce((sum, person) => sum + person.warmth, 0) / game.contacts.length)} 평균</span></div><button className="primary-button" onClick={onNextWeek}>다음 주 시작 <span>→</span></button></section>}
      {game.phase === "playing" && (
        <section className="next-card">
          <div className="next-copy"><span className="section-kicker">NEXT STEP</span><h2>하루를 이어가 볼까요?</h2><p>상황에 맞는 일이 생기면 여기서 멈춰 선택을 기다릴게요.</p></div>
          <button className="advance-button" onClick={() => { setShowResult(false); onAdvance(); }}><span>하루 진행</span><span className="arrow">→</span></button>
        </section>
      )}
      {showResult && game.lastChoice && <div className="toast-result"><span className="toast-check">✓</span><span>{game.lastChoice}</span><button onClick={() => setShowResult(false)} aria-label="닫기">×</button></div>}
      <section className="feed-section"><div className="section-heading"><div><span className="section-kicker">RECENT MOMENTS</span><h2>최근 기록</h2></div><span className="quiet-label">이번 생의 흐름</span></div>{game.log.slice(0, 4).map((line, i) => <div className="feed-item" key={`${line}-${i}`}><span className={i === 0 ? "feed-marker current" : "feed-marker"} /><p>{line}</p><span className="feed-time">{i === 0 ? "방금" : `${i}일 전`}</span></div>)}</section>
    </>
  );
}
function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function formatMoney(amount: number): string { return new Intl.NumberFormat("ko-KR").format(amount) + "원"; }
function EventPanel({ event, onChoice }: { event: NonNullable<GameState["pendingEvent"]>; onChoice: (id: string) => void }) {
  return <section className="event-panel"><div className="event-icon">✦</div><div className="event-content"><span className="section-kicker">{event.eyebrow}</span><h2>{event.title}</h2><p>{event.body}</p><div className="choice-list">{event.choices.map((choice, index) => <button className="choice-button" key={choice.id} onClick={() => onChoice(choice.id)}><span className="choice-number">0{index + 1}</span><span className="choice-main"><strong>{choice.title}</strong><small>{choice.detail}</small></span><span className="choice-arrow">→</span></button>)}</div><p className="microcopy">시제품 규칙으로 계산한 결과예요. 현실 통계 기반 확률은 자료를 연결하며 보강합니다.</p></div></section>;
}
function PeopleView({ game }: { game: GameState }) {
  const average = Math.round(game.contacts.reduce((sum, item) => sum + item.warmth, 0) / game.contacts.length);
  return <><PageTitle kicker="PEOPLE & RELATIONSHIPS" title="내 주변 사람들" subtitle="관계는 한 번의 대화보다 쌓인 경험과 현재 상황에 따라 달라져요." /><div className="relationship-overview"><span className="overview-icon">♡</span><div><small>주요 인맥 {game.contacts.length}명</small><strong>관계 온도 평균 {average}</strong></div></div><div className="people-grid">{game.contacts.map((person, index) => <article className="person-card" key={person.id}><div className={`person-avatar avatar-${index % 5}`}>{person.name.slice(0, 1)}</div><div className="person-info"><strong>{person.name}</strong><span>{person.role}</span><small>{person.note}</small></div><div className="warmth-meter"><span style={{ width: `${person.warmth}%` }} /></div></article>)}</div></>;
}
function WorkView({ game }: { game: GameState }) {
  const label = backgroundLabels[game.character.background];
  return <><PageTitle kicker="WORK & ECONOMY" title="일과 경제" subtitle="수입과 지출은 캐릭터의 상황과 선택에 따라 달라집니다." /><div className="economy-hero"><span className="section-kicker">{label} · 임시 시제품 값</span><strong>{formatMoney(game.stats.money)}</strong><small>현재 보유 생활비</small><p>실제 임금·주거비·물가 자료를 연결하기 전의 테스트 잔액이에요.</p></div><div className="panel"><div className="section-kicker">THIS WEEK</div><h2>이번 주의 생활 흐름</h2><p>선택한 배경에 맞는 일·학업 상황을 먼저 검증 중이에요. 직업별 급여·고정 지출은 출처가 확인된 자료를 연결하며 확장합니다.</p></div></>;
}
function GoalsView({ game }: { game: GameState }) {
  const goal = game.character.background === "student" ? "학업과 생활의 균형 찾기" : game.character.background === "jobseeker" ? "내게 맞는 일과 준비 방향 찾기" : "일과 생활의 지속 가능한 리듬 만들기";
  return <><PageTitle kicker="GOALS & GROWTH" title="지금의 목표" subtitle="목표는 상황이 달라지면 바뀔 수 있어요." /><div className="goal-card"><div className="goal-icon">✳</div><span className="section-kicker">추천 목표 · 수정 가능</span><h2>{goal}</h2><p>현재는 시제품 추천이에요. 다음 단계에서 직접 추가·수정하고 진행 과정을 기록할 수 있게 만들 예정입니다.</p><div className="goal-progress"><span style={{ width: "22%" }} /></div><small>첫 걸음 전 · 상황 살펴보기</small></div><div className="panel muted-panel"><h3>이번 주에 남긴 변화</h3><p>{game.lastChoice || "선택한 행동과 생활의 변화가 여기에 모여요."}</p></div></>;
}
function RecordView({ game }: { game: GameState }) {
  return <><PageTitle kicker="LIFE RECORD" title="나의 생애기록" subtitle="중요한 선택과 변화가 시간순으로 쌓입니다." /><div className="timeline">{[...game.log].reverse().map((line, index) => <div className="timeline-row" key={`${line}-${index}`}><span className="timeline-dot" /><div><small>{game.character.year}년 · {index === 0 ? "시작" : `${index}주차`}</small><p>{line}</p></div></div>)}</div></>;
}
function PageTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return <div className="page-title"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{subtitle}</p></div>;
}
function Settings({ game, onClose, onPalette, onUpdate, onExport, onImport, importMessage }: {
  game: GameState; onClose: () => void; onPalette: (palette: Palette) => void;
  onUpdate: (patch: Partial<GameState["settings"]>) => void; onExport: () => void; onImport: (file?: File) => void; importMessage: string;
}) {
  const toggleTopic = (topic: SensitiveTopic) => onUpdate({ topics: { ...game.settings.topics, [topic]: !game.settings.topics[topic] } });
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="section-kicker">PREFERENCES</span><h2 id="settings-title">설정</h2></div><button className="icon-button" aria-label="설정 닫기" onClick={onClose}>×</button></div><div className="setting-group"><strong>화면 색감</strong><div className="palette-options">{(["clean", "warm", "dark"] as Palette[]).map((palette) => <button key={palette} className={game.settings.palette === palette ? "palette-chip selected" : "palette-chip"} onClick={() => onPalette(palette)}>{palette === "clean" ? "기본" : palette === "warm" ? "다이어리" : "어두운 색"}</button>)}</div></div><label className="field"><span>야간 테마 자동 전환</span><select value={game.settings.nightMode} onChange={(event) => onUpdate({ nightMode: event.target.value as GameState["settings"]["nightMode"] })}><option value="off">사용 안 함</option><option value="device">기기 설정 따르기</option><option value="schedule">시간 지정</option></select></label>{game.settings.nightMode === "schedule" && <div className="field-row"><label className="field"><span>시작 시간</span><input type="time" value={game.settings.nightStart} onChange={(event) => onUpdate({ nightStart: event.target.value })} /></label><label className="field"><span>종료 시간</span><input type="time" value={game.settings.nightEnd} onChange={(event) => onUpdate({ nightEnd: event.target.value })} /></label></div>}<div className="setting-group"><strong>사건 주제</strong><p className="microcopy">꺼둔 주제는 관련 사건과 대화에서 제외됩니다.</p>{([["affair", "불륜·외도"], ["illness", "중병"], ["pregnancy", "임신·출산"]] as [SensitiveTopic, string][]).map(([topic, label]) => <label className="toggle-row" key={topic}><span>{label}</span><input type="checkbox" checked={game.settings.topics[topic]} onChange={() => toggleTopic(topic)} /></label>)}</div><div className="setting-group"><strong>저장 파일</strong><div className="button-row"><button className="secondary-button" onClick={onExport}>내보내기</button><label className="secondary-button upload-button">불러오기<input type="file" accept="application/json,.json" onChange={(event) => onImport(event.target.files?.[0])} /></label></div>{importMessage && <p className="inline-message">{importMessage}</p>}<p className="microcopy">게임은 이 브라우저에 자동 저장돼요.</p></div></section></div>;
}
function exportSave(game: GameState) {
  const blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `nanal-${game.character.name}-week${game.week}.json`; link.click(); URL.revokeObjectURL(url);
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
