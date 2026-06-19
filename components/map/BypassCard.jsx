'use client';
import { useMemo } from 'react';
import { I } from '@/components/ui/Icons';
import { buildBypassProposals, makeMockTerrain } from '@/lib/slope';

function ProposalRow({ p, currentY, onApply }) {
  const Icon = p.kind === 'slope' ? I.Mountain : I.Compass;
  const dY = p.Y - currentY;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-wline bg-white px-3 py-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-wblue-50 text-wblue-600">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold text-wink">{p.title}</div>
        <div className="text-[11px] text-wsub leading-snug">{p.desc}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px]">
          <span className="text-wgreen font-semibold">적합확률 {p.prob.toFixed(0)}%</span>
          <span className="text-wsub">
            예상재적 <span className="text-wink font-semibold tabular-nums">{p.Y.toLocaleString()} m³</span>
            <span className={dY >= 0 ? 'text-wgreen' : 'text-wred'}>
              {' '}({dY >= 0 ? '+' : ''}{dY.toLocaleString()})
            </span>
          </span>
        </div>
      </div>
      <button
        onClick={() => onApply(p.apply)}
        className="shrink-0 inline-flex items-center gap-1 rounded-md bg-wblue-500 hover:bg-wblue-600 text-white px-2.5 py-1.5 text-[11px] font-semibold focus-ring transition"
      >
        적용 <I.ChevRight size={12} />
      </button>
    </div>
  );
}

export default function BypassCard({ radius, slopeLimit, robotOn, currentY, terrain = makeMockTerrain(), setRadius, setSlopeLimit }) {
  const proposals = useMemo(
    () => buildBypassProposals(radius, slopeLimit, robotOn, terrain),
    [radius, slopeLimit, robotOn, terrain]
  );

  function apply(patch) {
    if (patch.slopeLimit != null) setSlopeLimit(patch.slopeLimit);
    if (patch.radius != null) setRadius(patch.radius);
  }

  return (
    <div className="rounded-xl border border-worange/40 bg-worange/5 p-3.5 shadow-card slide-up">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-worange/15 text-worange">
          <I.TriangleAlert size={16} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[12.5px] font-bold text-wink">우회 설계 제안</h3>
            <span className="text-[9.5px] font-bold text-worange bg-worange/10 px-1.5 py-0.5 rounded">컴플라이언스</span>
          </div>
          <p className="text-[11px] text-wsub leading-snug mt-0.5">
            현재 설정은 <strong className="text-wred">인허가 부적합</strong>입니다. 차단 대신 적합 전환 경로를 제안합니다 — 원클릭 적용 가능.
          </p>
        </div>
      </div>

      {proposals.length > 0 ? (
        <div className="space-y-2">
          {proposals.map((p) => (
            <ProposalRow key={p.id} p={p} currentY={currentY} onApply={apply} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-wline bg-white px-3 py-2.5 text-[11.5px] text-wsub">
          슬라이더 조정만으로는 적합 전환이 어렵습니다. <strong className="text-wink">현장 실측 후 구역 분할 시공</strong> 또는 임도 우회 노선 설계를 권장합니다.
        </div>
      )}

      <div className="mt-2.5 text-[10px] text-wsub flex items-center gap-1">
        <I.Info size={11} /> 산지관리법 시행령 §20 · 경사 법정 한도 {terrain.consts.legalSlopeLimit}° 기준
      </div>
    </div>
  );
}
