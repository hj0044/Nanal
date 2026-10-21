import { useEffect, useState, type ReactNode } from "react";
import {
  ACTIONS, BACKGROUNDS, chooseEvent, createGame, finishWeek, formatMoney,
  takeAction, type ActionId, type Background, type GameState, type TabId,
} from "./game";

const SAVE_KEY = "nanal-save-v1";
const tabs: { id: TabId; icon: string; label: string }[] = [
  { id: "life", icon: "⌂", label: "생활" },
  { id: "people", icon: "♡", label: "인물" },
  { id: "growth", icon: "↗", label: "성장" },
  { id: "assets", icon: "₩", label: "자산" },
  { id: "record", icon: "▤", label: "기록" },
];

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    return data?.version === 1 && Array.isArray(data.npcs) && Array.isArray(data.log) ? data : null;
  } catch { return null; }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(() => readSave());
  const [tab, setTab] = useState<TabId>("life");
  const [name, setName] = useState("");
  const [age, setAge] = useState(24);
  const [year, setYear] = useState(2026);
  const [background, setBackground] = useState<Background>("student");
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  }, [game]);

  const update = (fn: (current: GameState) => GameState) => {
    setGame((current) => current ? fn(current) : current);
  };
  const start = () => {
    const created = createGame({ name, age, year, background });
    setGame(created);
    setTab("life");
  };
  const onChoice = (id: string) => update((current) => chooseEvent(current, id));
  const onAction = (id: ActionId) => {
    if (id === "connect" && !targetId) {
      setTargetId(game?.npcs[0]?.id ?? "");
      return;
    }
    update((current) => takeAction(current, id, id === "connect" ? targetId : undefined));
    if (id === "connect") setTargetId("");
  };
  const endWeek = () => update(finishWeek);
  const reset = () => {
    if (window.confirm("현재 인생을 지우고 새 게임을 시작할까요? 저장 파일로 내보낸 뒤 진행해도 돼요.")) {
      localStorage.removeItem(SAVE_KEY);
      setGame(null);
      setTab("life");
    }
  };
  const exportSave = () => {
    if (!game) return;
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nanal-${game.name}-week-${game.week}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importSave = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as GameState;
        if (imported.version !== 1 || !Array.isArray(imported.npcs) || !Array.isArray(imported.log) || typeof imported.rngState !== "number") throw new Error();
        setGame(imported);
        setTab("life");
      } catch { window.alert("Nanal 저장 파일을 읽지 못했어요. 파일이 손상됐거나 지원하지 않는 버전입니다."); }
    };
    reader.readAsText(file);
  };

  if (!game) return <main className="create-screen">
    <div className="brand-mark">N</div>
    <p className="eyebrow">나의 하루가 쌓여 한 인생이 되는 곳</p>
    <h1>어떤 삶을<br /><em>시작해볼까요?</em></h1>
    <p className="intro-copy">짧은 선택 하나가 다음 주의 사람과 생활을 바꿉니다.</p>
    <section className="form-card">
      <label className="field-label">이름
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 적어주세요" maxLength={16} />
      </label>
      <div className="form-row">
        <label className="field-label">나이
          <select value={age} onChange={(e) => setAge(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 19).map((n) => <option key={n} value={n}>{n}세</option>)}</select>
        </label>
        <label className="field-label">시작 연도
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>{Array.from({ length: 7 }, (_, i) => 2020 + i).map((n) => <option key={n} value={n}>{n}년</option>)}</select>
        </label>
      </div>
      <fieldset className="background-picker">
        <legend className="field-label">지금의 나</legend>
        {(Object.keys(BACKGROUNDS) as Background[]).map((key) => <button type="button" className={background === key ? "background-option selected" : "background-option"} onClick={() => setBackground(key)} key={key}>
          <span>{key === "student" ? "📚" : key === "jobseeker" ? "🌱" : "💼"}</span>
          <strong>{BACKGROUNDS[key].label}</strong>
          <small>{BACKGROUNDS[key].goal}</small>
        </button>)}
      </fieldset>
      <div className="goal-preview"><span>이번 인생의 출발점</span><strong>{BACKGROUNDS[background].intro}</strong></div>
      <button className="primary-button" onClick={start}>첫 주를 시작하기 <span>→</span></button>
      <p className="tiny-note">게임은 이 기기에 자동 저장돼요. 초상화 없이 텍스트 중심으로 진행됩니다.</p>
    </section>
  </main>;

  const event = game.pendingEvent;
  const selectedNpc = game.npcs.find((npc) => npc.id === targetId);
  return <div className="app-shell">
    <header className="topbar">
      <div className="mini-brand"><span>N</span><div><b>Nanal</b><small>나의 하루들</small></div></div>
      <button className="icon-button" onClick={exportSave} aria-label="저장 파일 내보내기" title="저장 파일 내보내기">↥</button>
    </header>
    <main className="screen-content">
      {tab === "life" && <>
        <section className="welcome-row">
          <div><p className="eyebrow">{game.year}년 · {game.week}주차</p><h1>{game.name}의 <em>이번 주</em></h1><p className="subline">{game.age}세 · {BACKGROUNDS[game.background].label}</p></div>
          <div className="season-chip">🗓️<small>한 주</small></div>
        </section>
        <div className="goal-banner"><span>지금 마음에 둔 목표</span><strong>{game.playerGoal}</strong></div>
        <section className="stat-grid">
          <Stat label="가진 돈" value={formatMoney(game.cash)} icon="₩" />
          <Stat label="에너지" value={`${game.energy}%`} icon="☼" level={game.energy} />
          <Stat label="긴장도" value={`${game.stress}%`} icon="〰" level={game.stress} warning />
          <Stat label="준비도" value={`${game.skill}%`} icon="✧" level={game.skill} />
        </section>
        {game.lastWeekSummary.length > 0 && <section className="summary-card">
          <div className="card-heading"><div><p className="eyebrow">지난주 기록</p><h2>한 주가 지나갔어요</h2></div><span className="heading-icon">✓</span></div>
          {game.lastWeekSummary.map((line) => <p className="summary-line" key={line}>{line}</p>)}
        </section>}
        {event && <section className="event-card">
          <div className="event-meta"><span className="live-dot" />시간이 잠깐 멈췄어요 <span>{event.dateLabel}</span></div>
          <h2>{event.title}</h2><p className="event-body">{event.body}</p>
          <div className="choice-list">{event.choices.map((choice, index) => <button className="choice-button" key={choice.id} onClick={() => onChoice(choice.id)}>
            <span className="choice-number">0{index + 1}</span><span className="choice-copy"><strong>{choice.label}</strong><small>{choice.hint}</small></span><span className="choice-arrow">›</span>
          </button>)}</div>
        </section>}
        {!event && <section className="actions-card">
          <div className="card-heading"><div><p className="eyebrow">이번 주에 할 수 있는 일</p><h2>어디에 시간을 쓸까요?</h2></div><span className="action-counter">{game.actionsLeft}/2</span></div>
          <p className="section-note">{game.actionsLeft > 0 ? "두 가지 행동을 골라 한 주를 채워보세요." : "이번 주 행동을 다 골랐어요. 주간 정리를 눌러 다음 주로 가요."}</p>
          {game.actionsLeft > 0 && <div className="action-grid">{ACTIONS.map((action) => <button className="action-button" key={action.id} onClick={() => onAction(action.id)} disabled={action.id === "connect" && !targetId}>
            <span className="action-icon">{action.icon}</span><strong>{action.title}</strong><small>{action.detail}</small>
          </button>)}</div>}
          {game.actionsLeft > 0 && <div className="connect-row">
            <label htmlFor="npc-target">함께 시간을 보낼 사람</label>
            <select id="npc-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">사람을 선택하세요</option>{game.npcs.map((npc) => <option key={npc.id} value={npc.id}>{npc.name} · {npc.role}</option>)}</select>
            {selectedNpc && <small>{selectedNpc.name}의 목표: {selectedNpc.goal.title}</small>}
          </div>}
          {game.actionsLeft === 0 && <button className="primary-button" onClick={endWeek}>이번 주 정리하고 다음 주로 <span>→</span></button>}
        </section>}
        <section className="recent-card"><div className="card-heading"><div><p className="eyebrow">방금 쌓인 이야기</p><h2>최근 기록</h2></div><button className="text-link" onClick={() => setTab("record")}>모두 보기</button></div>
          {game.log.slice(0, 2).map((entry) => <div className="recent-entry" key={entry.id}><span className="entry-dot" /><div><strong>{entry.category}</strong><p>{entry.text}</p></div></div>)}
        </section>
      </>}
      {tab === "people" && <PageTitle eyebrow="관계와 각자의 삶" title="주변 사람들"><p className="page-intro">이 사람들도 자기 목표와 하루를 살아가요. 관계가 가까워질수록 더 많은 변화가 내게 전해집니다.</p>
        <div className="npc-list">{game.npcs.map((npc) => <article className="npc-card" key={npc.id}>
          <div className="npc-head"><div className="avatar-placeholder">{npc.name.slice(0, 1)}</div><div className="npc-title"><h2>{npc.name}</h2><p>{npc.age}세 · {npc.role}</p></div><span className="mood-tag">{npc.mood}</span></div>
          <div className="npc-goal"><span>요즘 이 사람의 목표</span><strong>{npc.goal.title}</strong><small>{npc.goal.stage} · {npc.goal.progress}/3</small></div>
          <div className="relationship-bars"><Meter label="친밀감" value={Math.round((npc.affinity + 5) * 10)} /><Meter label="신뢰" value={npc.trust} /></div>
          <div className="npc-last"><b>최근 소식</b><span>{npc.lastAction}</span></div>
          {npc.memories[0] && <div className="memory-line">“{npc.memories[0].text}” <small>기억 선명도 {Math.round(npc.memories[0].vividness * 100)}%</small></div>}
        </article>)}</div>
      </PageTitle>}
      {tab === "growth" && <PageTitle eyebrow="방향과 변화" title="내가 가는 길">
        <p className="page-intro">목표는 성적표가 아니에요. 지금 원하는 방향을 적어두고, 생활 변화에 맞춰 다시 정해도 괜찮아요.</p>
        <section className="panel goal-edit"><label className="field-label">중심 목표<input value={game.playerGoal} maxLength={60} onChange={(e) => setGame({ ...game, playerGoal: e.target.value })} /></label><p className="tiny-note">목표 문구는 직접 수정할 수 있어요. 이번 프로토타입에서는 진행률 대신 준비도와 실제 기록을 보여줍니다.</p></section>
        <section className="panel"><div className="card-heading"><div><p className="eyebrow">이번 주의 기반</p><h2>쌓이는 준비</h2></div></div><Meter label="준비도" value={game.skill} /><Meter label="에너지" value={game.energy} /><Meter label="긴장도" value={game.stress} /></section>
      </PageTitle>}
      {tab === "assets" && <PageTitle eyebrow="생활의 바탕" title="돈과 생활">
        <p className="page-intro">돈은 한 번의 숫자보다 수입과 지출의 흐름으로 살펴봐요. 단순한 임시 밸런스이며, 실제 통계 모델은 추후 연결됩니다.</p>
        <section className="money-hero"><span>현재 현금</span><strong>{formatMoney(game.cash)}</strong><small>{BACKGROUNDS[game.background].label} · {game.year}년 설정</small></section>
        <div className="stat-grid two"><Stat label="주간 수입 기준" value={game.background === "worker" ? "65만원" : game.background === "student" ? "12.5만원" : "없음"} icon="↗" /><Stat label="주간 생활비 기준" value={game.background === "worker" ? "23만원" : game.background === "student" ? "10.5만원" : "16.5만원"} icon="↘" /></div>
        <section className="panel"><p className="eyebrow">밸런스 안내</p><p>첫 주 프로토타입에서는 배경별 임시 금액으로 흐름만 검증해요. 지역·주거·가족 설정이 연결되면 생활비와 가족 지원을 함께 계산합니다.</p></section>
      </PageTitle>}
      {tab === "record" && <PageTitle eyebrow="선택이 남긴 흔적" title="지나온 이야기">
        <p className="page-intro">사건과 행동, 인물들의 변화가 시간순으로 남아요. 기억은 시간이 지나면 흐려져도 기록은 이어집니다.</p>
        <section className="timeline">{game.log.map((entry) => <article className="timeline-entry" key={entry.id}><span className="timeline-mark" /><div><div className="timeline-meta"><b>{entry.category}</b><span>{entry.week}주차</span></div><p>{entry.text}</p></div></article>)}</section>
      </PageTitle>}
      <section className="save-tools"><label className="text-link file-button">저장 파일 가져오기<input type="file" accept="application/json,.json" onChange={(e) => importSave(e.target.files?.[0])} /></label><button className="text-link danger" onClick={reset}>새 인생 시작</button></section>
    </main>
    <nav className="bottom-nav" aria-label="주요 메뉴">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
  </div>;
}

function Stat({ label, value, icon, level, warning = false }: { label: string; value: string; icon: string; level?: number; warning?: boolean }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong>{level !== undefined && <div className="meter-track"><i className={warning ? "warning" : ""} style={{ width: `${level}%` }} /></div>}</div>;
}
function Meter({ label, value }: { label: string; value: number }) {
  return <div className="meter-row"><span>{label}</span><div className="meter-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div><b>{value}</b></div>;
}
function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="page-view"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</section>;
}
