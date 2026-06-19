import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';

// 기능명세 3.2 사용 제한: 일일 3회, 쿨타임 30분 (API 트래픽 보호)
// ※ 라이브 데모에서 대기시간이 길면 아래 COOLDOWN_MS 만 줄이면 됩니다.
export const DAILY_LIMIT = 3;
export const COOLDOWN_MS = 30 * 60 * 1000;

const KEY = 'forest-compass:usage';
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

function getRaw() {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

function getServerRaw() {
  return '';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parse(raw) {
  let o = {};
  try {
    o = raw ? JSON.parse(raw) : {};
  } catch {
    o = {};
  }
  // 날짜가 바뀌면 카운트 초기화
  if (o.date !== today()) return { date: today(), count: 0, lastUsedAt: 0 };
  return { date: o.date, count: o.count ?? 0, lastUsedAt: o.lastUsedAt ?? 0 };
}

// 질의 1회 기록 (카운트 +1, 쿨타임 시작)
export function recordUse() {
  const cur = parse(getRaw());
  const next = { date: today(), count: cur.count + 1, lastUsedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
}

// 현재 사용량(파싱된 객체) — hydration-safe
export function useUsage() {
  const raw = useSyncExternalStore(subscribe, getRaw, getServerRaw);
  return useMemo(() => parse(raw), [raw]);
}

// usage + 현재시각 → 파생 상태
export function deriveStatus(usage, now) {
  const remaining = Math.max(0, DAILY_LIMIT - usage.count);
  const cooldownLeft = Math.max(0, usage.lastUsedAt + COOLDOWN_MS - now);
  const dailyExhausted = remaining <= 0;
  const canUse = !dailyExhausted && cooldownLeft <= 0;
  return { remaining, cooldownLeft, dailyExhausted, canUse };
}

export function formatCooldown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
