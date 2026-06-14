# Generative UI (SEP-1865) — 1차 설계

작성일: 2026-06-14
대상: `forest-compass/` (Next.js 16, React 19)
기능명세: 명세 6 / 차별성 2 — "AI가 텍스트 답변이 아닌, 격자 맵·슬라이더·입력 폼 등 반응형 위젯을 자동 생성해 팝업"

## 목표

채팅 에이전트가 순수 텍스트 대신, 질의 의도에 따라 **인라인 인터랙티브 위젯**(입력 폼 / 선택 카드)을 생성한다. 사용자가 위젯을 제출하면 우측 패널(지도·시뮬레이터·신고서)이 즉시 갱신되는 **closed-loop**를 완성한다. 이는 공모전 차별점 "Closed Loop System" 및 "Generative UI"와 직결된다.

## 범위 (1차)

- 위젯 종류: **입력 폼(paramForm)** + **선택 카드(choiceCard)** 두 가지.
- 렌더 위치: **채팅 스트림 인라인 카드** (별도 모달/플로팅 아님).
- 제출 동작: **우측 패널 실제 연동** — `AppShell`의 `radius` / `slopeLimit` / `robotOn` 상태를 갱신.

비범위(YAGNI): 격자 맵 위젯(지도 패널이 이미 담당), 실제 LangGraph/SSE 백엔드 연동(별도 작업), 위젯 플로팅 팝업/모달.

## 아키텍처

응답 모델을 문자열 → **JSON 직렬화 가능한 응답 스펙** `{ text?, widget? }` 으로 전환한다. 위젯 제출 patch는 기존 `BypassCard`의 `apply({ radius?, slopeLimit?, robotOn? })` 규약과 동일하게 맞춘다.

```
ChatPane.send(text)
  → resolveResponse(text, persona)            // lib/generativeUi.js, 순수함수
      ⇒ { text?: string, widget?: WidgetSpec }
  → messages.push({ role:'agent', text, widget, result:null })
  → <WidgetRenderer spec={widget} disabled={!!result} onSubmit={patch => ...} />
        ├ type 'paramForm'  → ParamFormWidget
        └ type 'choiceCard' → ChoiceCardWidget
  → 사용자 제출
      → applyParams(patch)                     // AppShell: setRadius/setSlopeLimit/setRobotOn
          → computeStats useMemo 재계산 → 지도·시뮬·신고서 자동 갱신 (이미 reactive)
      → message.result = { patch, time }       // 위젯 read-only "적용됨" 상태로 고정
      → 확인 텍스트 버블 추가 (예: "경사 상한을 20°로 조정했습니다.")
```

### 단위(unit) 경계

| 단위 | 책임 | 의존 | 인터페이스 |
|------|------|------|-----------|
| `lib/generativeUi.js` | 질의 텍스트 → 응답 스펙(텍스트/위젯) 결정. 순수함수, 부수효과 없음. | 없음 (persona는 인자) | `resolveResponse(text, persona) → { text?, widget? }` |
| `WidgetRenderer.jsx` | `spec.type`로 위젯 컴포넌트 디스패치. 미지원 타입 안전 무시. | 위젯 컴포넌트들 | `props: { spec, current, disabled, result, onSubmit }` |
| `ParamFormWidget.jsx` | 반경·경사상한 number 입력 + 로봇 토글. `current`로 prefill, 제출 시 clamp 후 patch 생성. | Icons | `props: { spec, current, disabled, result, onSubmit }` |
| `ChoiceCardWidget.jsx` | 선택지 카드 렌더. 선택 시 해당 option.apply patch 제출. | Icons | `props: { spec, disabled, result, onSubmit }` |

## 신규 / 수정 파일

신규:
- `lib/generativeUi.js`
- `lib/generativeUi.test.js` (vitest)
- `components/chat/widgets/WidgetRenderer.jsx`
- `components/chat/widgets/ParamFormWidget.jsx`
- `components/chat/widgets/ChoiceCardWidget.jsx`

수정:
- `AppShell.jsx` — `applyParams(patch)` 정의, `ChatPane`에 `setRobotOn` 포함 전달.
- `ChatPane.jsx` — `simulateReply` → `resolveResponse`; message에 `widget`/`result` 필드; 렌더 분기에 `WidgetRenderer`; 퀵칩 '수확 조건 직접 입력' 추가.
- `package.json` — `vitest` devDependency + `"test": "vitest run"` 스크립트.

## 위젯 스펙 (JSON, 백엔드-레디)

추후 LangGraph 백엔드가 동일 JSON을 SSE로 흘려보내면 그대로 호환되도록 직렬화 가능하게 설계한다.

```jsonc
// paramForm — closed-loop 히어로
{
  "type": "paramForm",
  "title": "수확 조건 입력",
  "fields": [
    { "key": "radius",     "label": "분석 반경",          "kind": "number", "min": 100, "max": 1500, "step": 50, "unit": "m", "default": 500 },
    { "key": "slopeLimit", "label": "경사 상한",          "kind": "number", "min": 10,  "max": 35,   "step": 1,  "unit": "°", "default": 25 },
    { "key": "robotOn",    "label": "SmartHarvest 로봇",  "kind": "toggle", "default": true }
  ],
  "submitLabel": "시뮬레이션 적용"
}

// choiceCard — 임도 노선 등 선택지
{
  "type": "choiceCard",
  "title": "임도 노선 선택",
  "options": [
    { "id": "ridge",  "label": "능선부 노선", "desc": "평균 13.5° · L=1.2km", "apply": { "slopeLimit": 20 } },
    { "id": "valley", "label": "계곡부 노선", "desc": "평균 22° · L=0.8km",   "apply": { "slopeLimit": 25 } }
  ]
}
```

`paramForm` 초기값은 **현재 라이브 상태**(`AppShell`의 radius/slopeLimit/robotOn)로 prefill하고, 해당 값이 없을 때만 spec의 `default`를 fallback으로 쓴다 — 이래야 "현재 설정에서 조정" 흐름이 자연스럽다. 따라서 `WidgetRenderer`/`ParamFormWidget`은 현재 파라미터(`current = { radius, slopeLimit, robotOn }`)를 prop으로 받는다. 제출 patch는 편집값을 `min/max`로 clamp한 `{ radius, slopeLimit, robotOn }`. `choiceCard`는 선택된 option의 `apply` 객체를 그대로 patch로 사용.

## 트리거 매핑

| 질의 키워드 | 결과 |
|------------|------|
| `수확` / `시뮬` / `조건` | `paramForm` 위젯 (+ 짧은 안내 텍스트) |
| `임도` / `노선` | `choiceCard` 위젯 (기존 텍스트 응답 대체) |
| 그 외 | 기존 텍스트 응답 유지 (회귀 없음) |

퀵칩: '임도 노선 자동 설계' → choiceCard, 신규 '수확 조건 직접 입력' → paramForm. 페르소나 lead 접두("[현장 실무 관점] " 등)와 사용제한(일3회·쿨타임 30분) 로직은 그대로 통과.

## 상태 / 엣지 케이스

- 위젯 라이프사이클: `pending`(편집 가능) → 제출 → `submitted`(요약 read-only + "적용됨" 뱃지). `message.result`에 저장돼 스크롤/리렌더에도 상태 유지.
- 입력 clamp: number 필드는 `min`/`max` 범위로 강제.
- 방어: 미지원 `widget.type` 또는 빈 `options` → `WidgetRenderer`가 아무것도 렌더하지 않음(텍스트만 표시).
- 제출은 위젯당 1회. 이후 동일 위젯 재제출 불가(disabled).

## 테스트

- 러너: **vitest** (devDependency 1개, ESM·순수 JS 무설정 동작). `node:test`는 레포 CJS/ESM 기본설정과 충돌하므로 미채택.
- 대상: `lib/generativeUi.js`의 `resolveResponse` — `resolveResponse`는 순수함수라 단위테스트 적합.
- 구현 순서: `resolveResponse`는 **TDD(red → green)** 로 진행.
- 테스트 케이스(초안):
  - `수확/시뮬/조건` 키워드 → `widget.type === 'paramForm'`
  - `임도/노선` 키워드 → `widget.type === 'choiceCard'`, `options.length >= 2`
  - 일반 질의 → `widget` 없음, `text` 존재
  - 페르소나 전달 시 `text`에 lead 접두 포함
  - 반환 스펙이 JSON 직렬화 가능 (`JSON.parse(JSON.stringify(spec))` 동등)
- 위젯 컴포넌트(렌더/제출)는 1차에서 `next dev` 수동 데모 + lint로 검증.

## 디자인 시스템

기존 토큰 재사용: `wgreen` / `wblue-500·600` / `wline` / `wink` / `wsub` / `wbg`, `shadow-card`, `slide-up`, `focus-ring`. 아이콘 `@/components/ui/Icons`의 `I.*`. 카드 골격은 `BypassCard` / `AgentResponse` 스타일에 정렬.

## 구현 주의 (AGENTS.md)

- 전부 `'use client'` React 컴포넌트라 Next 16 서버 API 영향은 적으나, `forest-compass/AGENTS.md` 지침에 따라 코드 작성 전 `node_modules/next/dist/docs/` 관련 가이드를 확인한다.
- 작업 착수 전 현재 미커밋 완성분을 별도 커밋해 기준점을 만든다.
