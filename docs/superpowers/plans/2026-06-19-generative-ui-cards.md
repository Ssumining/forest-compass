# Generative UI Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에이전트 답변에 의도별 구조화 카드(bypass/citation/kpi)를 새 `card` SSE 이벤트로 채팅에 띄운다.

**Architecture:** 기존 agent SSE 시임(`thought/answer/done`)에 `card` 이벤트를 추가한다. mock(`agentReply.js`)이 카드 데이터를 생성→BFF(`route.js`)가 `event: card`로 송출→`streamAgent.js`가 `onCard`로 전달→`ChatPane`이 메시지 버블에 누적·렌더. 카드는 payload에 데이터를 통째로 실은 자기완결 스냅샷이라 ChatPane은 시뮬레이터 상태와 분리된다.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4. **단위 테스트 프레임워크 없음** → 검증은 프로젝트 관례인 `next build` + 런타임 curl 스모크(UTF-8) + 육안.

**검증 공통 주의:** Git Bash는 한글 인자를 깨뜨리므로 curl 스모크는 **UTF-8 JSON 파일**(`--data-binary @file`)로 한다. 서버는 `npm run start`(빌드 후) 또는 `npm run dev`로 띄운다.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `lib/apiContract.js` | 카드 프로토콜 상수/헬퍼 | Modify |
| `lib/agentReply.js` | mock 카드 데이터 생성 | Modify |
| `app/api/agent/route.js` | `event: card` 송출 | Modify |
| `lib/streamAgent.js` | `onCard` 콜백 | Modify |
| `components/chat/cards/CardRenderer.jsx` | type별 분기 렌더 | Create |
| `components/chat/cards/BypassChatCard.jsx` | 우회안 카드 | Create |
| `components/chat/cards/CitationCard.jsx` | 법령 근거 카드 | Create |
| `components/chat/cards/KpiCard.jsx` | 지표 요약 카드 | Create |
| `components/chat/ChatPane.jsx` | 카드 누적·렌더·폴백 | Modify |

---

## Task 1: 카드 프로토콜 상수 추가

**Files:**
- Modify: `lib/apiContract.js`

- [ ] **Step 1: `AGENT_EVENTS`에 `card` 추가**

`lib/apiContract.js`의 `AGENT_EVENTS` 객체에서 `answer:` 줄 다음에 `card:` 줄을 추가한다.

기존:
```js
export const AGENT_EVENTS = {
  thought: 'thought', // 도구 호출 진행 1건 (아코디언 한 줄)
  answer:  'answer',  // 최종 답변 토큰 스트림
  patch:   'patch',   // (선택) 지도/시뮬레이터에 반영할 연산값 갱신
  done:    'done',    // 스트림 종료
  error:   'error',
};
```
변경:
```js
export const AGENT_EVENTS = {
  thought: 'thought', // 도구 호출 진행 1건 (아코디언 한 줄)
  answer:  'answer',  // 최종 답변 토큰 스트림
  card:    'card',    // 구조화 카드 1건 (자기완결 스냅샷)
  patch:   'patch',   // (선택) 지도/시뮬레이터에 반영할 연산값 갱신
  done:    'done',    // 스트림 종료
  error:   'error',
};
```

- [ ] **Step 2: 카드 타입/헬퍼 추가**

`lib/apiContract.js`에서 `makeThought` 함수 정의 블록 바로 다음에 아래를 추가한다.

```js
// 카드 봉투 — 자기완결 스냅샷 (data를 통째로 실어 보냄)
export const CARD_TYPES = {
  bypass: 'bypass',     // 우회 설계 제안
  citation: 'citation', // 법령 근거
  kpi: 'kpi',           // 핵심 지표 요약
};

export function makeCard(type, data) {
  return { type, data };
}
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully` (에러 없음)

- [ ] **Step 4: 커밋**

```bash
git add lib/apiContract.js
git commit -m "feat: add card SSE event type and card helpers to agent contract"
```

---

## Task 2: mock 카드 데이터 생성

**Files:**
- Modify: `lib/agentReply.js`

- [ ] **Step 1: import 추가**

`lib/agentReply.js` 최상단(주석 다음, `const PERSONA_LEAD` 위)에 import를 추가한다.

```js
import { computeStats, buildBypassProposals, makeMockTerrain } from '@/lib/slope';
import { makeCard, CARD_TYPES } from '@/lib/apiContract';
```

- [ ] **Step 2: 카드 빌더 + 매핑 함수 추가**

`lib/agentReply.js`에서 `mockThoughts` 함수 정의 다음, `export function mockAgentReply` 앞에 추가한다.

```js
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

function kpiCard() {
  const s = computeStats(500, 25, true, makeMockTerrain());
  return makeCard(CARD_TYPES.kpi, {
    items: [
      { label: '예상 수확재적', value: fmt(s.Y), unit: 'm³', sub: `본수 ${fmt(s.Ntree)}본`, tone: 'neutral' },
      { label: '탄소 고정 기여액', value: fmt(Math.round(s.carbonKRW / 10000)), unit: '만원', sub: `${fmt(Math.round(s.Y * 0.92))} tCO₂eq`, tone: 'green' },
      { label: '인허가 가능 확률', value: String(Math.round(s.compliantProb)), unit: '%', sub: s.compliant ? '적합' : '부적합', tone: s.compliant ? 'green' : 'red' },
    ],
  });
}

function bypassCard() {
  const radius = 500, slopeLimit = 22, robotOn = true;
  const terrain = makeMockTerrain();
  const stats = computeStats(radius, slopeLimit, robotOn, terrain);
  return makeCard(CARD_TYPES.bypass, {
    radius, slopeLimit, compliant: stats.compliant,
    proposals: buildBypassProposals(radius, slopeLimit, robotOn, terrain),
  });
}

function citationCard() {
  return makeCard(CARD_TYPES.citation, {
    legalSlopeLimit: 25,
    citations: [
      { law: '산지관리법 시행령', article: '제20조', text: '경사도 25도 이상인 산지의 전용·일시사용 제한 기준', url: 'https://www.law.go.kr/' },
      { law: '소나무재선충병 방제 특별법', article: '제11조', text: '감염목·의심목의 벌채 및 훈증 처리 의무', url: '' },
    ],
  });
}

function mockCards(text) {
  const cards = [];
  if (/우회|경사|반경|부적합/.test(text)) cards.push(bypassCard());
  if (/법|조례|근거|법령/.test(text)) cards.push(citationCard());
  if (/수확|시뮬|지표|탄소/.test(text)) cards.push(kpiCard());
  return cards;
}
```

- [ ] **Step 3: `mockAgentReply` 반환에 `cards` 추가**

기존:
```js
export function mockAgentReply(text, personaId) {
  const lead = PERSONA_LEAD[personaId] ?? '';
  return {
    answer: lead + replyBody(text),
    thoughts: mockThoughts(text),
  };
}
```
변경:
```js
export function mockAgentReply(text, personaId) {
  const lead = PERSONA_LEAD[personaId] ?? '';
  return {
    answer: lead + replyBody(text),
    thoughts: mockThoughts(text),
    cards: mockCards(text),
  };
}
```

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
git add lib/agentReply.js
git commit -m "feat: generate mock cards (bypass/citation/kpi) in mockAgentReply"
```

---

## Task 3: BFF 라우트에서 `event: card` 송출

**Files:**
- Modify: `app/api/agent/route.js`

- [ ] **Step 1: `cards` 구조분해 + 송출 루프 추가**

기존 mock 스트림 블록:
```js
  // 2) 데모 폴백 → mock SSE
  const { thoughts, answer } = mockAgentReply(body?.query ?? '', body?.persona);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        for (const t of thoughts) {
          send('thought', { ...t, state: 'active' });
          await sleep(140);
          send('thought', { ...t, state: 'done' });
          await sleep(60);
        }
        for (const piece of chunkText(answer)) {
          send('answer', { delta: piece });
          await sleep(26);
        }
        send('done', {});
      } finally {
        controller.close();
      }
    },
  });
```
변경(`{ thoughts, answer }` → `{ thoughts, answer, cards }`, 답변 뒤 카드 루프 추가):
```js
  // 2) 데모 폴백 → mock SSE
  const { thoughts, answer, cards } = mockAgentReply(body?.query ?? '', body?.persona);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        for (const t of thoughts) {
          send('thought', { ...t, state: 'active' });
          await sleep(140);
          send('thought', { ...t, state: 'done' });
          await sleep(60);
        }
        for (const piece of chunkText(answer)) {
          send('answer', { delta: piece });
          await sleep(26);
        }
        for (const card of cards ?? []) {
          send('card', card);
          await sleep(90);
        }
        send('done', {});
      } finally {
        controller.close();
      }
    },
  });
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`, 라우트 목록에 `ƒ /api/agent`

- [ ] **Step 3: 런타임 스모크 — card 이벤트 등장 확인**

서버 기동 후(예: `npm run start -- -p 3939`), 별도 셸에서:
```bash
cd /tmp && printf '{"query":"우회 설계 법령 근거 수확 시뮬","persona":"owner"}' > q.json
curl -s -N -X POST http://localhost:3939/api/agent -H "Content-Type: application/json" --data-binary @q.json --max-time 12 | grep -a "event: card"
```
Expected: `event: card` 3줄 (bypass/citation/kpi 모두 트리거됨)

- [ ] **Step 4: 커밋**

```bash
git add app/api/agent/route.js
git commit -m "feat: stream card events after answer in mock agent SSE"
```

---

## Task 4: streamAgent에 onCard 콜백

**Files:**
- Modify: `lib/streamAgent.js`

- [ ] **Step 1: 옵션에 `onCard` 추가 + 이벤트 분기**

기존:
```js
export async function streamAgent(req, { onThought, onAnswer, onDone, signal } = {}) {
```
변경:
```js
export async function streamAgent(req, { onThought, onAnswer, onCard, onDone, signal } = {}) {
```

기존 이벤트 분기:
```js
      if (ev.event === 'thought') onThought?.(ev.data);
      else if (ev.event === 'answer') {
        answer += ev.data.delta ?? '';
        onAnswer?.(ev.data.delta ?? '');
      } else if (ev.event === 'done') onDone?.();
```
변경(`card` 분기 추가):
```js
      if (ev.event === 'thought') onThought?.(ev.data);
      else if (ev.event === 'answer') {
        answer += ev.data.delta ?? '';
        onAnswer?.(ev.data.delta ?? '');
      } else if (ev.event === 'card') onCard?.(ev.data);
      else if (ev.event === 'done') onDone?.();
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: 커밋**

```bash
git add lib/streamAgent.js
git commit -m "feat: handle card events in streamAgent via onCard callback"
```

---

## Task 5: 카드 컴포넌트 4종

**Files:**
- Create: `components/chat/cards/KpiCard.jsx`
- Create: `components/chat/cards/CitationCard.jsx`
- Create: `components/chat/cards/BypassChatCard.jsx`
- Create: `components/chat/cards/CardRenderer.jsx`

- [ ] **Step 1: `KpiCard.jsx` 작성**

```jsx
'use client';

const TONE = { green: 'text-wgreen', red: 'text-wred', neutral: 'text-wblue-600' };

export default function KpiCard({ data }) {
  const items = data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-wline bg-white p-3 shadow-card">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it, i) => (
          <div key={i} className="min-w-0">
            <div className="text-[10px] text-wsub font-semibold truncate">{it.label}</div>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className={`text-[18px] font-extrabold tabular-nums ${TONE[it.tone] ?? TONE.neutral}`}>{it.value}</span>
              {it.unit && <span className="text-[10px] text-wsub font-semibold">{it.unit}</span>}
            </div>
            {it.sub && <div className="text-[9.5px] text-wsub truncate">{it.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `CitationCard.jsx` 작성**

```jsx
'use client';
import { I } from '@/components/ui/Icons';

export default function CitationCard({ data }) {
  const citations = data?.citations ?? [];
  if (citations.length === 0) return null;
  return (
    <div className="rounded-xl border border-wline bg-white p-3 shadow-card">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-wink mb-2">
        <I.Doc size={12} className="text-wblue-500" /> 법령 근거
        {data?.legalSlopeLimit != null && (
          <span className="ml-auto text-[10px] font-semibold text-wsub">법정 경사 한도 {data.legalSlopeLimit}°</span>
        )}
      </div>
      <ul className="space-y-2">
        {citations.map((c, i) => (
          <li key={i} className="text-[11.5px]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-wink">{c.law}</span>
              <span className="font-mono text-[10px] text-wblue-600 bg-wblue-50 px-1 rounded">{c.article}</span>
            </div>
            {c.text && <p className="text-wsub leading-snug mt-0.5">{c.text}</p>}
            {c.url && (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-wblue-500 hover:underline mt-0.5">
                원문 보기 <I.ChevRight size={10} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: `BypassChatCard.jsx` 작성**

```jsx
'use client';
import { I } from '@/components/ui/Icons';

export default function BypassChatCard({ data, onShowMap }) {
  const proposals = data?.proposals ?? [];
  return (
    <div className="rounded-xl border border-worange/40 bg-worange/5 p-3 shadow-card">
      <div className="flex items-center gap-1.5 mb-2">
        <I.TriangleAlert size={13} className="text-worange" />
        <span className="text-[11.5px] font-bold text-wink">우회 설계 제안</span>
        <span className="text-[9.5px] font-bold text-worange bg-worange/10 px-1.5 py-0.5 rounded">컴플라이언스</span>
      </div>
      {proposals.length > 0 ? (
        <div className="space-y-1.5">
          {proposals.map((p) => (
            <div key={p.id} className="rounded-lg border border-wline bg-white px-2.5 py-2">
              <div className="text-[11.5px] font-bold text-wink">{p.title}</div>
              <div className="text-[10.5px] text-wsub leading-snug">{p.desc}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]">
                <span className="text-wgreen font-semibold">적합확률 {Math.round(p.prob)}%</span>
                <span className="text-wsub">예상재적 <span className="text-wink font-semibold tabular-nums">{Number(p.Y).toLocaleString()} m³</span></span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-wline bg-white px-2.5 py-2 text-[10.5px] text-wsub">
          슬라이더 조정만으로는 적합 전환이 어렵습니다. 현장 실측 후 구역 분할 시공을 권장합니다.
        </div>
      )}
      <button
        onClick={onShowMap}
        className="mt-2 inline-flex items-center gap-1 rounded-md bg-wblue-500 hover:bg-wblue-600 text-white px-2.5 py-1.5 text-[11px] font-semibold focus-ring transition"
      >
        <I.Map size={12} /> 지도에서 적용 <I.ChevRight size={12} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `CardRenderer.jsx` 작성**

```jsx
'use client';
import { CARD_TYPES } from '@/lib/apiContract';
import BypassChatCard from './BypassChatCard';
import CitationCard from './CitationCard';
import KpiCard from './KpiCard';

export default function CardRenderer({ cards, onShowMap }) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-2">
      {cards.map((card, i) => {
        if (card?.type === CARD_TYPES.bypass) return <BypassChatCard key={i} data={card.data} onShowMap={onShowMap} />;
        if (card?.type === CARD_TYPES.citation) return <CitationCard key={i} data={card.data} />;
        if (card?.type === CARD_TYPES.kpi) return <KpiCard key={i} data={card.data} />;
        return null; // 알 수 없는 type → 렌더 안 함
      })}
    </div>
  );
}
```

- [ ] **Step 5: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully` (컴포넌트는 아직 미사용이라 import만 검증됨)

- [ ] **Step 6: 커밋**

```bash
git add components/chat/cards/
git commit -m "feat: add chat card components (kpi/citation/bypass + renderer)"
```

---

## Task 6: ChatPane에서 카드 누적·렌더

**Files:**
- Modify: `components/chat/ChatPane.jsx`

- [ ] **Step 1: CardRenderer import**

기존:
```js
import { streamAgent } from '@/lib/streamAgent';
import { mockAgentReply } from '@/lib/agentReply';
```
변경:
```js
import { streamAgent } from '@/lib/streamAgent';
import { mockAgentReply } from '@/lib/agentReply';
import CardRenderer from '@/components/chat/cards/CardRenderer';
```

- [ ] **Step 2: `send()`에 onCard 누적 추가 + 폴백에 cards 포함**

기존 `try` 블록과 폴백:
```js
    try {
      await streamAgent(
        { query: text, personaId: persona?.id, parcelId: PARCEL_ID },
        { onAnswer: upsert },
      );
      if (agentId == null) throw new Error('empty stream');
    } catch {
      // 네트워크/스트림 실패 → 로컬 mock 폴백
      const { answer } = mockAgentReply(text, persona?.id);
      setMessages(m => [...m, { id: Date.now() + 1, role: 'agent', text: answer, time: nowLabel() }]);
    } finally {
      setPending(false);
    }
```
변경(`onCard` 추가, 폴백에 `cards` 추가):
```js
    const addCard = (card) => {
      setPending(false);
      setMessages(m => {
        if (agentId == null) {
          agentId = Date.now() + 1;
          return [...m, { id: agentId, role: 'agent', text: '', cards: [card], time: nowLabel() }];
        }
        return m.map(x => (x.id === agentId ? { ...x, cards: [...(x.cards ?? []), card] } : x));
      });
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
```

- [ ] **Step 3: 후속 메시지 렌더에 CardRenderer 추가**

기존 후속 에이전트 메시지 렌더:
```jsx
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl rounded-tl-md border border-wline bg-white p-3.5 shadow-card slide-up ai-prose">
                {msg.text}
              </div>
              <div className="text-[10.5px] text-wsub mt-1 pl-1">{msg.time}</div>
            </div>
```
변경(텍스트 div 다음, 시간 div 앞에 카드 렌더 — 단 text가 빈 카드-only 메시지는 텍스트 버블 생략):
```jsx
            <div className="flex-1 min-w-0">
              {msg.text && (
                <div className="rounded-2xl rounded-tl-md border border-wline bg-white p-3.5 shadow-card slide-up ai-prose">
                  {msg.text}
                </div>
              )}
              {msg.cards?.length > 0 && <CardRenderer cards={msg.cards} onShowMap={onShowMap} />}
              <div className="text-[10.5px] text-wsub mt-1 pl-1">{msg.time}</div>
            </div>
```

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
git add components/chat/ChatPane.jsx
git commit -m "feat: accumulate and render chat cards in ChatPane follow-up turns"
```

---

## Task 7: 통합 검증

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 빌드**

Run: `npm run build`
Expected: `✓ Compiled successfully` + 라우트 `ƒ /api/agent`, `ƒ /api/geo`, `ƒ /api/report`

- [ ] **Step 2: 카드별 런타임 스모크 (UTF-8 파일)**

서버 기동(`npm run start -- -p 3939`) 후:
```bash
cd /tmp
printf '{"query":"우회 설계 알려줘","persona":"contractor"}' > c1.json
printf '{"query":"법령 근거 보여줘","persona":"owner"}' > c2.json
printf '{"query":"수확 시뮬 지표","persona":"heir"}' > c3.json
echo "== bypass =="; curl -s -N -X POST http://localhost:3939/api/agent -H "Content-Type: application/json" --data-binary @c1.json --max-time 12 | grep -ao '"type":"[a-z]*"'
echo "== citation =="; curl -s -N -X POST http://localhost:3939/api/agent -H "Content-Type: application/json" --data-binary @c2.json --max-time 12 | grep -ao '"type":"[a-z]*"'
echo "== kpi =="; curl -s -N -X POST http://localhost:3939/api/agent -H "Content-Type: application/json" --data-binary @c3.json --max-time 12 | grep -ao '"type":"[a-z]*"'
```
Expected:
```
== bypass ==
"type":"bypass"
== citation ==
"type":"citation"
== kpi ==
"type":"kpi"
```

- [ ] **Step 3: 육안 확인 (선택)**

`npm run dev` → 페르소나 선택 → 채팅에 "우회 설계 법령 근거 수확 시뮬" 입력 → 답변 버블 아래 카드 3종이 차례로 뜨는지 확인. bypass 카드의 "지도에서 적용" 클릭 시 지도 패널로 전환되는지 확인.

- [ ] **Step 4: 서버 종료**

서버 프로세스 종료(포트 3939).

---

## Self-Review (작성자 체크 완료)

- **Spec 커버리지:** 카탈로그 3종(bypass/citation/kpi)=Task2/5, `card` 프로토콜=Task1, route 송출=Task3, streamAgent=Task4, ChatPane 렌더·폴백=Task6, 에러(unknown type/빈 data)=Task5 컴포넌트 가드, 검증=Task7. 모두 매핑됨.
- **플레이스홀더:** 없음 (모든 step에 전체 코드/명령/기대출력 포함).
- **타입 일관성:** `CARD_TYPES`(bypass/citation/kpi), `makeCard(type,data)`, 카드 data 키(items/citations/proposals), `onCard` 콜백명 — Task 간 일치 확인.
