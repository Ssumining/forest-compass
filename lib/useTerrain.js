'use client';
import { useState, useEffect } from 'react';
import { makeMockTerrain } from '@/lib/slope';

// 필지당 terrain(격자·경계·상수)을 1회 가져온다.
//   - 초기값 = mock → 즉시 렌더 + SSR 일치 (깜빡임 없음)
//   - 마운트 시 /api/geo 호출 → 백엔드 연동 시 실측 terrain으로 교체
//   - 슬라이더 변화는 여기서 재요청하지 않는다 (프론트 computeStats가 재집계)
export function useTerrain(parcelId) {
  const [terrain, setTerrain] = useState(() => makeMockTerrain());

  useEffect(() => {
    let alive = true;
    fetch(`/api/geo?parcelId=${encodeURIComponent(parcelId ?? '')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && Array.isArray(data?.grid) && data.consts) setTerrain(data);
      })
      .catch(() => {
        /* mock 유지 */
      });
    return () => {
      alive = false;
    };
  }, [parcelId]);

  return terrain;
}
