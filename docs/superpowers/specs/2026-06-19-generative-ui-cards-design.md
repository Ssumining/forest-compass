# Generative UI — 적응형 구조화 답변 카드 (설계)

- 날짜: 2026-06-19
- 대상: `forest-compass/` (Next.js 16)
- 기능명세 근거: 명세 6 — "AI가 텍스트 답변이 아닌 반응형 위젯을 자동 생성해 팝업 (SEP-1865)"

## 1. 목표

에이전트가 후속 대화 답변에서 **의도에 맞는 구조화 카드**를 채팅 버블 안에 함께
띄운다. 사용자가 위젯을 직접 조작하는 "라이브 컨트롤"이 아니라, 답변 시점의
**자기완결 스냅샷 카드**(표시 위주)를 생성하는 방식이다.

기존에 깔아둔 agent SSE 시임(`thought/answer/done`)에 `card` 이벤트를 더해,
백엔드 미연동 시 mock으로 동작하고 `AGENT_BACKEND_URL` 설정 시 그대로 실연동된다.

### 비목표 (YAGNI)
- 채팅 카드에서 슬라이더 등 라이브 조작 (→ 패널에 유지)
- 초기 진입 스크립트 답변(`AgentResponse`) 변경 (유지, 추후 동일 카드 채택 가능)
- 시나리오 비교표 카드 (이번 범위 제외)

## 2. 카드 카탈로그 (3종)

각 카드는 props로 받은 `data`만 읽는 순수 표시 컴포넌트.

### ① 우회 설계 제안 (`bypass`)
`slope.js buildBypassProposals` 출력 형태.
```jsonc
{
  "radius": 500, "slopeLimit": 22, "compliant": false,
  "proposals": [
    { "id": "slope", "kind": "slope", "title": "경사 작업범위 상향",
      "desc": "상한을 22° → 25°로 조정 (법정 한도 25° 이내)",
      "prob": 84, "Y": 612, "apply": { "slopeLimit": 25 } }
  ]
}
```
- 스냅샷이므로 카드의 "적용"은 시뮬레이터를 직접 바꾸지 않는다.
  **`지도에서 적용` 버튼 → `onShowMap()`** 으로 지도 패널 이동(실제 `BypassCard`가 거기 있음).
- `apply` 값은 표시·전달용으로 보관.

### ② 법령 근거 (`citation`)
`apiContract.makeKnowledgeResponse` 형태.
```jsonc
{
  "legalSlopeLimit": 25,
  "citations": [
    { "law": "산지관리법 시행령", "article": "제20조", "text": "경사도 25도 이상…", "url": "https://law.go.kr/…" },
    { "law": "소나무재선충병 방제 특별법", "article": "§11", "text": "…", "url": "" }
  ]
}
```
- `url` 있으면 새 탭 링크, 없으면 텍스트만.

### ③ 핵심 지표 요약 (`kpi`)
`computeStats` 결과를 미니 지표로. `MapPane`의 `StatCard` 시각 언어를 컴팩트 재사용.
```jsonc
{
  "items": [
    { "label": "예상 수확재적", "value": "646", "unit": "m³", "sub": "본수 1,224본", "tone": "neutral" },
    { "label": "탄소 고정 기여액", "value": "1,783", "unit": "만원", "sub": "594 tCO₂eq", "tone": "green" },
    { "label": "인허가 가능 확률", "value": "98", "unit": "%", "sub": "적합", "tone": "green" }
  ]
}
```

### 의도 → 카드 매핑 (mock 키워드)
| 질의 키워드 | 카드 |
|---|---|
| 우회·경사·반경·부적합 | bypass |
| 법·조례·근거·법령 | citation |
| 수확·시뮬·지표·탄소 | kpi |
| 복합 (예: "수확 시뮬 + 법적 검토") | kpi + citation |

## 3. 프로토콜

`apiContract.js`에 추가:
```js
AGENT_EVENTS.card = 'card';
export const CARD_TYPES = { bypass: 'bypass', citation: 'citation', kpi: 'kpi' };
export function makeCard(type, data) { return { type, data }; }
```

SSE 스트림 순서 (한 turn):
```
event: thought  …
event: answer   …
event: card     {"type":"bypass","data":{…}}     ← 답변 텍스트 뒤
event: card     {"type":"kpi","data":{…}}
event: done
```
→ 채팅 버블에서 답변 텍스트 아래로 카드가 차례로 떠오름.

## 4. 컴포넌트

신규 `components/chat/cards/`:
| 파일 | 역할 |
|---|---|
| `CardRenderer.jsx` | `type`별 분기. 알 수 없는 type → `null` (방어) |
| `BypassChatCard.jsx` | 우회안 + "지도에서 적용" 버튼(`onShowMap`) |
| `CitationCard.jsx` | 법령 조항 리스트 + 출처 링크 |
| `KpiCard.jsx` | 지표 미니 그리드 |

각 카드는 data 누락 필드를 옵셔널 체이닝/기본값으로 가드.

## 5. 수정 파일

- `lib/apiContract.js` — `AGENT_EVENTS.card`, `CARD_TYPES`, `makeCard`
- `lib/agentReply.js` — `mockAgentReply()` 반환에 `cards: []` 추가.
  bypass/kpi는 `slope.js`(`buildBypassProposals`·`computeStats` + `makeMockTerrain`)로 실제 계산,
  citation은 도메인 콘텐츠 기반 정적 스냅샷
- `app/api/agent/route.js` — 답변 토큰 뒤 `cards` 순회하며 `event: card` 송출
- `lib/streamAgent.js` — `onCard` 콜백 추가 (`event === 'card'`)
- `components/chat/ChatPane.jsx` — 메시지 모델에 `cards: []`.
  `onCard`가 현재 에이전트 메시지에 카드 누적(첫 토큰처럼 버블 생성).
  답변 텍스트 아래 `<CardRenderer>` 렌더. 스트림 실패 폴백도 cards 포함

## 6. 데이터 흐름

```
질의 → POST /api/agent
  → (mock) agentReply: { answer, thoughts, cards }
  → route: thought… → answer… → card… → done
  → streamAgent: onAnswer(누적) / onCard(누적)
  → ChatPane: 버블에 텍스트 + 카드 렌더
백엔드 연동 시: 동일 card 이벤트를 LangGraph가 송출 (env만 전환)
```

## 7. 에러 처리

- 알 수 없는 `type` → 렌더 안 함 (앱 안 깨짐)
- 카드 data 깨짐 → 컴포넌트 기본값으로 부분 렌더
- 네트워크/스트림 실패 → 기존 mock 폴백 경로가 cards까지 포함해 동일 UX

## 8. 검증

- `next build` 통과 (TypeScript/lint 포함)
- 런타임 스모크: `/api/agent`에 키워드별 POST(UTF-8 파일) → `event: card`로
  bypass/citation/kpi 각각 등장 확인
- 브라우저 육안 확인 (선택)

## 9. 미해결/후속

- 초기 진입 스크립트 답변에도 카드 채택
- 후속 대화 thought 블록 렌더 (별도 백로그 항목)
- Leaflet 실지도 연동 시 bypass 카드의 좌표 기반 시각화
