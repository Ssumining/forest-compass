'use client';
import { useMemo } from 'react';
import { I } from '@/components/ui/Icons';
import { slopeColor, makeMockTerrain } from '@/lib/slope';

const W = 600, H = 400;

function LegendChip({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-[10.5px] text-wsub">
      <span className="h-2.5 w-3 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function MapLegend() {
  return (
    <div className="absolute left-3 top-3 rounded-lg bg-white/95 backdrop-blur border border-wline shadow-card px-3 py-2">
      <div className="text-[10px] font-bold text-wink uppercase tracking-wider mb-1.5 flex items-center gap-1">
        <I.Layers size={11} /> 범례
      </div>
      <div className="space-y-1">
        <LegendChip color="#D6F2E6" label="0–15° 평탄/완경사" />
        <LegendChip color="#FAE6B0" label="15–24° 중경사" />
        <LegendChip color="#F49B7E" label="25–35° 급경사" />
        <LegendChip color="#E5677B" label="35°+ 험준지" />
        <div className="h-px bg-wline my-1" />
        <div className="flex items-center gap-1.5 text-[10.5px] text-wsub">
          <span className="h-2.5 w-3 rounded-sm bg-red-100 border border-red-300" />
          <span>제한 구역</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] text-wsub">
          <span className="h-2.5 w-3 rounded-sm" style={{ background: 'rgba(51,102,255,.20)', border: '1.5px solid #3366FF' }} />
          <span>대상 필지 (4.6ha)</span>
        </div>
      </div>
    </div>
  );
}

export default function MapView({ radius, slopeLimit, hover, setHover, avgSlope, maxSlopeInRadius, terrain = makeMockTerrain() }) {
  const { grid, cols, rows, parcelPolygon, parcelCenter } = terrain;
  const CELL_W = W / cols, CELL_H = H / rows;
  const radiusPx = useMemo(() => 30 + ((radius - 100) / (1500 - 100)) * 190, [radius]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="restricted-stripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="rgba(255,51,75,0.18)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#FF334B" strokeWidth="1.4" opacity=".7" />
        </pattern>
        <pattern id="parcel-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(60)">
          <rect width="8" height="8" fill="rgba(51,102,255,0.10)" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#3366FF" strokeWidth="1" opacity=".35" />
        </pattern>
        <radialGradient id="terrain-vignette" cx="50%" cy="55%" r="70%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(40,55,75,0.18)" />
        </radialGradient>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity=".18" />
        </filter>
      </defs>

      {/* Slope heatmap */}
      <g>
        {grid.map(cell => (
          <rect
            key={`${cell.c}-${cell.r}`}
            x={cell.c * CELL_W} y={cell.r * CELL_H}
            width={CELL_W + 0.4} height={CELL_H + 0.4}
            fill={slopeColor(cell.slope)}
          />
        ))}
      </g>

      {/* Restricted zones */}
      <g>
        {grid.map(cell => cell.slope <= slopeLimit ? null : (
          <rect
            key={`r-${cell.c}-${cell.r}`}
            x={cell.c * CELL_W} y={cell.r * CELL_H}
            width={CELL_W + 0.4} height={CELL_H + 0.4}
            fill="url(#restricted-stripe)"
          />
        ))}
      </g>

      {/* Contour lines */}
      <g fill="none" stroke="rgba(40,55,75,0.18)" strokeWidth="0.6">
        {[60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d, i) => (
          <path key={i} d={`M -10 ${d} C 120 ${d - 30 + i * 4}, 280 ${d + 15 - i * 3}, 430 ${d - 20 + i * 5} S 620 ${d + 10}, 620 ${d + 10}`} />
        ))}
      </g>

      {/* Vignette */}
      <rect x="0" y="0" width={W} height={H} fill="url(#terrain-vignette)" />

      {/* Harvest parcel */}
      <g filter="url(#soft-shadow)">
        <polygon points={parcelPolygon.map(p => p.join(',')).join(' ')} fill="url(#parcel-hatch)" stroke="#3366FF" strokeWidth="2" />
        <polygon points={parcelPolygon.map(p => p.join(',')).join(' ')} fill="none" stroke="#3366FF" strokeWidth="1.5" strokeOpacity=".4" className="drift-dash" />
      </g>

      {/* Radius circle */}
      <g>
        <circle cx={parcelCenter[0]} cy={parcelCenter[1]} r={radiusPx} fill="rgba(51,102,255,0.05)" stroke="#3366FF" strokeWidth="1.4" strokeDasharray="3 4" />
        <circle cx={parcelCenter[0]} cy={parcelCenter[1]} r="4" fill="#fff" stroke="#3366FF" strokeWidth="2" />
        <text x={parcelCenter[0] + radiusPx + 6} y={parcelCenter[1] - 4} fontSize="10" fill="#274FCF" fontWeight="700">r = {radius}m</text>
      </g>

      {/* Dead tree markers */}
      <g>
        {(terrain.deadTrees ?? []).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.4" fill="#FF334B" stroke="#fff" strokeWidth="1" />
        ))}
      </g>

      {/* Hover crosshair */}
      {hover && (
        <g pointerEvents="none">
          <line x1={hover.x} y1={0} x2={hover.x} y2={H} stroke="rgba(24,29,32,.35)" strokeWidth=".6" strokeDasharray="2 3" />
          <line x1={0} y1={hover.y} x2={W} y2={hover.y} stroke="rgba(24,29,32,.35)" strokeWidth=".6" strokeDasharray="2 3" />
          <g transform={`translate(${Math.min(hover.x + 10, W - 130)},${Math.max(hover.y - 46, 6)})`}>
            <rect width="124" height="40" rx="6" fill="#181D20" opacity=".94" />
            <text x="10" y="15" fontSize="10" fill="#9AA3AB" fontWeight="600">
              N {(35.4 + hover.y * 0.0002).toFixed(4)}° · E {(127.4 + hover.x * 0.0002).toFixed(4)}°
            </text>
            <text x="10" y="30" fontSize="11" fill="#fff" fontWeight="700">경사 {hover.slope.toFixed(1)}°</text>
            <rect x="74" y="20" width="40" height="12" rx="3" fill={hover.slope > slopeLimit ? '#FF334B' : '#00B578'} opacity=".92" />
            <text x="94" y="29" fontSize="9" textAnchor="middle" fill="#fff" fontWeight="700">
              {hover.slope > slopeLimit ? '제한' : '가능'}
            </text>
          </g>
        </g>
      )}

      {/* Hover capture layer */}
      <rect
        x="0" y="0" width={W} height={H} fill="transparent"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const sx = ((e.clientX - rect.left) / rect.width) * W;
          const sy = ((e.clientY - rect.top) / rect.height) * H;
          const c = Math.floor(sx / CELL_W);
          const r = Math.floor(sy / CELL_H);
          const cell = grid.find(g => g.c === c && g.r === r);
          if (cell) setHover({ x: sx, y: sy, slope: cell.slope });
        }}
        onMouseLeave={() => setHover(null)}
      />

      {/* Compass */}
      <g transform={`translate(${W - 46},34)`}>
        <circle r="20" fill="#fff" stroke="#E1E2E4" strokeWidth="1" />
        <polygon points="0,-13 4,2 0,-2 -4,2" fill="#FF334B" />
        <polygon points="0,13 4,-2 0,2 -4,-2" fill="#181D20" />
        <text x="0" y="-21" fontSize="8" fontWeight="700" textAnchor="middle" fill="#181D20">N</text>
      </g>

      {/* Scale bar */}
      <g transform={`translate(16,${H - 26})`}>
        <rect x="0" y="0" width="60" height="6" fill="#fff" stroke="#181D20" strokeWidth=".8" />
        <rect x="0" y="0" width="30" height="6" fill="#181D20" />
        <text x="0" y="18" fontSize="9" fill="#181D20" fontWeight="700">0</text>
        <text x="30" y="18" fontSize="9" fill="#181D20" fontWeight="700" textAnchor="middle">100m</text>
        <text x="60" y="18" fontSize="9" fill="#181D20" fontWeight="700" textAnchor="end">200m</text>
      </g>
    </svg>
  );
}

export { MapLegend };
