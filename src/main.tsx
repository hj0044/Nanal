import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  advanceDays, backgroundLabels, chooseEvent, createGame, createSeed, generateContacts, generateName, normalizeContactName, startNextWeek, takeDailyAction,
  type Background, type Character, type CharacterDraft, type Contact, type DailyAction, type GameState, type Palette,
  type SensitiveTopic, type Tab,
} from "./game";
import "./style.css";
import { choosePortraitId, getPortrait, getPortraitImageUrl, portraitPosition } from "./portrait-catalog";

const SAVE_KEY = "nanal-save-v1";
const backgroundChoices: Background[] = ["student", "jobseeker", "worker"];
const regions = ["서울", "인천", "경기", "부산", "대구"];
const housingChoices = ["가족과 동거", "자취", "기숙사", "전세·월세 동거"];
const emptyDraft: CharacterDraft = { name: "", age: "", year: "", background: "", gender: "", region: "", housing: "", education: "", family: "", startingMoney: "" };
function portraitStyle(portraitId?: string): React.CSSProperties {
  const portrait = getPortrait(portraitId);
  return { backgroundImage: `url("${getPortraitImageUrl(portraitId)}")`, backgroundSize: portrait?.source === "atlas" ? "400% 400%" : "cover", backgroundPosition: portraitPosition(portraitId) };
}

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1 || !parsed.character || !parsed.stats || !Array.isArray(parsed.contacts)) return null;
    return normalizeSave(parsed);
  } catch { return null; }
}
function normalizeSave(parsed: GameState): GameState {
  const savedPlayerPortraitId = parsed.character.portraitId;
  const playerPortraitId = savedPlayerPortraitId && getPortrait(savedPlayerPortraitId)?.gender === parsed.character.gender
    ? savedPlayerPortraitId : createGame(parsed.character, parsed.seed).character.portraitId;
  const generated = generateContacts(parsed.character.background, parsed.seed, parsed.character.age, playerPortraitId ? [playerPortraitId] : []);
  const usedPortraitIds = playerPortraitId ? [playerPortraitId] : [];
  return {
    ...parsed,
    character: { ...parsed.character, portraitId: playerPortraitId },
    recentEventIds: parsed.recentEventIds ?? [],
    contacts: parsed.contacts.map((person, index) => {
      const merged = { ...generated[index], ...person };
      const age = person.age ?? generated[index]?.age ?? parsed.character.age;
      let portraitId = person.portraitId;
      if (!portraitId || usedPortraitIds.includes(portraitId) || getPortrait(portraitId)?.gender !== merged.gender) {
        portraitId = choosePortraitId(merged.gender ?? generated[index]?.gender ?? "여성", age, createSeed(`${parsed.seed}:${merged.id}`), usedPortraitIds);
      }
      usedPortraitIds.push(portraitId);
      return {
        ...merged, name: normalizeContactName(merged.name, merged.gender ?? "여성", createSeed(`${parsed.seed}:${merged.id}:name`)), age, portraitId,
        portraitAgeBand: getPortrait(portraitId)?.ageBand,
        occupation: person.occupation ?? generated[index]?.occupation,
        personality: person.personality ?? generated[index]?.personality,
        goal: person.goal ?? generated[index]?.goal,
      };
    }),
  };
}
function App() {
  const [game, setGame] = useState<GameState | null>(() => readSave());
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft);
  const [tab, setTab] = useState<Tab>("life");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Contact | null>(null);
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
    const gender = Math.random() > 0.5 ? "남성" : "여성";
    setDraft({
      name: generateName(gender, Math.floor(Math.random() * 0xffffffff)),
      age, year: 2020 + Math.floor(Math.random() * 7), background,
      gender,
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
      setGame(normalizeSave(parsed)); setShowCreator(false); setImportMessage("저장 파일을 불러왔어요.");
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
        {tab === "life" && <LifeView game={game} onAdvance={(days) => updateGame((current) => advanceDays(current, days))} onAction={(action) => updateGame((current) => takeDailyAction(current, action))} onChoice={(id) => updateGame((current) => chooseEvent(current, id))} onNextWeek={() => updateGame(startNextWeek)} onSelectPerson={setSelectedPerson} />}
        {tab === "people" && <PeopleView game={game} onSelectPerson={setSelectedPerson} />}
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
      {selectedPerson && <PersonDetails person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
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

function LifeView({ game, onAdvance, onAction, onChoice, onNextWeek, onSelectPerson }: { game: GameState; onAdvance: (days: 1 | 3 | 7) => void; onAction: (action: DailyAction) => void; onChoice: (id: string) => void; onNextWeek: () => void; onSelectPerson: (person: Contact) => void }) {
  const [showResult, setShowResult] = useState(false);
  const date = new Date(game.character.year, 0, (game.week - 1) * 7 + game.day);
  const dateLabel = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
  const featured = game.contacts[0];
  const energyLabel = game.stats.energy >= 70 ? "좋음" : game.stats.energy >= 40 ? "보통" : "피곤함";
  const scheduleLabel = game.phase === "event" ? "이벤트 선택" : game.phase === "summary" ? "주간 정산" : "일상 진행";
  const actionUsed = (game.actionDays ?? []).includes(`${game.week}-${game.day}`);
  const notableNpc = [...game.contacts].sort((a, b) => b.warmth - a.warmth)[0];
  useEffect(() => { setShowResult(Boolean(game.lastChoice)); }, [game.lastChoice]);
  return (
    <>
      <section className="home-hero">
        <div className="home-hero-copy"><span className="home-date">{dateLabel} ({weekday}) · {game.week}주차</span><h1>오늘도 좋은 하루예요!</h1><p>{game.character.name}님, 지금도 충분히 잘하고 있어요.</p><div className="home-profile-tags"><span>{game.character.age}세</span><span>{game.character.region}</span><span>{backgroundLabels[game.character.background]}</span></div></div>
        <div className="illustrated-portrait home-portrait" style={portraitStyle(game.character.portraitId)} role="img" aria-label={`${game.character.name} 캐릭터 일러스트`} />
      </section>
      <section className="stats-grid home-stats" aria-label="오늘의 생활 요약">
        <StatCard label="소지금" value={formatMoney(game.stats.money)} detail="현재 보유 자금" tone="blue" />
        <StatCard label="건강 상태" value={energyLabel} detail={`컨디션 ${game.stats.energy}%`} tone="rose" />
        <StatCard label="오늘 일정" value={scheduleLabel} detail={`${game.day}일째 · ${game.phase === "playing" ? "하루 진행 가능" : "확인 필요"}`} tone="violet" />
      </section>
      {game.phase === "event" && game.pendingEvent && <EventPanel event={game.pendingEvent} onChoice={onChoice} />}
      {game.phase === "summary" && <section className="panel summary-panel"><div className="section-kicker">WEEKLY REVIEW</div><h2>이번 주를 돌아봤어요</h2><p>선택과 일정이 생활에 남았어요. 결과는 한 번의 성공이나 실패로 단정되지 않고 다음 주로 이어집니다.</p>{notableNpc && <p className="npc-weekly-note"><strong>{notableNpc.name}의 한 주</strong> · {notableNpc.lastAutonomousAction ?? notableNpc.note} 지금은 “{notableNpc.goal ?? "자기만의 방향 찾기"}” 목표를 {notableNpc.goalStage ?? "살펴보는 중"}이고, {notableNpc.mood ?? "평소와 같은 상태"}예요.</p>}<div className="summary-chips"><span>에너지 {game.stats.energy}%</span><span>기분 {game.stats.mood}%</span><span>관계 {Math.round(game.contacts.reduce((sum, person) => sum + person.warmth, 0) / game.contacts.length)} 평균</span></div><button className="primary-button" onClick={onNextWeek}>다음 주 시작 <span>→</span></button></section>}
      {game.phase === "playing" && (
        <section className="next-card">
          <div className="next-copy"><span className="section-kicker">TODAY · DAILY CHOICE</span><h2>오늘은 어떻게 보낼까요?</h2><p>오늘 행동을 고르면 하루가 진행돼요. 여러 날 진행은 아래에서 선택할 수 있어요.</p><div className="daily-actions">{([
            ["focus", game.character.background === "worker" ? "업무 집중" : game.character.background === "jobseeker" ? "구직 준비" : "공부하기", "집중도↑ · 체력 소모"],
            ["rest", "충분히 쉬기", "에너지↑ · 스트레스↓"],
            ["social", "가까운 사람 만나기", "기분↑ · 관계 온도↑"],
            ["organize", "생활 정리하기", "집중도↑ · 부담↓"],
          ] as [DailyAction, string, string][]).map(([action, title, detail]) => <button className="daily-action" key={action} disabled={actionUsed} onClick={() => { setShowResult(false); onAction(action); }}><strong>{title}</strong><small>{actionUsed ? "오늘 행동을 이미 선택했어요" : detail}</small></button>)}</div><div className="advance-options"><span className="fast-forward-label">그냥 진행</span>{([1, 3, 7] as const).map((days) => <button className="advance-button secondary-advance" key={days} onClick={() => { setShowResult(false); onAdvance(days); }}><span>{days === 1 ? "하루" : `${days}일`}</span><span className="arrow">→</span></button>)}</div></div>
        </section>
      )}
      {showResult && game.lastChoice && <div className="toast-result"><span className="toast-check">✓</span><span>{game.lastChoice}</span><button onClick={() => setShowResult(false)} aria-label="닫기">×</button></div>}
      {featured && <section className="feed-section"><div className="section-heading"><div><span className="section-kicker">PEOPLE AROUND YOU</span><h2>이번 생활의 인물</h2></div><span className="quiet-label">누르면 상세 정보</span></div><button className="featured-person" onClick={() => onSelectPerson(featured)}><span className="illustrated-portrait featured-portrait" style={portraitStyle(featured.portraitId)} aria-hidden="true" /><span className="featured-copy"><strong>{featured.name} · {featured.role}</strong><span>{game.lastChoice || featured.note}</span><small>관계 온도 {featured.warmth} · 자세히 보기</small></span><span className="featured-arrow">›</span></button><div className="recent-log"><div className="section-heading"><h2>최근 이야기</h2><span className="quiet-label">이번 생의 흐름</span></div>{game.log.slice(0, 2).map((line, i) => <div className="feed-item" key={`${line}-${i}`}><span className={i === 0 ? "feed-marker current" : "feed-marker"} /><p>{line}</p><span className="feed-time">{i === 0 ? "방금" : "이전"}</span></div>)}</div></section>}
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
function PeopleView({ game, onSelectPerson }: { game: GameState; onSelectPerson: (person: Contact) => void }) {
  const average = Math.round(game.contacts.reduce((sum, item) => sum + item.warmth, 0) / game.contacts.length);
  return <><PageTitle kicker="PEOPLE & RELATIONSHIPS" title="내 주변 사람들" subtitle="인물을 누르면 지금까지 쌓인 관계와 기억을 볼 수 있어요." /><div className="relationship-overview"><span className="overview-icon">♡</span><div><small>주요 인맥 {game.contacts.length}명</small><strong>관계 온도 평균 {average}</strong></div></div><div className="people-grid">{game.contacts.map((person, index) => <button className="person-card" key={person.id} onClick={() => onSelectPerson(person)} aria-label={`${person.name} 상세 정보 열기`}><span className={`illustrated-portrait person-avatar avatar-${index % 5}`} style={portraitStyle(person.portraitId)} aria-hidden="true" /><span className="person-info"><strong>{person.name}</strong><span>{person.role}</span><small>{person.mood ?? "평소와 같음"} · {person.lastAutonomousAction ?? person.note}</small></span><span className="warmth-meter"><span style={{ width: `${person.warmth}%` }} /></span><span className="person-open-hint">상세 보기 <b>›</b></span></button>)}</div></>;
}
function closenessLabel(warmth: number) { return warmth >= 75 ? "가까운 사이" : warmth >= 50 ? "알아가는 중" : warmth >= 25 ? "가벼운 인맥" : "아직 서먹함"; }
function PersonDetails({ person, onClose }: { person: Contact; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="person-details-modal" role="dialog" aria-modal="true" aria-labelledby="person-details-title" onClick={(event) => event.stopPropagation()}><div className="person-detail-cover"><button className="icon-button person-detail-close" aria-label="상세 정보 닫기" onClick={onClose}>×</button><span className="illustrated-portrait detail-portrait" style={portraitStyle(person.portraitId)} /></div><div className="person-detail-body"><span className="section-kicker">RELATIONSHIP PROFILE</span><h2 id="person-details-title">{person.name}</h2><p className="person-detail-role">{person.role}{person.gender ? ` · ${person.gender}` : ""}</p><div className="profile-facts"><div><small>나이</small><strong>{person.age ?? "미상"}세</strong></div><div><small>직업</small><strong>{person.occupation ?? "정보 없음"}</strong></div><div><small>성격</small><strong>{person.personality ?? "조금씩 알아가는 중"}</strong></div><div><small>요즘 목표</small><strong>{person.goal ?? "아직 알 수 없음"}</strong></div><div><small>목표 진행</small><strong>{person.goalStage ?? "진행 전"}</strong></div><div><small>요즘 상태</small><strong>{person.mood ?? "평소와 같음"}</strong></div></div><div className="relationship-score"><div><span>관계 온도</span><strong>{person.warmth}<small>/100</small></strong></div><b>{closenessLabel(person.warmth)}</b></div><div className="warmth-meter detail-meter"><span style={{ width: `${person.warmth}%` }} /></div><section className="memory-card"><span className="section-kicker">최근 기억</span><p>{person.memories?.[0]?.text ?? person.note}</p>{person.memories?.[0] && <small>기억 선명도 {Math.round(person.memories[0].vividness * 100)}% · {person.memories[0].week}주차</small>}<p className="memory-action">{person.lastAutonomousAction ?? "아직 최근 행동 기록이 없어요."}</p></section><p className="person-detail-footnote">인물의 성격과 목표는 관계와 사건을 거치며 더 구체적으로 드러나요.</p><button className="primary-button full" onClick={onClose}>확인</button></div></section></div>;
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
