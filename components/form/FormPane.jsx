'use client';
import { useState } from 'react';
import { I } from '@/components/ui/Icons';
import {
  makeDefaultFields, buildReportPayload, validateFields,
  DECLARATION_TYPES, RECIPIENTS, SAN_JI_TYPES,
} from '@/lib/reportSchema';

function FormField({ label, value, onChange, hint, locked, suffix, badge, wide, textarea, type = 'text' }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-semibold text-wink">{label}</label>
        <div className="flex items-center gap-1.5">
          {badge}
          {hint && <span className="text-[10px] text-wsub">{hint}</span>}
        </div>
      </div>
      <div className={`group flex items-center gap-2 rounded-md border bg-white px-2.5 py-1.5 transition ${
        locked
          ? 'border-wline bg-wbg/50'
          : 'border-wline hover:border-wblue-300 focus-within:border-wblue-500 focus-within:shadow-focus'
      }`}>
        {textarea ? (
          <textarea
            value={value}
            onChange={e => onChange?.(e.target.value)}
            rows={2}
            readOnly={locked}
            className="block w-full resize-none bg-transparent text-[12.5px] text-wink placeholder-wsub focus:outline-none"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={e => onChange?.(e.target.value)}
            readOnly={locked}
            className="block w-full bg-transparent text-[12.5px] text-wink placeholder-wsub focus:outline-none"
          />
        )}
        {suffix && <span className="text-[11px] text-wsub font-mono shrink-0">{suffix}</span>}
        {!locked && !textarea && <I.Pencil size={11} className="text-wline group-focus-within:text-wblue-500 shrink-0" />}
      </div>
    </div>
  );
}

function AutoFilledTag({ children = 'AI 자동 입력' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-wblue-50 text-wblue-600 px-1.5 py-0.5 text-[9.5px] font-bold">
      <I.Sparkles size={9} /> {children}
    </span>
  );
}

function SectionTitle({ n, children, note, badgeClass = 'bg-wink' }) {
  return (
    <h3 className="text-[12.5px] font-bold text-wink mb-3 flex items-center gap-2">
      <span className={`grid h-5 w-5 place-items-center rounded ${badgeClass} text-white text-[10px] font-bold`}>{n}</span>
      {children}
      {note && <span className="text-[10.5px] font-medium text-wsub">— {note}</span>}
    </h3>
  );
}

const fmt = (n) => Number(String(n).replace(/[^\d.-]/g, '') || 0).toLocaleString('ko-KR');

export default function FormPane({ radius, slopeLimit, avgSlope, Y, compliant, onClose }) {
  const [downloadState, setDownloadState] = useState('idle');
  const [toast, setToast] = useState(null); // { title, sub }
  const [fields, setFields] = useState(makeDefaultFields);

  // 시뮬레이터 반경 변경 시 산지 면적 자동 반영 (effect 대신 렌더 중 상태 조정 — React 권장 패턴)
  const [prevRadius, setPrevRadius] = useState(radius);
  if (radius !== prevRadius) {
    setPrevRadius(radius);
    const areaFromRadius = Math.round(Math.PI * radius * radius * 0.42); // 가용 면적 근사(㎡)
    setFields(f => ({ ...f, areaImupum: areaFromRadius, tempUseArea: areaFromRadius }));
  }

  const setField = (key) => (val) => setFields(f => ({ ...f, [key]: val }));
  const sim = { radius, slopeLimit, avgSlope, Y, compliant };

  const areaTotal =
    Number(fields.areaImupum || 0) + Number(fields.areaGongik || 0) + Number(fields.areaJunbojeon || 0);

  async function handleDownload() {
    const missing = validateFields(fields);
    if (missing.length) {
      setToast({ title: '필수 항목 누락', sub: `${missing.length}개 항목을 확인하세요`, error: true });
      setTimeout(() => setToast(null), 3200);
      return;
    }
    setDownloadState('loading');
    try {
      const payload = buildReportPayload(fields, sim);
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);

      const blob = await res.blob();
      const mode = res.headers.get('X-Report-Mode') ?? 'demo';
      const cd = res.headers.get('Content-Disposition') ?? '';
      const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
      const filename = m ? decodeURIComponent(m[1]) : `산지일시사용신고서_${Date.now()}.txt`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);

      setDownloadState('done');
      setToast({
        title: '신고서 생성 완료',
        sub: `${filename} · ${(blob.size / 1024).toFixed(0)} KB${mode === 'demo' ? ' · 데모 모드' : ''}`,
      });
      setTimeout(() => setToast(null), 3600);
      setTimeout(() => setDownloadState('idle'), 1500);
    } catch (err) {
      setDownloadState('idle');
      setToast({ title: '생성 실패', sub: String(err.message || err), error: true });
      setTimeout(() => setToast(null), 3600);
    }
  }

  const isChange = fields.declarationType === '변경';

  return (
    <div className="flex h-full flex-col bg-wbg/30">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-wline bg-white px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-worange/10 text-worange ring-1 ring-worange/20">
            <I.Doc size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-wink flex items-center gap-1.5">
              산지일시사용신고서
              <span className="text-[10px] font-mono text-wsub bg-wbg px-1 rounded">.HWPX</span>
            </div>
            <div className="text-[10.5px] text-wsub truncate">별지 제7호의4서식 · 산지관리법 시행규칙</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-wgreen/10 px-2 py-1 text-[10.5px] text-wgreen font-semibold">
            <I.CheckCircle size={11} /> 검토 완료
          </div>
          <button
            onClick={handleDownload}
            disabled={downloadState !== 'idle'}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold focus-ring transition ${
              downloadState === 'done'    ? 'bg-wgreen text-white' :
              downloadState === 'loading' ? 'bg-wblue-400 text-white cursor-wait' :
                                           'bg-wblue-500 hover:bg-wblue-600 text-white'
            }`}
          >
            {downloadState === 'loading' && <><I.Loader size={13} className="spin-slow" /> 생성 중…</>}
            {downloadState === 'done'    && <><I.Check size={14} stroke={2.5} /> 다운로드 완료</>}
            {downloadState === 'idle'    && <><I.Download size={13} /> PDF / HWPX 다운로드</>}
          </button>
          {onClose && (
            <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md text-wsub hover:bg-wbg hover:text-wink lg:hidden">
              <I.X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 신고 구분 선택 */}
      <div className="flex items-center gap-2 border-b border-wline bg-white px-4 py-2">
        <span className="text-[10.5px] font-semibold text-wsub">신고 구분</span>
        <div className="flex items-center gap-1">
          {DECLARATION_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setField('declarationType')(t)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold border transition ${
                fields.declarationType === t
                  ? 'bg-wblue-500 text-white border-wblue-500'
                  : 'bg-white text-wsub border-wline hover:text-wink hover:border-wink/30'
              }`}
            >
              {t === '신규' ? '신고서' : t === '변경' ? '변경신고서' : '기간연장신고서'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10.5px] text-wsub">
          <I.Clock size={11} /> 자동 저장됨
        </div>
      </div>

      {/* Document */}
      <div className="flex-1 overflow-y-auto nice-scroll p-4 lg:p-6">
        <div className="mx-auto max-w-[920px] bg-white rounded-lg border border-wline shadow-card">
          {/* Page header */}
          <div className="border-b border-wline px-8 pt-7 pb-5">
            <div className="text-center">
              <div className="text-[10.5px] text-wsub font-mono">■ 산지관리법 시행규칙 [별지 제7호의4서식] &lt;개정 2015.12.30.&gt;</div>
              <h2 className="text-[20px] font-extrabold text-wink tracking-tight mt-1">
                산지일시사용 [{fields.declarationType === '신규' ? '√' : ' '}]신고서
                [{fields.declarationType === '변경' ? '√' : ' '}]변경신고서
                [{fields.declarationType === '기간연장' ? '√' : ' '}]기간연장신고서
              </h2>
            </div>
            <div className="grid grid-cols-4 mt-4 text-[10.5px] text-wsub border border-wline">
              <div className="px-2.5 py-1.5 border-r border-wline">접수번호 <span className="text-wsub/60 ml-1">(관청 기입)</span></div>
              <div className="px-2.5 py-1.5 border-r border-wline">접수일자 <span className="text-wsub/60 ml-1">—</span></div>
              <div className="px-2.5 py-1.5 border-r border-wline">처리일자 <span className="text-wsub/60 ml-1">—</span></div>
              <div className="px-2.5 py-1.5">처리기간 <span className="text-wink font-semibold ml-1">{isChange ? '5일' : '10일'}</span></div>
            </div>
          </div>

          {/* 1. 신고인 */}
          <div className="px-8 py-5 border-b border-wline">
            <SectionTitle n="1">신고인</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="성명(법인명)" value={fields.applicantName} onChange={setField('applicantName')} />
              <FormField label="생년월일" type="date" value={fields.applicantBirth} onChange={setField('applicantBirth')} />
              <FormField wide label="주소" value={fields.applicantAddress} onChange={setField('applicantAddress')} />
              <FormField wide label="전화번호" value={fields.applicantPhone} onChange={setField('applicantPhone')} />
            </div>
          </div>

          {/* 2. 산지 권리관계(소유자) */}
          <div className="px-8 py-5 border-b border-wline">
            <SectionTitle n="2">해당 산지에 대한 권리관계 (소유자)</SectionTitle>
            <label className="flex items-center gap-2 mb-3 text-[11.5px] text-wink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fields.ownerSame}
                onChange={e => setField('ownerSame')(e.target.checked)}
                className="h-3.5 w-3.5 accent-wblue-500"
              />
              신고인과 동일
            </label>
            {!fields.ownerSame && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="성명(법인명)" value={fields.ownerName} onChange={setField('ownerName')} />
                <FormField label="생년월일" type="date" value={fields.ownerBirth} onChange={setField('ownerBirth')} />
                <FormField wide label="주소" value={fields.ownerAddress} onChange={setField('ownerAddress')} />
                <FormField wide label="전화번호" value={fields.ownerPhone} onChange={setField('ownerPhone')} />
              </div>
            )}
          </div>

          {/* 3. 산지 일시사용 내역 */}
          <div className="px-8 py-5 border-b border-wline">
            <SectionTitle n="3" note="지도 데이터 연동">산지 일시사용 내역</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField wide label="소재지" value={fields.siteLocation} onChange={setField('siteLocation')} badge={<AutoFilledTag />} />
              <FormField label="지번" value={fields.siteParcel} onChange={setField('siteParcel')} badge={<AutoFilledTag />} />
              <FormField label="지목" value={fields.siteLandCategory} onChange={setField('siteLandCategory')} />
            </div>

            {/* 면적 표 (산지구분별) */}
            <div className="mt-3 rounded-md border border-wline overflow-hidden">
              <div className="grid grid-cols-4 bg-wbg text-[10.5px] font-semibold text-wsub">
                {SAN_JI_TYPES.map(t => (
                  <div key={t} className="px-2.5 py-1.5 border-r border-wline text-center">{t} (㎡)</div>
                ))}
                <div className="px-2.5 py-1.5 text-center">계 (㎡)</div>
              </div>
              <div className="grid grid-cols-4 text-[12.5px]">
                <input value={fields.areaImupum} onChange={e => setField('areaImupum')(e.target.value)}
                  className="px-2.5 py-1.5 border-r border-t border-wline text-right tabular-nums text-wink focus:outline-none focus:bg-wblue-50/40" />
                <input value={fields.areaGongik} onChange={e => setField('areaGongik')(e.target.value)}
                  className="px-2.5 py-1.5 border-r border-t border-wline text-right tabular-nums text-wink focus:outline-none focus:bg-wblue-50/40" />
                <input value={fields.areaJunbojeon} onChange={e => setField('areaJunbojeon')(e.target.value)}
                  className="px-2.5 py-1.5 border-r border-t border-wline text-right tabular-nums text-wink focus:outline-none focus:bg-wblue-50/40" />
                <div className="px-2.5 py-1.5 border-t border-wline text-right tabular-nums font-bold text-wblue-600">{fmt(areaTotal)}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <FormField label="일시사용 면적" value={fields.tempUseArea} onChange={setField('tempUseArea')} suffix="㎡"
                badge={<AutoFilledTag>r={radius}m · DEM 5m</AutoFilledTag>} />
            </div>
          </div>

          {/* 4. 목적 및 기간 */}
          <div className="px-8 py-5 border-b border-wline">
            <SectionTitle n="4">일시사용 목적 및 기간</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField wide label="일시사용 목적" value={fields.purpose} onChange={setField('purpose')} />
              <FormField label="기간 시작" type="date" value={fields.periodStart} onChange={setField('periodStart')} />
              <FormField label="기간 종료" type="date" value={fields.periodEnd} onChange={setField('periodEnd')} />
            </div>

            {isChange && (
              <div className="mt-3 rounded-md border border-worange/30 bg-worange/5 p-3">
                <div className="text-[11px] font-bold text-worange mb-2">변경사항</div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="변경 전" value={fields.changeBefore} onChange={setField('changeBefore')} />
                  <FormField label="변경 후" value={fields.changeAfter} onChange={setField('changeAfter')} />
                  <FormField wide label="사유" value={fields.changeReason} onChange={setField('changeReason')} />
                </div>
              </div>
            )}
          </div>

          {/* AI 사전검토 (첨부 자동생성) */}
          <div className="px-8 py-5 border-b border-wline bg-wbg/40">
            <SectionTitle n="AI" badgeClass="bg-wblue-500" note="첨부 자동 생성">에이전트 사전 검토 결과</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border border-wline bg-white p-3">
                <div className="text-[10.5px] text-wsub font-semibold">설정 시뮬레이션</div>
                <div className="text-[13px] font-bold text-wink mt-1 tabular-nums">r = {radius}m · θ ≤ {slopeLimit}°</div>
                <div className="text-[10.5px] text-wsub mt-0.5">예상 재적 <span className="text-wblue-600 font-semibold tabular-nums">{Y.toLocaleString()} m³</span></div>
              </div>
              <div className="rounded-md border border-wline bg-white p-3">
                <div className="text-[10.5px] text-wsub font-semibold">법적 검토 (§15-2)</div>
                <div className={`text-[13px] font-bold mt-1 ${compliant ? 'text-wgreen' : 'text-wred'}`}>
                  {compliant ? '산지관리법 적합' : '경사 상한 초과'}
                </div>
                <div className="text-[10.5px] text-wsub mt-0.5">평균경사 {avgSlope.toFixed(1)}°</div>
              </div>
              <div className="rounded-md border border-wline bg-white p-3">
                <div className="text-[10.5px] text-wsub font-semibold">처리기관 권장</div>
                <div className="text-[13px] font-bold text-wink mt-1">남원시 산림녹지과</div>
                <div className="text-[10.5px] text-wsub mt-0.5">담당 박○○ · 063-620-XXXX</div>
              </div>
            </div>
          </div>

          {/* Sign block */}
          <div className="px-8 py-6">
            <div className="text-center text-[12px] text-wink leading-relaxed mb-4">
              「산지관리법」 제15조의2제2항·제3항 및 같은 법 시행규칙 제15조의3제1항·제15조의4제2항에 따라
              위와 같이 산지일시사용 {fields.declarationType === '신규' ? '신고' : fields.declarationType === '변경' ? '변경신고' : '기간연장신고'}를 합니다.
            </div>
            <div className="text-center text-[12px] text-wsub mb-5 tabular-nums">{fields.declaredDate}</div>
            <div className="flex flex-wrap items-center justify-end gap-4 text-[12px]">
              <span className="text-wsub">신고인</span>
              <span className="text-wink font-semibold tabular-nums">{fields.applicantName}</span>
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-wred">
                <span className="text-[11px] font-bold text-wred">{fields.applicantName.slice(-3)}</span>
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-wred" />
              </span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <select
                value={fields.recipient}
                onChange={e => setField('recipient')(e.target.value)}
                className="rounded-md border border-wline bg-white px-2 py-1 text-[11.5px] font-semibold text-wink focus:outline-none focus:border-wblue-500"
              >
                {RECIPIENTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className="text-[11.5px] text-wink font-semibold">귀하</span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-wline px-8 py-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-wsub bg-wbg/40 rounded-b-lg">
            <div className="flex items-center gap-3">
              <span className="font-mono">별지 제7호의4서식</span>
              <span>·</span>
              <span>210mm × 297mm</span>
            </div>
            <div className="flex items-center gap-2">
              <I.ShieldCheck size={11} className="text-wgreen" /> 전자서명 준비됨 (GPKI)
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center">
          <div className="pointer-events-auto toast-in flex items-center gap-3 rounded-xl bg-wink/95 backdrop-blur text-white px-4 py-3 shadow-pop">
            <div className={`grid h-7 w-7 place-items-center rounded-full text-white ${toast.error ? 'bg-wred' : 'bg-wgreen'}`}>
              {toast.error ? <I.TriangleAlert size={14} /> : <I.Check size={14} stroke={2.6} />}
            </div>
            <div className="text-[12.5px]">
              <div className="font-bold">{toast.title}</div>
              <div className="text-white/70">{toast.sub}</div>
            </div>
            <button onClick={() => setToast(null)} className="ml-2 text-white/60 hover:text-white">
              <I.X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
