'use client';
import { useState, useEffect, useRef } from 'react';
import { I } from '@/components/ui/Icons';
import ThoughtBlock from './ThoughtBlock';
import UserBubble from './UserBubble';
import AgentResponse from './AgentResponse';
import { useUsage, recordUse, deriveStatus, formatCooldown, DAILY_LIMIT } from '@/lib/usageLimit';
import { streamAgent } from '@/lib/streamAgent';
import { mockAgentReply } from '@/lib/agentReply';
import CardRenderer from '@/components/chat/cards/CardRenderer';

const PARCEL_ID = '전북 남원시 산내면 산 32-1';

function StatusBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-wgreen/10 px-2.5 py-1 text-[11px] font-semibold text-wgreen">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wgreen opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-wgreen" />
      </span>
      <span>시스템 정상</span>
      <span className="text-wgreen/70 font-medium">· v2.4.1</span>
    </div>
  );
}

const INITIAL_STEPS = [
  { tool: 'search_forest_knowledge', tag: 'KNOW-RAG', icon: I.Search,   detail: '남원시 조례 및 산지관리법 §20, KFRI-KNOW 매뉴얼 14건 검토', state: 'idle', ms: 980,  output: '• 산림보호법 §9, 산지관리법 §20 · 매칭 11건\n• 「남원시 산림자원 조성·관리 조례」 §7 발견' },
  { tool: 'apis.data.go.kr/forest/pinedamage', tag: '외부 API', icon: I.Camera,  detail: '무인기 다중분광 영상 84프레임 · 소나무 수피 SAM 마스킹 추론', state: 'idle', ms: 2140, output: '고사목 후보 41주 / 재선충 의심 7주 (conf. 0.914)' },
  { tool: 'calculate_slope_grid', tag: 'GIS',      icon: I.Mountain, detail: '5m DEM × 12,840셀 · 평균경사도 + 위험구역 마스크 생성',         state: 'idle', ms: 610,  output: 'avg_slope = 18.7° · over25_ratio = 0.31\nharvest_polygon = 4.6ha' },
];

function nowLabel() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${m}`;
}

export default function ChatPane({ onShowMap, persona, onChangePersona }) {
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [thoughtExpanded, setThoughtExpanded] = useState(true);
  const [showAgentMsg, setShowAgentMsg] = useState(false);
  const [active, setActive] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]); // 후속 턴
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef(null);

  const usage = useUsage();
  const status = deriveStatus(usage, now);

  // 쿨타임 카운트다운 (1초 틱)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function send(raw) {
    const text = (raw ?? input).trim();
    if (!text || pending) return;
    if (!status.canUse) return; // 사용 제한 (일일 한도/쿨타임)
    recordUse();
    setMessages(m => [...m, { id: Date.now(), role: 'user', text, time: nowLabel() }]);
    setInput('');
    setPending(true);

    // 답변 토큰/카드를 한 버블에 실시간 누적 (첫 이벤트 도착 시 버블 생성).
    // agentId 할당은 setMessages 업데이터 밖에서(부수효과 없는 순수 업데이터) — StrictMode 이중호출/레이스 방지.
    let agentId = null;
    const ensureId = () => (agentId ??= Date.now() + 1);
    const upsert = (delta) => {
      setPending(false);
      const id = ensureId();
      setMessages(m =>
        m.some(x => x.id === id)
          ? m.map(x => (x.id === id ? { ...x, text: x.text + delta } : x))
          : [...m, { id, role: 'agent', text: delta, time: nowLabel() }],
      );
    };

    const addCard = (card) => {
      setPending(false);
      const id = ensureId();
      setMessages(m =>
        m.some(x => x.id === id)
          ? m.map(x => (x.id === id ? { ...x, cards: [...(x.cards ?? []), card] } : x))
          : [...m, { id, role: 'agent', text: '', cards: [card], time: nowLabel() }],
      );
    };

    try {
      await streamAgent(
        { query: text, personaId: persona?.id, parcelId: PARCEL_ID },
        { onAnswer: upsert, onCard: addCard },
      );
      if (agentId == null) throw new Error('empty stream');
    } catch {
      // 네트워크/스트림 실패 → 로컬 mock 폴백
      const { answer, cards } = mockAgentReply(text, persona?.id);
      setMessages(m => [...m, { id: Date.now() + 1, role: 'agent', text: answer, cards, time: nowLabel() }]);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  useEffect(() => {
    const timers = [
      setTimeout(() => setSteps(s => s.map((x, i) => i === 0 ? { ...x, state: 'active' } : x)), 250),
      setTimeout(() => setSteps(s => s.map((x, i) => i === 0 ? { ...x, state: 'done' } : i === 1 ? { ...x, state: 'active' } : x)), 1500),
      setTimeout(() => setSteps(s => s.map((x, i) => i <= 1 ? { ...x, state: 'done' } : i === 2 ? { ...x, state: 'active' } : x)), 3000),
      setTimeout(() => {
        setSteps(s => s.map(x => ({ ...x, state: 'done' })));
        setActive(false);
        setShowAgentMsg(true);
        setTimeout(() => setThoughtExpanded(false), 1200);
      }, 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [showAgentMsg, thoughtExpanded, messages, pending]);

  return (
    <div className="flex h-full flex-col bg-white lg:border-r border-wline">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-wline px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-wgreen/10 text-wgreen ring-1 ring-wgreen/20">
            <I.Trees size={17} stroke={2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[14px] font-bold text-wink truncate">NIFOS 산림 지능형 에이전트</h1>
              <span className="text-[10px] font-mono text-wsub bg-wbg px-1 rounded">BETA</span>
            </div>
            <div className="text-[10.5px] text-wsub truncate">국립산림과학원 · 산림 행정·기술 컨설턴트</div>
          </div>
        </div>
        <StatusBadge />
      </div>

      {/* Workspace tabs */}
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-1 border-b border-wline bg-wbg/40">
        <button className="flex items-center gap-1.5 rounded-md bg-white text-wink shadow-sm border border-wline px-2.5 py-1 text-[11.5px] font-semibold">
          <I.MessageSquare size={12} /> 남원 산내면 #SLO-2024-31
        </button>
        <button className="flex items-center gap-1.5 rounded-md text-wsub hover:bg-white px-2.5 py-1 text-[11.5px]">
          <I.Plus size={12} /> 새 세션
        </button>
        {persona && (
          <button
            onClick={onChangePersona}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-wline bg-white px-2 py-1 text-[10.5px] text-wsub hover:text-wink hover:border-wink/30 transition"
            title="페르소나 변경"
          >
            {(() => { const Ic = I[persona.icon] ?? I.Trees; return <Ic size={11} className="text-wblue-600" />; })()}
            <span className="font-semibold text-wink">{persona.title}</span>
            <I.ChevDown size={11} />
          </button>
        )}
      </div>

      {/* Scroll body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll p-4 space-y-4">
        <div className="flex items-center justify-center gap-2 text-[10.5px] text-wsub">
          <span className="h-px flex-1 bg-wline" />
          <span>오늘 · 14:11</span>
          <span className="h-px flex-1 bg-wline" />
        </div>

        <UserBubble
          time="오후 2:11"
          text={
            <>
              <span className="block">남원 산불 피해지역 사유림(경사도 <strong>15도 부근</strong>)에서</span>
              <span className="block">고사목을 수확하고 싶어. <strong>법적 검토</strong>랑 <strong>AI 로봇</strong>을 투입할 때</span>
              <span className="block">수확 효율성 시뮬레이션 돌려줘.</span>
            </>
          }
        />

        <div className="flex gap-2.5">
          <div className={`h-7 w-7 shrink-0 rounded-full grid place-items-center text-white shadow-sm transition ${active ? 'bg-wblue-500 pulse-soft' : 'bg-wink'}`}>
            <I.Sparkles size={13} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <ThoughtBlock
              steps={steps}
              expanded={thoughtExpanded}
              onToggle={() => setThoughtExpanded(e => !e)}
              active={active}
            />
          </div>
        </div>

        {showAgentMsg && <AgentResponse onShowMap={onShowMap} />}

        {/* 후속 대화 턴 */}
        {messages.map(msg => msg.role === 'user' ? (
          <UserBubble key={msg.id} time={msg.time} text={msg.text} />
        ) : (
          <div key={msg.id} className="flex gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-wink text-white grid place-items-center shadow-sm">
              <I.Sparkles size={13} />
            </div>
            <div className="flex-1 min-w-0">
              {msg.text && (
                <div className="rounded-2xl rounded-tl-md border border-wline bg-white p-3.5 shadow-card slide-up ai-prose">
                  {msg.text}
                </div>
              )}
              {msg.cards?.length > 0 && <CardRenderer cards={msg.cards} onShowMap={onShowMap} />}
              <div className="text-[10.5px] text-wsub mt-1 pl-1">{msg.time}</div>
            </div>
          </div>
        ))}

        {/* 응답 생성 중 표시 */}
        {pending && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-wblue-500 text-white grid place-items-center shadow-sm pulse-soft">
              <I.Sparkles size={13} />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-wline bg-white px-4 py-3 shadow-card">
              <span className="thought-dot" /><span className="thought-dot" /><span className="thought-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-wline bg-white px-4 py-3">
        {/* 사용 제한 표시 (일 3회 · 쿨타임 30분) */}
        <div className="mb-2 flex items-center justify-between gap-2 text-[10.5px]">
          <div className="flex items-center gap-1.5 text-wsub">
            <I.Activity size={11} />
            <span>오늘 남은 질의</span>
            <span className="flex items-center gap-0.5">
              {Array.from({ length: DAILY_LIMIT }).map((_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < status.remaining ? 'bg-wblue-500' : 'bg-wline'}`} />
              ))}
            </span>
            <span className="font-semibold text-wink tabular-nums">{status.remaining}/{DAILY_LIMIT}</span>
          </div>
          {status.dailyExhausted ? (
            <span className="flex items-center gap-1 font-semibold text-wred">
              <I.TriangleAlert size={11} /> 오늘 한도 소진 · 내일 초기화
            </span>
          ) : status.cooldownLeft > 0 ? (
            <span className="flex items-center gap-1 font-semibold text-worange tabular-nums">
              <I.Clock size={11} /> 쿨타임 {formatCooldown(status.cooldownLeft)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-wgreen font-semibold">
              <I.CheckCircle size={11} /> 질의 가능
            </span>
          )}
        </div>

        <div className={`relative rounded-xl border bg-wbg/60 transition ${
          status.canUse
            ? 'border-wline focus-within:border-wblue-400 focus-within:bg-white focus-within:shadow-focus'
            : 'border-wline opacity-60'
        }`}>
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!status.canUse}
            placeholder={
              status.dailyExhausted ? '오늘 사용 한도(3회)를 모두 사용했습니다. 내일 다시 이용해 주세요.'
              : status.cooldownLeft > 0 ? `API 트래픽 보호를 위한 쿨타임 — ${formatCooldown(status.cooldownLeft)} 후 질의 가능`
              : '후속 질문이나 추가 분석을 요청하세요 (예: 임도 추가 시 수확량 시뮬레이션)'
            }
            className="block w-full resize-none bg-transparent px-3.5 pt-3 pb-9 text-[13px] placeholder-wsub focus:outline-none disabled:cursor-not-allowed"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <button className="grid h-7 w-7 place-items-center rounded-md text-wsub hover:bg-white hover:text-wink"><I.Paperclip size={14} /></button>
              <button className="grid h-7 w-7 place-items-center rounded-md text-wsub hover:bg-white hover:text-wink"><I.Mic size={14} /></button>
              <span className="text-[10.5px] text-wsub ml-1">⌘K · 도구 선택</span>
            </div>
            <button
              onClick={() => send()}
              disabled={pending || !input.trim() || !status.canUse}
              className="inline-flex items-center gap-1 rounded-md bg-wblue-500 hover:bg-wblue-600 disabled:bg-wline disabled:text-wsub disabled:cursor-not-allowed text-white px-2.5 py-1.5 text-[11.5px] font-semibold focus-ring transition"
            >
              <I.Send size={12} /> 전송
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {['임도 노선 자동 설계', '재선충 격리 구역 계산', '보조금 산정', 'HWP 신고서 PDF'].map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={pending || !status.canUse}
              className="rounded-full border border-wline bg-white px-2.5 py-1 text-[11px] text-wsub hover:text-wink hover:border-wink/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
