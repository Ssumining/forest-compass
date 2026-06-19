'use client';
import { I } from '@/components/ui/Icons';

// 후속 턴의 thought 이벤트는 도구 이름만 오고 아이콘 컴포넌트가 없다 → 도구명으로 아이콘 추정.
function stepIcon(step) {
  if (step.icon) return step.icon;
  const t = step.tool || '';
  if (/slope|grid|gis|terrain|경사/i.test(t)) return I.Mountain;
  if (/verify|origin|pinedamage|image|cam|영상/i.test(t)) return I.Camera;
  if (/search|knowledge|know|rag|law|법/i.test(t)) return I.Search;
  return I.Activity;
}

function ThoughtStep({ step, idx, total }) {
  const Icon = stepIcon(step);
  const isLast = idx === total - 1;
  return (
    <div className="relative pl-7">
      {!isLast && <span className="absolute left-[10px] top-6 bottom-0 w-px bg-wline" />}
      <div className={`absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full ${
        step.state === 'done'   ? 'bg-wgreen/10 text-wgreen' :
        step.state === 'active' ? 'bg-wblue-100 text-wblue-500' :
                                  'bg-wbg text-wsub'
      }`}>
        {step.state === 'done'
          ? <I.Check size={12} stroke={2.5} className="checktick" />
          : step.state === 'active'
            ? <I.Loader size={12} stroke={2.2} className="spin-slow" />
            : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
        }
      </div>
      <div className="flex items-start gap-2">
        <Icon size={14} className={step.state === 'active' ? 'text-wblue-500 mt-0.5' : 'text-wsub mt-0.5'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-[12px] font-semibold text-wink">{step.tool}</code>
            {step.tag && (
              <span className="text-[10px] font-semibold text-wsub bg-wbg px-1.5 py-0.5 rounded">{step.tag}</span>
            )}
            {step.state === 'done' && step.ms && (
              <span className="text-[10.5px] text-wsub">{step.ms}ms</span>
            )}
          </div>
          <div className="text-[12.5px] text-wsub leading-snug mt-0.5">{step.detail}</div>
          {step.state === 'done' && step.output && (
            <div className="mt-1.5 rounded-md border border-wline bg-wbg/60 px-2.5 py-1.5 text-[11.5px] text-wink/85 leading-relaxed font-mono whitespace-pre-line">
              {step.output}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThoughtBlock({ steps, expanded, onToggle, active }) {
  const doneCount = steps.filter(s => s.state === 'done').length;
  const totalMs = steps.reduce((a, b) => a + (b.ms || 0), 0);
  return (
    <div className="rounded-xl border border-wline bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-wbg/60 rounded-t-xl transition focus-ring"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`relative flex h-6 w-6 items-center justify-center rounded-full ${
            active ? 'bg-wblue-50 text-wblue-500' : 'bg-wgreen/10 text-wgreen'
          }`}>
            {active ? <I.Loader size={14} className="spin-slow" /> : <I.Sparkles size={14} />}
          </div>
          <div className="text-left min-w-0">
            <div className="text-[13px] font-semibold text-wink truncate">
              {active ? '생각하는 중…' : '추론 루프 완료'}
              <span className="ml-1.5 text-wsub font-medium">({doneCount}/{steps.length} 단계)</span>
            </div>
            <div className="text-[11.5px] text-wsub mt-0.5">
              {active
                ? <><span className="thought-dot" /><span className="thought-dot" /><span className="thought-dot" /> 도구 호출 및 데이터 검증 중</>
                : `${totalMs > 0 ? `총 ${totalMs}ms · ` : ''}MCP 도구 ${steps.length}개 호출됨`
              }
            </div>
          </div>
        </div>
        <I.ChevDown size={16} className={`text-wsub transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="border-t border-wline px-3.5 py-3 space-y-3 slide-up">
          {steps.map((s, i) => <ThoughtStep key={i} step={s} idx={i} total={steps.length} />)}
        </div>
      )}
    </div>
  );
}
