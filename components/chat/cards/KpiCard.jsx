'use client';

const TONE = { green: 'text-wgreen', red: 'text-wred', neutral: 'text-wblue-600' };

export default function KpiCard({ data }) {
  const items = data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-wline bg-white p-3 shadow-card">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it, i) => (
          <div key={i} className="min-w-0">
            <div className="text-[10px] text-wsub font-semibold truncate">{it.label}</div>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className={`text-[18px] font-extrabold tabular-nums ${TONE[it.tone] ?? TONE.neutral}`}>{it.value}</span>
              {it.unit && <span className="text-[10px] text-wsub font-semibold">{it.unit}</span>}
            </div>
            {it.sub && <div className="text-[9.5px] text-wsub truncate">{it.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
