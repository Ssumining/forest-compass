'use client';
import { useState, useEffect, useRef } from 'react';
import { makeMockTerrain } from '@/lib/slope';

// 위치 선택 시 백엔드 /geo/analyze(SRTM 실측) → terrain 갱신
// 실패 시 mock 유지 (빈 화면 방지)
export function useTerrain(selectedLocation) {
  const [terrain, setTerrain] = useState(() => makeMockTerrain());
  const [loading, setLoading] = useState(false);
  const prevKey = useRef('');

  useEffect(() => {
    if (!selectedLocation?.lat || !selectedLocation?.lng) {
      setTerrain(makeMockTerrain());
      return;
    }

    // 같은 위치 재요청 방지
    const key = `${selectedLocation.lat.toFixed(5)},${selectedLocation.lng.toFixed(5)}`;
    if (prevKey.current === key) return;
    prevKey.current = key;

    let alive = true;
    setLoading(true);

    fetch('/api/geo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        parcelAreaHa: selectedLocation.areaSqm
          ? selectedLocation.areaSqm / 10000
          : null,
        siteClassification: selectedLocation.siteClassification ?? null,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!alive) return;
        if (data?.grid && data?.consts) {
          setTerrain(data);
        }
      })
      .catch(() => { /* mock 유지 */ })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [selectedLocation?.lat, selectedLocation?.lng]);

  return { terrain, loading };
}
