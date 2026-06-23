// BFF — 지번 → 토지정보 조회 프록시
// POST /api/land-info  { address: "경기도 가평군 북면 이곡리 산1" }
// → backend POST /land/info

import { resolveBackendUrl } from '@/lib/backendUrl';

export async function POST(request) {
  const BACKEND = resolveBackendUrl('LAND_BACKEND_URL');
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND}/land/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json(
      { error: 'BACKEND_UNREACHABLE', message: String(err.message ?? err) },
      { status: 503 },
    );
  }
}
