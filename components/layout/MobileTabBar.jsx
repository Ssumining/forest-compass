'use client';
import { I } from '@/components/ui/Icons';

const TABS = [
  { id: 'chat', label: '대화창 보기',  icon: I.MessageSquare },
  { id: 'map',  label: '지도 대시보드', icon: I.Map },
  { id: 'form', label: '신고서 확인',  icon: I.Doc },
];

export default function MobileTabBar({ active, onChange }) {
  return (
    <div className="lg:hidden fixed inset-x-3 bottom-3 z-50">
      <div className="mx-auto flex max-w-md items-center gap-1 rounded-2xl border border-wline bg-white/95 backdrop-blur p-1 shadow-pop">
        {TABS.map(t => {
          const Ic = t.icon;
          const isOn = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition focus-ring ${
                isOn ? 'bg-wblue-500 text-white shadow-card' : 'text-wsub hover:text-wink'
              }`}
            >
              <Ic size={16} />
              <span className="text-[10.5px] font-semibold">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
