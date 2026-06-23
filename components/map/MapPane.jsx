'use client';
import { useState, useMemo } from 'react';
import { I } from '@/components/ui/Icons';
import { computeStats, makeMockTerrain } from '@/lib/slope';
import { MapLegend } from './MapView';
import MapCanvas from './MapCanvas';
import BypassCard from './BypassCard';

function Slider({ label, sub, value, min, max, step, unit, onChange, marks, accent = '#3366FF', subColor }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] font-semibold text-wink">{label}</label>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[16px] font-bold tabular-nums" style={{ color: accent }}>{value}</span>
          <span className="text-[11px] text-wsub">{unit}</span>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="wslider"
        style={{ background: `linear-gradient(to right, ${accent} 0%, ${accent} ${((value - min) / (max - min)) * 100}%, #E1E2E4 ${((value - min) / (max - min)) * 100}%, #E1E2E4 100%)` }}
      />
      <div className="flex justify-between text-[10px] text-wsub tabular-nums">
        {marks.map(m => <span key={m}>{m}{unit}</span>)}
      </div>
      {sub && <div className="text-[10.5px]" style={{ color: subColor || '#767676' }}>{sub}</div>}
    </div>
  );
}

function StatCard({ icon: IcoCmp, label, value, unit, sub, accent = 'wblue-500', badge, isPositive }) {
  return (
    <div className="rounded-xl border border-wline bg-white p-3 shadow-card relative overflow-hidden">
      <div className="flex items-center gap-1.5 text-wsub text-[11px] font-semibold">
        <IcoCmp size={12} />
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mt-1.5">
        <span className={`text-[22px] font-extrabold tabular-nums text-${accent}`}>{value}</span>
        {unit && <span className="text-[12px] font-semibold text-wsub">{unit}</span>}
      </div>
      {sub && (
        <div className={`text-[11px] font-medium ${isPositive === false ? 'text-wred' : isPositive ? 'text-wgreen' : 'text-wsub'} mt-0.5`}>
          {sub}
        </div>
      )}
      {badge}
    </div>
  );
}

function FormulaCard({ Ntree, Vunit, Srobot, theta, Y }) {
  return (
    <div className="rounded-xl border border-wline bg-gradient-to-br from-wbg to-white p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-wink">
          <I.Calc size={13} className="text-wblue-500" /> 라이브 수확량 모델
        </div>
        <div className="text-[10px] text-wsub font-mono">KFRI-YIELD v3.2</div>
      </div>
      <div className="rounded-lg bg-white border border-wline px-3 py-3 overflow-x-auto font-mono">
        <div className="flex items-center justify-center gap-2 text-[15px] text-wink whitespace-nowrap">
          <span className="font-bold text-wblue-600 italic">Y</span>
          <span className="text-wsub">=</span>
          <span className="font-semibold">N<sub className="text-[10px] text-wsub">tree</sub></span>
          <span className="text-wsub">×</span>
          <span className="font-semibold">V<sub className="text-[10px] text-wsub">unit</sub></span>
          <span className="text-wsub">×</span>
          <span className="font-semibold">S<sub className="text-[10px] text-wsub">robot</sub></span>
          <span className="text-wsub">×</span>
          <span className="font-semibold italic">cos(θ<sub className="text-[10px] text-wsub">slope</sub>)</span>
        </div>
        <div className="mt-2.5 flex items-center justify-center gap-2 text-[12px] text-wsub whitespace-nowrap">
          <span>
            <span className="text-wink font-semibold tabular-nums">{Ntree.toLocaleString()}</span> ×
            <span className="text-wink font-semibold tabular-nums"> {Vunit.toFixed(2)}</span> ×
            <span className="text-wink font-semibold tabular-nums"> {Srobot.toFixed(2)}</span> ×
            <span className="text-wink font-semibold tabular-nums"> cos({theta.toFixed(1)}°)</span>
          </span>
          <span>=</span>
          <span className="text-wblue-600 font-extrabold text-[14px] tabular-nums">{Y.toLocaleString()} m³</span>
        </div>
      </div>
    </div>
  );
}

// 주소 검색창
function LocationSearch({ selectedLocation, onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | error
  const [errMsg, setErrMsg] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setState('loading');
    setErrMsg('');
    try {
      const res = await fetch('/api/land-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: query.trim() }),
      });
      const data = await res.json();
      if (data.error_coord || data.error_pnu || !res.ok) {
        throw new Error(data.message ?? data.error_coord ?? '주소를 찾을 수 없습니다.');
      }
      onLocationSelect?.({
        lat: data.y,
        lng: data.x,
        address: query.trim(),
        jibun: data.jibun ?? '',
        pnu: data.pnu ?? '',
        landCategory: data.landCategory ?? '',
        areaSqm: data.areaSqm ?? 0,
        siteClassification: data.siteClassification ?? '',
      });
      setState('idle');
    } catch (err) {
      setErrMsg(String(err.message ?? err));
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex items-center gap-1.5 min-w-0 flex-1">
      <div className={`flex items-center gap-1.5 flex-1 rounded-md border bg-white px-2.5 py-1 text-[12px] transition ${
        state === 'error' ? 'border-wred/50' : 'border-wline focus-within:border-wblue-400'
      }`}>
        {state === 'loading'
          ? <I.Loader size={13} className="shrink-0 text-wsub spin-slow" />
          : <I.Search size={13} className="shrink-0 text-wsub" />}
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="소재지 + 지번 입력  예) 경기도 가평군 북면 이곡리 산1"
          className="flex-1 bg-transparent text-wink placeholder-wsub/60 focus:outline-none min-w-0"
        />
        {errMsg && <span className="text-[10px] text-wred shrink-0">{errMsg}</span>}
      </div>
      <button type="submit" disabled={state === 'loading'}
        className="shrink-0 rounded-md bg-wblue-500 hover:bg-wblue-600 text-white px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-60 transition">
        조회
      </button>
    </form>
  );
}

export default function MapPane({
  radius, setRadius, slopeLimit, setSlopeLimit, robotOn, setRobotOn,
  terrain = makeMockTerrain(),
  terrainLoading = false,
  selectedLocation, onLocationSelect,
  onReset,
}) {
  const [hover, setHover] = useState(null);
  const stats = useMemo(() => computeStats(radius, slopeLimit, robotOn, terrain), [radius, slopeLimit, robotOn, terrain]);
  const { avgSlope, maxSlopeInRadius, Ntree, Vunit, Srobot, overRatio, Y, carbonKRW, compliantProb, compliant } = stats;

  const locationLabel = selectedLocation?.address
    ? selectedLocation.address
    : '위치 미선택';

  return (
    <div className="flex h-full flex-col bg-wbg/40">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-wline bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-wblue-50 text-wblue-600 ring-1 ring-wblue-100">
              <I.Map size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold text-wink flex items-center gap-1.5">
                경사도 컴플라이언스 지도
                <span className="text-[10px] font-mono text-wsub bg-wbg px-1 rounded">GIS</span>
              </div>
              <div className="text-[10.5px] text-wsub truncate flex items-center gap-1">
                <I.Pin size={10} />
                {terrainLoading
                  ? <span className="flex items-center gap-1 text-wblue-500"><I.Loader size={10} className="spin-slow" /> SRTM 경사도 분석 중…</span>
                  : selectedLocation?.lat
                    ? `${locationLabel} · ${terrain.source === 'srtm' ? '실측 경사도' : '추정 경사도'}`
                    : '주소를 검색하거나 지도를 클릭해 위치를 선택하세요'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="h-8 w-8 grid place-items-center rounded-md text-wsub hover:bg-wbg hover:text-wink"><I.Layers size={15} /></button>
            <button className="h-8 w-8 grid place-items-center rounded-md text-wsub hover:bg-wbg hover:text-wink"><I.Eye size={15} /></button>
          </div>
        </div>
        {/* 주소 검색창 */}
        <LocationSearch selectedLocation={selectedLocation} onLocationSelect={onLocationSelect} />
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll">
        {/* Map */}
        <div className="relative mx-3 mt-3 rounded-xl overflow-hidden border border-wline bg-white shadow-card">
          <div className="relative aspect-[3/2] sm:aspect-[16/9] lg:aspect-[3/2] xl:aspect-[5/3]">
            <MapCanvas
              radius={radius} slopeLimit={slopeLimit}
              hover={hover} setHover={setHover}
              avgSlope={avgSlope} maxSlopeInRadius={maxSlopeInRadius}
              terrain={terrain}
              selectedLocation={selectedLocation}
              onLocationSelect={onLocationSelect}
            />
            <MapLegend />
            <div className="absolute right-3 top-3">
              <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-card backdrop-blur ${compliant ? 'border-wgreen/30 bg-wgreen/10 text-wgreen' : 'border-wred/30 bg-wred/10 text-wred'}`}>
                {compliant ? <I.ShieldCheck size={12} /> : <I.TriangleAlert size={12} />}
                {compliant ? '인허가 적합' : '인허가 부적합'}
              </div>
            </div>
            <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/95 backdrop-blur border border-wline px-3 py-1.5 text-[10.5px] text-wsub shadow-card">
              {selectedLocation?.lat ? (
                <>
                  {selectedLocation.landCategory && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-wblue-400" />
                      지목: <b className="text-wink">{selectedLocation.landCategory}</b>
                    </span>
                  )}
                  {selectedLocation.areaSqm > 0 && (
                    <span className="flex items-center gap-1">
                      <I.Layers size={11} />
                      {selectedLocation.areaSqm.toLocaleString()}㎡
                    </span>
                  )}
                  {selectedLocation.siteClassification && selectedLocation.siteClassification !== '미분류' && (
                    <span className="flex items-center gap-1">
                      <I.Trees size={11} />
                      {selectedLocation.siteClassification}
                    </span>
                  )}
                  <span className="flex items-center gap-1"><I.Mountain size={11} /> 평균 {avgSlope.toFixed(1)}°</span>
                  <span className="flex items-center gap-1"><I.Compass size={11} /> 최대 {maxSlopeInRadius.toFixed(1)}°</span>
                  <span className="ml-auto font-mono text-wink/70">
                    {terrain.source === 'srtm' ? 'SRTM 30m' : 'EPSG:4326'} · WGS84
                  </span>
                </>
              ) : (
                <span className="text-wsub/60 italic">위치를 선택하면 분석이 시작됩니다</span>
              )}
            </div>
          </div>
        </div>

        {/* 우회 설계 제안 */}
        {!compliant && selectedLocation?.lat && (
          <div className="mx-3 mt-3">
            <BypassCard
              radius={radius} slopeLimit={slopeLimit} robotOn={robotOn}
              currentY={Y} terrain={terrain}
              setRadius={setRadius} setSlopeLimit={setSlopeLimit}
            />
          </div>
        )}

        {/* Simulator */}
        <div className="mx-3 mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-xl border border-wline bg-white p-4 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-bold text-wink">
                <I.Sliders size={14} className="text-wblue-500" /> What-If 시뮬레이터
              </div>
              <button onClick={onReset} className="text-[10.5px] text-wblue-500 font-semibold hover:underline">초기화</button>
            </div>
            <Slider
              label="벌채 범위 반경 (Radius)"
              sub={`작업 가능 면적 ≈ ${(Math.PI * (radius / 100) * (radius / 100) / 100).toFixed(2)} ha`}
              value={radius} min={100} max={1500} step={20} unit="m"
              onChange={setRadius} marks={[100, 500, 1000, 1500]}
            />
            <Slider
              label="경사도 상한치 (Slope Limit)"
              sub={
                slopeLimit < maxSlopeInRadius
                  ? `${(overRatio * 100).toFixed(1)}% 영역이 상한 초과 — 제한 구역 표시됨`
                  : '대상지 전체가 상한 이내 — 인허가 통과 가능'
              }
              subColor={slopeLimit < maxSlopeInRadius ? '#FF334B' : '#00B578'}
              value={slopeLimit} min={5} max={45} step={1} unit="°"
              onChange={setSlopeLimit} marks={[5, 15, 25, 35, 45]}
              accent={slopeLimit < maxSlopeInRadius ? '#FF334B' : '#00B578'}
            />
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 border transition ${
              robotOn ? 'bg-wblue-50/60 border-wblue-200' : 'bg-wbg/70 border-wline'
            }`}>
              <div className="flex items-center gap-2 text-[11.5px]">
                <I.Robot size={14} className={robotOn ? 'text-wblue-600' : 'text-wsub'} />
                <span className={`font-semibold ${robotOn ? 'text-wink' : 'text-wsub'}`}>AI 임업 로봇 투입</span>
                <span className="text-wsub">SmartHarvest-X1 ×2</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10.5px] font-semibold tabular-nums ${robotOn ? 'text-wblue-600' : 'text-wsub/60'}`}>
                  효율 {robotOn ? '+18%' : '0%'}
                </span>
                <button
                  onClick={() => setRobotOn(v => !v)}
                  role="switch" aria-checked={robotOn}
                  className={`relative h-5 w-9 rounded-full transition ${robotOn ? 'bg-wblue-500' : 'bg-wline'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${robotOn ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
          <FormulaCard Ntree={Ntree} Vunit={Vunit} Srobot={Srobot} theta={avgSlope} Y={Y} />
        </div>

        {/* Stat cards */}
        <div className="mx-3 mt-3 mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={I.Trees} label="예상 수확 재적 (Yield)"
            value={Y.toLocaleString()} unit="m³"
            sub={`본수 ${Ntree.toLocaleString()}본 · cos(${avgSlope.toFixed(1)}°)=${Math.cos(avgSlope * Math.PI / 180).toFixed(3)}`}
            accent="wblue-600"
          />
          <StatCard
            icon={I.Leaf} label="탄소 고정 기여액"
            value={(carbonKRW / 10000).toFixed(0)} unit="만원"
            sub={`${(Y * 0.92).toFixed(0)} tCO₂eq · 배출권 ₩30,000/t`}
            accent="wgreen" isPositive
          />
          <StatCard
            icon={I.ShieldCheck} label="인허가 가능 확률"
            value={compliantProb.toFixed(0)} unit="%"
            sub={compliant ? '적합 — 신고서 자동 생성 가능' : '부적합 — 상한치 조정 권장'}
            isPositive={compliant}
            accent={compliant ? 'wgreen' : 'wred'}
            badge={
              <div className={`absolute right-3 top-3 px-1.5 py-0.5 rounded text-[10px] font-bold ${compliant ? 'bg-wgreen/10 text-wgreen' : 'bg-wred/10 text-wred'}`}>
                {compliant ? '적합' : '부적합'}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
