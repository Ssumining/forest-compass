'use client';
import { I } from '@/components/ui/Icons';

export default function AgentResponse({ onShowMap }) {
  return (
    <div className="flex gap-2.5">
      <div className="h-7 w-7 shrink-0 rounded-full bg-wink text-white grid place-items-center shadow-sm">
        <I.Sparkles size={13} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="rounded-2xl rounded-tl-md border border-wline bg-white p-4 shadow-card slide-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-bold text-wink">AGENT</span>
            <span className="text-[10.5px] text-wsub">남원시 산림과 정책DB · KFRI-KNOW v2024.11</span>
          </div>
          <div className="ai-prose space-y-2.5">
            <p>
              <strong>남원시 산내면 사유림</strong>의 산불 피해지(<code>SLO-2024-31</code>) 분석을 마쳤습니다.
              <strong className="text-wred"> 현재 설정값(반경 500m, 경사 상한 25°)에서는 인허가 부적합</strong> 상태이며,
              하기 3건의 위험 요인을 확인했습니다.
            </p>
            <ul className="space-y-1.5">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-wred shrink-0" />
                <span>대상지 동측 약 31%가 <strong>경사 25° 초과</strong> 구역에 포함 (산지관리법 시행령 제20조)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-worange shrink-0" />
                <span>고사목 식별 정확도 91.4% — <strong>소나무재선충 의심목 7주</strong> (재선충병 방제 특별법 §11)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-wblue-500 shrink-0" />
                <span>로봇 임업기계 진입 가능 노선 <strong>2개 확보</strong> · 작업 효율 1.24×</span>
              </li>
            </ul>
            <p className="text-wsub text-[12.5px]">
              우측 시뮬레이터에서 <strong className="text-wink">경사 상한치를 30°로</strong> 조정하거나,
              반경을 380m로 축소하면 <strong className="text-wgreen">적합</strong> 상태 전환이 가능합니다.
            </p>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              onClick={onShowMap}
              className="inline-flex items-center gap-1.5 rounded-lg bg-wblue-500 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-wblue-600 active:bg-wblue-700 transition focus-ring"
            >
              <I.Map size={14} /> 컴플라이언스 지도 보기 <I.ChevRight size={13} />
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-wline bg-white px-3 py-2 text-[12.5px] font-semibold text-wink hover:bg-wbg transition focus-ring">
              <I.Doc size={14} /> 산지일시사용신고서 초안
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-wline bg-white px-2.5 py-2 text-[12.5px] font-semibold text-wsub hover:bg-wbg transition focus-ring">
              <I.History size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 pl-1 text-[10.5px] text-wsub">
          <span>오후 2:14</span>
          <button className="hover:text-wink">👍 도움됨</button>
          <button className="hover:text-wink">↻ 다시 생성</button>
          <button className="hover:text-wink">📋 복사</button>
        </div>
      </div>
    </div>
  );
}
