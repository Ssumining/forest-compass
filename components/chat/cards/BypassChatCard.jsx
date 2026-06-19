'use client';
import { I } from '@/components/ui/Icons';

export default function BypassChatCard({ data, onShowMap }) {
  const proposals = data?.proposals ?? [];
  return (
    <div className="rounded-xl border border-worange/40 bg-worange/5 p-3 shadow-card">
      <div className="flex items-center gap-1.5 mb-2">
        <I.TriangleAlert size={13} className="text-worange" />
        <span className="text-[11.5px] font-bold text-wink">우회 설계 제안</span>
        <span className="text-[9.5px] font-bold text-worange bg-worange/10 px-1.5 py-0.5 rounded">컴플라이언스</span>
      </div>
      {proposals.length > 0 ? (
        <div className="space-y-1.5">
          {proposals.map((p) => (
            <div key={p.id} className="rounded-lg border border-wline bg-white px-2.5 py-2">
              <div className="text-[11.5px] font-bold text-wink">{p.title}</div>
              <div className="text-[10.5px] text-wsub leading-snug">{p.desc}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]">
                <span className="text-wgreen font-semibold">적합확률 {Math.round(p.prob)}%</span>
                <span className="text-wsub">예상재적 <span className="text-wink font-semibold tabular-nums">{Number(p.Y).toLocaleString()} m³</span></span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-wline bg-white px-2.5 py-2 text-[10.5px] text-wsub">
          슬라이더 조정만으로는 적합 전환이 어렵습니다. 현장 실측 후 구역 분할 시공을 권장합니다.
        </div>
      )}
      <button
        onClick={onShowMap}
        className="mt-2 inline-flex items-center gap-1 rounded-md bg-wblue-500 hover:bg-wblue-600 text-white px-2.5 py-1.5 text-[11px] font-semibold focus-ring transition"
      >
        <I.Map size={12} /> 지도에서 적용 <I.ChevRight size={12} />
      </button>
    </div>
  );
}
