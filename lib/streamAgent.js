import { buildAgentRequest } from '@/lib/apiContract';

// SSE 블록 1개("event: x\ndata: {...}") 파싱
function parseSSE(block) {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

// POST /api/agent 를 호출하고 SSE를 콜백으로 흘려준다.
//   onThought(step) — 도구 호출 1건
//   onAnswer(delta) — 답변 토큰
//   onDone()
// 반환: 누적 답변 텍스트
export async function streamAgent(req, { onThought, onAnswer, onCard, onDone, signal } = {}) {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildAgentRequest(req)),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`agent stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let answer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const ev = parseSSE(part);
      if (!ev) continue;
      if (ev.event === 'thought') onThought?.(ev.data);
      else if (ev.event === 'answer') {
        answer += ev.data.delta ?? '';
        onAnswer?.(ev.data.delta ?? '');
      } else if (ev.event === 'card') onCard?.(ev.data);
      else if (ev.event === 'done') onDone?.();
    }
  }
  return answer;
}
