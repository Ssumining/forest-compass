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

export default function GlobalTopbar({ formOpen, onToggleForm }) {
  return (
    <div className="hidden lg:flex items-center justify-between gap-3 border-b border-wline bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-wink">ForestCompass</span>
          <span className="text-[10.5px] text-wsub">/ NIFOS 산림 행정·기술 컨설턴트</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DesktopFormToggle open={formOpen} onToggle={onToggleForm} />
      </div>
    </div>
  );
}
