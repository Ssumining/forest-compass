'use client';
import { useState } from 'react';
import { I } from '@/components/ui/Icons';
import { PERSONAS, savePersona } from '@/lib/persona';

function PersonaCard({ p, selected, onPick }) {
  const Icon = I[p.icon] ?? I.Trees;
  return (
    <button
      onClick={() => onPick(p.id)}
      className={`group relative flex flex-col text-left rounded-2xl border bg-white p-5 transition shadow-card hover:shadow-pop focus-ring ${
        selected ? 'border-wblue-500 ring-2 ring-wblue-500/20' : 'border-wline hover:border-wblue-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`grid h-12 w-12 place-items-center rounded-xl transition ${
          selected ? 'bg-wblue-500 text-white' : 'bg-wblue-50 text-wblue-600 group-hover:bg-wblue-100'
        }`}>
          <Icon size={24} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-wink">{p.title}</div>
          <div className="text-[11.5px] text-wsub">{p.subtitle}</div>
        </div>
      </div>

      <p className="mt-3.5 text-[12.5px] leading-relaxed text-wsub min-h-[60px]">{p.desc}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.focus.map((f) => (
          <span key={f} className="rounded-full bg-wbg border border-wline px-2 py-0.5 text-[10.5px] font-medium text-wink/80">
            {f}
          </span>
        ))}
      </div>

      <div className={`mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
        selected ? 'bg-wblue-500 text-white' : 'bg-wbg text-wink group-hover:bg-wblue-500 group-hover:text-white'
      }`}>
        이 역할로 시작 <I.ChevRight size={14} />
      </div>
    </button>
  );
}

export default function PersonaScreen() {
  const [picked, setPicked] = useState(null);

  function pick(id) {
    setPicked(id);
    // 원클릭 선택 → LocalStorage 저장 (살짝의 선택 피드백 후 진입)
    setTimeout(() => savePersona(id), 220);
  }

  return (
    <div className="min-h-full w-full bg-[#F4F5F7] topo-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-5xl">
          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-wline bg-white px-3 py-1 text-[11px] font-semibold text-wsub shadow-card">
              <span className="grid h-4 w-4 place-items-center rounded bg-wgreen/10 text-wgreen"><I.Trees size={11} /></span>
              국립산림과학원 · 산림 지능형 에이전트
            </div>
            <h1 className="mt-4 text-[26px] sm:text-[30px] font-extrabold tracking-tight text-wink">
              어떤 역할로 산림 컨설팅을 받으시겠어요?
            </h1>
            <p className="mt-2 text-[13px] text-wsub">
              선택한 역할에 맞춰 AI 에이전트의 답변과 분석 관점이 조정됩니다. 로그인은 필요하지 않습니다.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PERSONAS.map((p) => (
              <PersonaCard key={p.id} p={p} selected={picked === p.id} onPick={pick} />
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-7 flex items-center justify-center gap-2 text-[11.5px] text-wsub">
            <I.ShieldCheck size={13} className="text-wgreen" />
            선택 정보는 이 브라우저에만 저장되며 언제든 변경할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}
