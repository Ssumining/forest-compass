'use client';
import { useState, useEffect, useRef } from 'react';
import { I } from '@/components/ui/Icons';
import ThoughtBlock from './ThoughtBlock';
import UserBubble from './UserBubble';
import { useUsage, recordUse, deriveStatus, formatCooldown, DAILY_LIMIT } from '@/lib/usageLimit';
import { streamAgent } from '@/lib/streamAgent';
import CardRenderer from '@/components/chat/cards/CardRenderer';

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

function nowLabel() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${m}`;
}

export default function ChatPane({ onShowMap, selectedLocation }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [expandedThoughts, setExpandedThoughts] = useState({});
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

    // thought(추론 단계)/답변 토큰/카드를 한 버블에 실시간 누적 (첫 이벤트 도착 시 버블 생성).
    // agentId 할당은 setMessages 업데이터 밖에서(부수효과 없는 순수 업데이터) — StrictMode 이중호출/레이스 방지.
    let agentId = null;
    const ensureId = () => (agentId ??= Date.now() + 1);
    // 해당 버블이 없으면 생성, 있으면 patch 적용 (text/cards/thoughts 공통 upsert)
    const patch = (fn) => {
      setPending(false);
      const id = ensureId();
      setMessages(m =>
        m.some(x => x.id === id)
          ? m.map(x => (x.id === id ? fn(x) : x))
          : [...m, fn({ id, role: 'agent', text: '', cards: [], thoughts: [], thoughtActive: true, time: nowLabel() })],
      );
    };

    const upsert = (delta) => patch(x => ({ ...x, text: x.text + delta }));
    const addCard = (card) => patch(x => ({ ...x, cards: [...(x.cards ?? []), card] }));
    // thought 이벤트는 도구 1건당 active→done 두 번 도착 → tool 키로 같은 단계를 갱신.
    const addThought = (step) => patch(x => {
      const steps = x.thoughts ?? [];
      const i = steps.findIndex(s => s.tool === step.tool);
      return { ...x, thoughts: i >= 0 ? steps.map((s, j) => (j === i ? { ...s, ...step } : s)) : [...steps, step] };
    });

    try {
      await streamAgent(
        { query: text, parcelId: selectedLocation?.address ?? selectedLocation?.pnu ?? '' },
        { onThought: addThought, onAnswer: upsert, onCard: addCard },
      );
      if (agentId == null) throw new Error('empty stream');
      const id = agentId;
      setMessages(m => m.map(x => (x.id === id ? { ...x, thoughtActive: false } : x)));
    } catch (err) {
      setMessages(m => [...m, {
        id: Date.now() + 1, role: 'agent',
        text: `응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.\n(${err?.message ?? '알 수 없는 오류'})`,
        cards: [], thoughts: [], thoughtActive: false, time: nowLabel(),
      }]);
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
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

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
          <I.MessageSquare size={12} /> 새 대화
        </button>
        <button className="flex items-center gap-1.5 rounded-md text-wsub hover:bg-white px-2.5 py-1 text-[11.5px]">
          <I.Plus size={12} /> 새 세션
        </button>
      </div>

      {/* Scroll body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll p-4 space-y-4">
        {messages.length === 0 && !pending && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-wsub">
            <I.Sparkles size={28} className="text-wblue-300" />
            <p className="text-[13px] font-semibold text-wink">무엇을 도와드릴까요?</p>
            <p className="text-[11.5px]">아래 입력창에 질문을 입력하거나 빠른 질문을 선택하세요.</p>
          </div>
        )}

        {/* 대화 턴 */}
        {messages.map(msg => msg.role === 'user' ? (
          <UserBubble key={msg.id} time={msg.time} text={msg.text} />
        ) : (
          <div key={msg.id} className="flex gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-wink text-white grid place-items-center shadow-sm">
              <I.Sparkles size={13} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {msg.thoughts?.length > 0 && (
                <ThoughtBlock
                  steps={msg.thoughts}
                  expanded={expandedThoughts[msg.id] ?? msg.thoughtActive}
                  onToggle={() => setExpandedThoughts(e => ({ ...e, [msg.id]: !(e[msg.id] ?? msg.thoughtActive) }))}
                  active={msg.thoughtActive}
                />
              )}
              {msg.text && (
                <div className="rounded-2xl rounded-tl-md border border-wline bg-white p-3.5 shadow-card slide-up ai-prose">
                  {msg.text}
                </div>
              )}
              {msg.cards?.length > 0 && <CardRenderer cards={msg.cards} onShowMap={onShowMap} />}
              <div className="text-[10.5px] text-wsub pl-1">{msg.time}</div>
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
