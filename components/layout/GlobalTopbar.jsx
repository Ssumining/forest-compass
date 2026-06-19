'use client';
import { I } from '@/components/ui/Icons';

function DesktopFormToggle({ open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-wline bg-white px-2 py-1 text-[11px] font-semibold text-wsub hover:text-wink hover:border-wink/30 focus-ring"
      title="신고서 패널 접기/펴기"
    >
      <I.PanelLeft size={12} /> {open ? '신고서 접기' : '신고서 펴기'}
    </button>
  );
}

function PersonaChip({ persona, onChange }) {
  if (!persona) return null;
  const Icon = I[persona.icon] ?? I.Trees;
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-wline bg-white pl-2 pr-1 py-1 text-[11px]">
      <Icon size={12} className="text-wblue-600" />
      <span className="font-semibold text-wink">{persona.title}</span>
      <button
        onClick={onChange}
        className="ml-1 rounded px-1.5 py-0.5 text-[10.5px] text-wsub hover:text-wink hover:bg-wbg"
        title="페르소나 변경"
      >
        변경
      </button>
    </div>
  );
}

export default function GlobalTopbar({ formOpen, onToggleForm, persona, onChangePersona }) {
  return (
    <div className="hidden lg:flex items-center justify-between gap-3 border-b border-wline bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-wink">ForestCompass</span>
          <span className="text-[10.5px] text-wsub">/ NIFOS 산림 행정·기술 컨설턴트</span>
        </div>
        <div className="h-4 w-px bg-wline" />
        <nav className="flex items-center gap-0.5 text-[11.5px]">
          {[['대시보드', false], ['세션', true], ['지식베이스', false], ['감사 로그', false], ['설정', false]].map(([t, on]) => (
            <button
              key={t}
              className={`px-2 py-1 rounded-md ${on ? 'bg-wbg text-wink font-semibold' : 'text-wsub hover:text-wink hover:bg-wbg/60'}`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden xl:flex items-center gap-1 rounded-md border border-wline bg-wbg px-2 py-1 text-[10.5px] text-wsub">
          <I.Search size={11} />
          <span>도구 · 정책 · 필지 검색</span>
          <kbd className="ml-2 rounded bg-white border border-wline px-1 font-mono text-[10px]">⌘K</kbd>
        </div>
        <DesktopFormToggle open={formOpen} onToggle={onToggleForm} />
        <PersonaChip persona={persona} onChange={onChangePersona} />
        <button className="h-7 w-7 grid place-items-center rounded-md text-wsub hover:bg-wbg hover:text-wink">
          <I.Settings size={14} />
        </button>
        <div className="ml-1 flex items-center gap-1.5 rounded-full border border-wline pl-2 pr-1 py-0.5 text-[11px] text-wink">
          남원시 산림녹지과
          <span className="grid h-5 w-5 place-items-center rounded-full bg-wblue-500 text-white text-[10px] font-bold">박</span>
        </div>
      </div>
    </div>
  );
}
