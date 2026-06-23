// BFF — 지형(terrain) fetch
// POST /api/geo  { lat, lng, parcelAreaHa? }
// → backend POST /geo/analyze → SRTM 실측 경사도 grid 반환

import { resolveBackendUrl } from '@/lib/backendUrl';

export async function POST(request) {
  const BACKEND = resolveBackendUrl('GEO_BACKEND_URL');
  try {
    const body = await request.json();
    const upstream = await fetch(`${BACKEND}/geo/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!upstream.ok) {
      return Response.json({ error: 'BACKEND_ERROR' }, { status: upstream.status });
    }
    const data = await upstream.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: 'BACKEND_UNREACHABLE', message: String(err.message ?? err) },
      { status: 503 },
    );
  }
}
