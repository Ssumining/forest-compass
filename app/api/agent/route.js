// BFF — AI 에이전트 대화 (SSE)
//
// 흐름:
//   1) 프론트가 POST /api/agent 로 { query, persona, parcelId, sim } 전송
//   2) AGENT_BACKEND_URL 환경변수가 있으면 → 실제 LangGraph 백엔드(/agent)로 프록시,
//      SSE 스트림을 그대로 흘려보낸다
//   3) 없으면 → mock SSE 생성 (thought 이벤트 → answer 토큰 스트림 → done)
//
// 이벤트 형식은 apiContract.js AGENT_EVENTS 와 동일.

import { resolveBackendUrl } from '@/lib/backendUrl';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const backend = resolveBackendUrl('AGENT_BACKEND_URL');

  try {
    const upstream = await fetch(`${backend}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'BACKEND_ERROR', status: upstream.status }, { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: { ...SSE_HEADERS, 'X-Agent-Mode': 'backend' },
    });
  } catch (err) {
    return Response.json({ error: 'BACKEND_UNREACHABLE', detail: String(err.message) }, { status: 502 });
  }
}
