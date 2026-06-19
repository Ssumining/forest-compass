// BFF — AI 에이전트 대화 (SSE)
//
// 흐름:
//   1) 프론트가 POST /api/agent 로 { query, persona, parcelId, sim } 전송
//   2) AGENT_BACKEND_URL 환경변수가 있으면 → 실제 LangGraph 백엔드(/agent)로 프록시,
//      SSE 스트림을 그대로 흘려보낸다
//   3) 없으면 → mock SSE 생성 (thought 이벤트 → answer 토큰 스트림 → done)
//
// 이벤트 형식은 apiContract.js AGENT_EVENTS 와 동일.

import { mockAgentReply } from '@/lib/agentReply';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chunkText(s, size = 3) {
  const arr = Array.from(s); // 코드포인트 단위 (한글 안전)
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size).join(''));
  return out;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const backend = process.env.AGENT_BACKEND_URL;

  // 1) 실제 백엔드 연동 → SSE 패스스루
  if (backend) {
    try {
      const upstream = await fetch(`${backend.replace(/\/$/, '')}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          status: 200,
          headers: { ...SSE_HEADERS, 'X-Agent-Mode': 'backend' },
        });
      }
    } catch {
      /* 백엔드 불통 → mock 폴백 */
    }
  }

  // 2) 데모 폴백 → mock SSE
  const { thoughts, answer, cards } = mockAgentReply(body?.query ?? '', body?.persona);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        for (const t of thoughts) {
          send('thought', { ...t, state: 'active' });
          await sleep(140);
          send('thought', { ...t, state: 'done' });
          await sleep(60);
        }
        for (const piece of chunkText(answer)) {
          send('answer', { delta: piece });
          await sleep(26);
        }
        for (const card of cards ?? []) {
          send('card', card);
          await sleep(90);
        }
        send('done', {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: { ...SSE_HEADERS, 'X-Agent-Mode': 'mock' } });
}
