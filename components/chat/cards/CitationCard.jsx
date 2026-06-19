'use client';
import { I } from '@/components/ui/Icons';

export default function CitationCard({ data }) {
  const citations = data?.citations ?? [];
  if (citations.length === 0) return null;
  return (
    <div className="rounded-xl border border-wline bg-white p-3 shadow-card">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-wink mb-2">
        <I.Doc size={12} className="text-wblue-500" /> 법령 근거
        {data?.legalSlopeLimit != null && (
          <span className="ml-auto text-[10px] font-semibold text-wsub">법정 경사 한도 {data.legalSlopeLimit}°</span>
        )}
      </div>
      <ul className="space-y-2">
        {citations.map((c, i) => (
          <li key={i} className="text-[11.5px]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-wink">{c.law}</span>
              <span className="font-mono text-[10px] text-wblue-600 bg-wblue-50 px-1 rounded">{c.article}</span>
            </div>
            {c.text && <p className="text-wsub leading-snug mt-0.5">{c.text}</p>}
            {c.url && (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-wblue-500 hover:underline mt-0.5">
                원문 보기 <I.ChevRight size={10} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
