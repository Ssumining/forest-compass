// BFF — 지형(terrain) 1회 fetch 엔드포인트
//
// 흐름:
//   1) 프론트가 GET /api/geo?parcelId=... 호출 (필지당 1회)
//   2) GEO_BACKEND_URL 환경변수가 있으면 → 실제 GEE 백엔드(/geo/analyze)로 프록시
//   3) 없으면 → mock terrain 반환 (백엔드 연동 전에도 지도·시뮬레이터가 끝까지 동작)
//
// terrain = 필지에 종속된 정적 데이터(격자·경계·KFRI 상수).
// 슬라이더(반경/경사상한/로봇) 변화는 프론트 computeStats가 재집계 → 여기 재호출 없음.

import { makeMockTerrain } from '@/lib/slope';
import { validateTerrain } from '@/lib/apiContract';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parcelId = searchParams.get('parcelId') ?? '';
  const backend = process.env.GEO_BACKEND_URL;

  // 1) 실제 백엔드 연동된 경우 → GEE 연산 결과(terrain) 프록시
  if (backend) {
    try {
      const upstream = await fetch(`${backend.replace(/\/$/, '')}/geo/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId }),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        if (validateTerrain(data).length === 0) {
          return Response.json({ ...data, source: 'backend' });
        }
      }
    } catch {
      /* 백엔드 불통 → mock 폴백 */
    }
  }

  // 2) 데모 폴백 → mock terrain
  return Response.json({ ...makeMockTerrain(), parcelId });
}
