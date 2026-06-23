// 프론트 ↔ 백엔드 단일 데이터 계약 (source of truth)
//
// reportSchema.js 가 "신고서" 한 건의 계약이라면, 이 파일은 나머지 전 구간
// (대화 SSE / 지형·수확량 / 지식검색 / 수피이미지) 의 계약이다.
//
// 원칙:
//   - 프론트가 소비하는 "응답 키"를 여기서 고정한다. 컴포넌트는 이 키만 믿는다.
//   - 백엔드 미연동(env 없음) 시에도 화면이 끝까지 돌도록 mock 팩토리를 제공한다.
//   - 실제 데이터 원천(공공 API)은 백엔드가 호출하고, 프론트엔 가공된 JSON만 준다.

// ─────────────────────────────────────────────────────────────
// 엔드포인트 (NEXT_PUBLIC_AGENT_BASE_URL 또는 BFF 프록시 경로)
// ─────────────────────────────────────────────────────────────
export const ENDPOINTS = {
  agent:       '/agent',           // POST  (SSE 스트림)  — A. 대화/오케스트레이션
  geo:         '/geo/analyze',     // POST  (JSON)        — B. 경사도 격자 + KFRI-YIELD
  knowledge:   '/knowledge/search',// POST  (JSON)        — C. KNOW RAG + 법제처
  woodOrigin:  '/wood/verify',     // POST  (JSON)        — D. 수피 이미지 → 수종/재선충
  report:      '/report/forest-temp-use', // POST (파일)  — E. HWPX 생성 (reportSchema.js 참고)
};

// ─────────────────────────────────────────────────────────────
// A. 대화 — LangGraph SSE
//    백엔드는 아래 이벤트를 순서대로 흘려보낸다 (text/event-stream).
//    프론트(ChatPane)의 INITIAL_STEPS + simulateReply() 를 대체.
// ─────────────────────────────────────────────────────────────

// 프론트 → 백엔드 요청 바디
export function buildAgentRequest({ query, parcelId, sim }) {
  return {
    query,
    parcelId,
    sim: {                 // 슬라이더 현재 상태 (에이전트가 연산 컨텍스트로 사용)
      radius: sim?.radius ?? 500,
      slopeLimit: sim?.slopeLimit ?? 25,
      robotOn: sim?.robotOn ?? true,
    },
  };
}

// SSE 이벤트 타입 (event: 필드)
export const AGENT_EVENTS = {
  thought: 'thought', // 도구 호출 진행 1건 (아코디언 한 줄)
  answer:  'answer',  // 최종 답변 토큰 스트림
  card:    'card',    // 구조화 카드 1건 (자기완결 스냅샷)
  patch:   'patch',   // (선택) 지도/시뮬레이터에 반영할 연산값 갱신
  done:    'done',    // 스트림 종료
  error:   'error',
};

// event: thought 의 data 형태 — ChatPane INITIAL_STEPS 한 칸과 동일 키
export function makeThought(over = {}) {
  return {
    tool: 'calculate_slope_grid', // 'search_forest_knowledge' | 'verify_wood_origin' | ...
    tag: 'GIS',                   // 배지 라벨: 'KNOW-RAG' | '외부 API' | 'GIS'
    detail: '',                   // 진행 설명
    state: 'active',              // 'active' | 'done'
    ms: 0,                        // 소요(ms) — UI 타이밍 표시용
    output: '',                   // 도구 결과 요약 텍스트
    ...over,
  };
}

// 카드 봉투 — 자기완결 스냅샷 (data를 통째로 실어 보냄)
export const CARD_TYPES = {
  bypass: 'bypass',     // 우회 설계 제안
  citation: 'citation', // 법령 근거
  kpi: 'kpi',           // 핵심 지표 요약
};

export function makeCard(type, data) {
  return { type, data };
}

// ─────────────────────────────────────────────────────────────
// B. 지형 — calculate_slope_grid (terrain) + KFRI-YIELD 상수
//
//   채택 방식: "지형 1회 fetch + 프론트 재집계".
//   - 백엔드는 필지에 종속된 정적 데이터(격자·경계·상수)를 1번만 준다.
//   - 슬라이더(radius/slopeLimit/robotOn) 변화에 따른 집계/수확량은 프론트
//     (slope.js computeStats)가 매 프레임 재계산한다 → 백엔드 60fps 호출 불필요.
//   - 따라서 요청에는 parcelId만, 응답에는 슬라이더 의존값을 넣지 않는다.
//
//   ※ grid+bounds 계약은 데이터 원천 불문이다(GEE든 국토지리정보원 DEM이든
//     같은 형태로 채우면 됨 — 코드 수정 불필요). 지도가 기능명세서와 달라진 점
//     ("3D"→2D+hillshade, 베이스맵 Esri, react-leaflet v5)과 향후 국내타일/3D
//     전환 시 백엔드 주의사항은 루트 `백엔드_API_명세.md` "B′" 섹션 참고.
// ─────────────────────────────────────────────────────────────

// 프론트 → 백엔드 요청 (필지 단위, 슬라이더값 미포함)
export function buildGeoRequest({ parcelId }) {
  return { parcelId };
}

// KFRI-YIELD 기본 상수 — 백엔드 consts 미제공 시 폴백 (slope.js가 import)
export const DEFAULT_GEO_CONSTS = {
  Vunit: 0.46,          // 본당 단위재적(m³)
  treeDensity: 820,     // ha당 본수
  robotFactor: 1.18,    // SmartHarvest-X1 ×2 투입 효율계수 (robotOn 시)
  carbonPerM3: 0.92,    // m³당 tCO₂eq
  carbonKRWperT: 30000, // tCO₂eq당 배출권 단가(원)
  legalSlopeLimit: 25,  // 지자체 조례 반영 법정 경사 한도(°) — C(지식)에서 도출
};

// 백엔드 → 프론트 응답 = "terrain" (필지 종속 정적 데이터). computeStats가 소비.
//
// ┌─ 좌표계 규약 (백엔드 필독) ──────────────────────────────────────────┐
// │ grid·parcelPolygon·parcelCenter 는 "정규화 600×400 픽셀 캔버스" 좌표다 │
// │ (왼쪽위 [0,0] ~ 오른쪽아래 [600,400]). 이 캔버스가 실제 지표의 어느     │
// │ 위경도 범위에 놓이는지는 'bounds' 한 필드로 정한다.                     │
// │  · GEE에서 뽑은 실 위경도 지오메트리는 bounds 기준으로 픽셀로 투영해     │
// │    넣는다 (역변환식은 frontend `lib/geoProject.js latLngToPx` 참고).    │
// │  · 예외: deadTrees 는 실 위경도(lat/lng) 그대로 넣는다 (Leaflet 직접 투영).│
// │ Leaflet 실지도는 bounds로 픽셀↔위경도를 환산하고, SVG 폴백은 픽셀 그대로 │
// │ 그린다. → 두 화면이 같은 terrain 한 벌을 공유한다.                      │
// └────────────────────────────────────────────────────────────────────┘
export const GEO_TERRAIN_KEYS = [
  'grid',          // [필수] [{ c, r, slope }] 셀별 실측 경사(°) — GEE DEM 10m. c=열0..cols-1, r=행0..rows-1
  'cols', 'rows',  // [필수] 격자 차원 (예: 60 × 40)
  'parcelPolygon', // [필수] [[x,y]...] 필지 경계 — 600×400 픽셀좌표 (실폴리곤을 bounds로 픽셀 투영)
  'parcelCenter',  // [필수] [x, y] 필지 중심 — 픽셀좌표 (벌채 반경 원의 중심)
  'parcelAreaHa',  // [선택] number — 필지 면적(ha). 미제공 시 화면 표기용 기본값 사용
  'bounds',        // [필수*] [[latS,lngW],[latN,lngE]] 600×400 캔버스의 실 외접 bbox.
                   //         *없으면 Leaflet이 mock 위치(DEFAULT_BOUNDS)에 그려 지도가 엉뚱한 곳을 가리킴.
  'deadTrees',     // [선택] [{ lat, lng, pine, conf }] 고사목 — 실 위경도. pine=true=재선충 의심(강조색)
  'consts',        // [선택] DEFAULT_GEO_CONSTS 형태. 미제공 시 프론트 기본 상수 사용 (KFRI + 법정 한도)
];

// 프론트가 terrain으로부터 "매번" 파생하는 값(백엔드가 주지 않음):
//   avgSlope, maxSlopeInRadius, overRatio, Ntree, Srobot, Y, carbonKRW,
//   compliantProb, compliant  → 모두 computeStats() 결과

export function validateTerrain(t) {
  const missing = [];
  if (!Array.isArray(t?.grid) || t.grid.length === 0) missing.push('grid');
  if (!t?.consts) missing.push('consts');
  return missing;
}

// ─────────────────────────────────────────────────────────────
// C. 지식 검색 — KNOW RAG + 법제처 (search_forest_knowledge)
//    BypassCard 의 하드코딩된 "법정 한도 25°" 근거를 대체.
// ─────────────────────────────────────────────────────────────
export function buildKnowledgeRequest({ query, region, topic }) {
  return { query, region, topic }; // region 예: '전북 남원시', topic: 'slope_limit'
}

// 백엔드 → 프론트 응답 형태
export function makeKnowledgeResponse(over = {}) {
  return {
    legalSlopeLimit: 25,   // number(°) — 지자체 조례 반영 법정 경사 한도
    citations: [],         // [{ law, article, text, url }] 근거 법령/조례
    matches: [],           // [{ title, snippet, source, url }] KNOW/논문 매칭
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────
// D. 수피 이미지 — verify_wood_origin
//    신고서 수종 구성 / 고사목 수 / 재선충 판별을 대체.
// ─────────────────────────────────────────────────────────────
export function buildWoodOriginRequest({ parcelId, imageRefs }) {
  return { parcelId, imageRefs }; // imageRefs: 업로드/드론 프레임 식별자 배열
}

export function makeWoodOriginResponse(over = {}) {
  return {
    species: [             // 수종 구성(합 100%)
      { name: '소나무', ratio: 0.73 },
      { name: '신갈나무', ratio: 0.19 },
      { name: '졸참나무', ratio: 0.08 },
    ],
    deadTreeCount: 41,     // 고사목 수량
    pineWiltSuspect: 7,    // 재선충 의심 수
    confidence: 0.914,
    ...over,
  };
}
