// 데모 폴백 — 백엔드(LangGraph) 미연동 시 BFF(/api/agent)가 생성하는 mock 응답.
// 실연동 시 이 파일은 호출되지 않고, 백엔드 SSE가 그대로 프록시된다.

import { computeStats, buildBypassProposals, makeMockTerrain } from '@/lib/slope';
import { makeCard, CARD_TYPES } from '@/lib/apiContract';

const PERSONA_LEAD = {
  contractor: '[현장 실무 관점] ',
  heir: '[영세 임업인 관점] ',
  owner: '[개인 산주 관점] ',
};

// 키워드 기반 후속 답변 (페르소나 무관 본문)
function replyBody(text) {
  if (text.includes('임도') || text.includes('노선'))
    return '임도 노선을 재탐색했습니다. 평균 경사 13.5° 능선부를 따라 2개 노선(L=1.2km·0.8km)을 확보했고, 진입 시 작업 효율이 약 1.24× 상승합니다. 우측 지도에 노선 레이어를 갱신했습니다.';
  if (text.includes('재선충') || text.includes('격리'))
    return '재선충 의심목 7주를 중심으로 반경 20m 격리구역을 산정했습니다. 「소나무재선충병 방제 특별법」 §11에 따라 벌채·훈증 처리 대상이며, 인접 필지로의 확산 위험은 낮음(0.91)으로 평가됩니다.';
  if (text.includes('보조금') || text.includes('산정'))
    return '조림·숲가꾸기 보조금을 추정했습니다. 대상 면적과 수종 구성 기준 약 1,180만 원 규모이며, 산주 자부담 20% 적용 시 실수령 추정액은 약 944만 원입니다. 신청서 자동 작성이 가능합니다.';
  if (text.includes('수확') || text.includes('시뮬'))
    return '현재 슬라이더 설정 기준으로 수확량을 재계산했습니다. 우측 시뮬레이터의 예상 재적과 탄소 고정 기여액이 갱신되었습니다. SmartHarvest 로봇 토글로 효율 가중치를 비교해 보세요.';
  return '질의를 분석했습니다. 우측 시뮬레이터와 신고서에 관련 연산값을 반영했습니다. 더 구체적인 조건(반경·경사 상한·장비)을 지정해 주시면 정밀 재계산하겠습니다.';
}

// 질의에 맞는 도구 호출(thought) 시퀀스 — apiContract.makeThought 형태
function mockThoughts(text) {
  const steps = [
    { tool: 'search_forest_knowledge', tag: 'KNOW-RAG', detail: '관련 법령·조례·KNOW 매뉴얼 교차 검토', output: '매칭 다수 · 근거 조항 확보' },
  ];
  if (text.includes('재선충') || text.includes('수종') || text.includes('격리'))
    steps.push({ tool: 'verify_wood_origin', tag: '외부 API', detail: '수피 다중분광 영상 추론', output: '재선충 의심목 식별 (conf. 0.91)' });
  if (text.includes('수확') || text.includes('시뮬') || text.includes('임도') || text.includes('노선'))
    steps.push({ tool: 'calculate_slope_grid', tag: 'GIS', detail: '경사 격자 재집계 + 작업범위 산정', output: '평균경사·예상재적 갱신' });
  return steps;
}

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

export function mockAgentReply(text, personaId) {
  const lead = PERSONA_LEAD[personaId] ?? '';
  return {
    answer: lead + replyBody(text),
    thoughts: mockThoughts(text),
    cards: mockCards(text),
  };
}
