import { useSyncExternalStore } from 'react';

export const PERSONA_KEY = 'forest-compass:persona';

// 지원 페르소나 (기능명세 3.1)
export const PERSONAS = [
  {
    id: 'contractor',
    icon: 'Mountain',
    title: '현장 벌채 대행사',
    subtitle: '현장 실무직',
    desc: '벌채·수확 작업을 직접 수행하는 현장 실무자. 장비 투입과 작업 효율, 안전 규제 위반 리스크가 핵심 관심사입니다.',
    focus: ['작업 효율 시뮬레이션', '경사·안전 규제', '로봇 장비 투입'],
    // 에이전트 프롬프트 컨텍스트로 주입
    context:
      '사용자는 현장 벌채 대행사의 실무 작업자입니다. 장비 투입 효율, 작업 동선, 경사도 기준 위반 리스크를 우선해 실무 중심으로 답하세요.',
  },
  {
    id: 'heir',
    icon: 'Leaf',
    title: '임업 후계자',
    subtitle: '영세 임업인',
    desc: '가업으로 산림을 이어받은 영세 임업인. 보조금·수확 수익과 장기 경영 계획, 행정 절차 간소화가 핵심 관심사입니다.',
    focus: ['보조금·지원금 산정', '수확 수익 추정', '경영 계획'],
    context:
      '사용자는 가업을 이어받은 영세 임업인(임업 후계자)입니다. 보조금·지원 제도, 수익성, 장기 경영 관점에서 쉬운 용어로 답하세요.',
  },
  {
    id: 'owner',
    icon: 'ShieldCheck',
    title: '사유림 개인 산주',
    subtitle: '개인 소유자',
    desc: '본인 소유 산지를 관리하는 개인 산주. 규제 적합 여부 자가 검토와 신고서 작성, 설계비 절감이 핵심 관심사입니다.',
    focus: ['규제 자가 검토', '신고서 자동 작성', '설계비 절감'],
    context:
      '사용자는 개인 사유림 산주입니다. 법적 규제 적합 여부를 스스로 검토하고 신고서를 직접 작성하려 합니다. 절차와 적법성 위주로 친절히 안내하세요.',
  },
];

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) ?? null;
}

// --- LocalStorage 외부 스토어 (hydration-safe, effect-setState 없이) ---
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb) {
  listeners.add(cb);
  if (typeof window !== 'undefined') window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(PERSONA_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

export function savePersona(id) {
  try {
    localStorage.setItem(PERSONA_KEY, id);
  } catch {
    /* ignore */
  }
  emit();
}

export function clearPersona() {
  try {
    localStorage.removeItem(PERSONA_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

// 현재 선택된 페르소나 id (없으면 null) — 같은 탭 변경도 즉시 반영
export function usePersonaId() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
