// BFF 폴백 — AGENT_BACKEND_URL 미설정 시 streamAgent가 503 에러를 던지므로
// 현재 이 파일의 함수는 직접 호출되지 않습니다.
// 향후 오프라인 데모 모드 복원 시 sim/terrain을 외부에서 주입하는 형태로 사용하세요.

import { computeStats, buildBypassProposals } from '@/lib/slope';
import { makeCard, CARD_TYPES } from '@/lib/apiContract';

const PERSONA_LEAD = {
  contractor: '[현장 실무 관점] ',
  heir:       '[영세 임업인 관점] ',
  owner:      '[개인 산주 관점] ',
};

function replyBody(text) {
  if (text.includes('임도') || text.includes('노선'))
    return '임도 노선을 재탐색했습니다. 평균 경사 능선부를 따라 우회 노선을 확보했습니다. 우측 지도에 노선 레이어를 갱신했습니다.';
  if (text.includes('재선충') || text.includes('격리'))
    return '「소나무재선충병 방제 특별법」 §11에 따라 벌채·훈증 처리 대상 구역을 산정했습니다.';
  if (text.includes('보조금') || text.includes('산정'))
    return '조림·숲가꾸기 보조금을 추정했습니다. 신청서 자동 작성이 가능합니다.';
  if (text.includes('수확') || text.includes('시뮬'))
    return '현재 슬라이더 설정 기준으로 수확량을 재계산했습니다. 우측 시뮬레이터의 예상 재적과 탄소 고정 기여액이 갱신되었습니다.';
  return '질의를 분석했습니다. 더 구체적인 조건(반경·경사 상한·장비)을 지정해 주시면 정밀 재계산하겠습니다.';
}

function mockThoughts(text) {
  const steps = [
    { tool: 'search_forest_knowledge', tag: 'KNOW-RAG', detail: '관련 법령·조례 교차 검토', output: '근거 조항 확보' },
  ];
  if (text.includes('재선충') || text.includes('격리'))
    steps.push({ tool: 'verify_wood_origin', tag: '외부 API', detail: '수피 다중분광 영상 추론', output: '재선충 의심목 식별' });
  if (text.includes('수확') || text.includes('시뮬') || text.includes('임도'))
    steps.push({ tool: 'calculate_slope_grid', tag: 'GIS', detail: '경사 격자 재집계 + 작업범위 산정', output: '평균경사·예상재적 갱신' });
  return steps;
}

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

// sim = { radius, slopeLimit, robotOn, terrain } — 실제 값을 외부에서 주입
export function makeKpiCard(sim) {
  const s = computeStats(sim.radius, sim.slopeLimit, sim.robotOn, sim.terrain);
  return makeCard(CARD_TYPES.kpi, {
    items: [
      { label: '예상 수확재적', value: fmt(s.Y), unit: 'm³', sub: `본수 ${fmt(s.Ntree)}본`, tone: 'neutral' },
      { label: '탄소 고정 기여액', value: fmt(Math.round(s.carbonKRW / 10000)), unit: '만원', sub: `${fmt(Math.round(s.Y * 0.92))} tCO₂eq`, tone: 'green' },
      { label: '인허가 가능 확률', value: String(Math.round(s.compliantProb)), unit: '%', sub: s.compliant ? '적합' : '부적합', tone: s.compliant ? 'green' : 'red' },
    ],
  });
}

export function makeBypassCard(sim) {
  const s = computeStats(sim.radius, sim.slopeLimit, sim.robotOn, sim.terrain);
  return makeCard(CARD_TYPES.bypass, {
    radius: sim.radius, slopeLimit: sim.slopeLimit, compliant: s.compliant,
    proposals: buildBypassProposals(sim.radius, sim.slopeLimit, sim.robotOn, sim.terrain),
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

// sim = { radius, slopeLimit, robotOn, terrain }
export function mockAgentReply(text, personaId, sim) {
  const lead = PERSONA_LEAD[personaId] ?? '';
  const cards = [];
  if (/우회|경사|반경|부적합/.test(text) && sim) cards.push(makeBypassCard(sim));
  if (/법|조례|근거|법령/.test(text)) cards.push(citationCard());
  if (/수확|시뮬|지표|탄소/.test(text) && sim) cards.push(makeKpiCard(sim));
  return {
    answer: lead + replyBody(text),
    thoughts: mockThoughts(text),
    cards,
  };
}
