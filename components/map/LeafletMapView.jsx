'use client';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, SVGOverlay, Polygon, Circle, CircleMarker, useMapEvents } from 'react-leaflet';
import { slopeColor, makeMockTerrain } from '@/lib/slope';
import { pxToLatLng, latLngToPx, pxRadiusToMeters, DEFAULT_BOUNDS, PX_W, PX_H } from '@/lib/geoProject';

const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const HILLSHADE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';

// MapView/computeStats와 동일한 반경 픽셀 공식.
function radiusToPx(radius) {
  return 30 + ((radius - 100) / (1500 - 100)) * 190;
}

// 마우스 이동 → lat/lng → 픽셀 → 셀 경사 조회. 부모에 hover 전달.
function HoverProbe({ terrain, bounds, setHover }) {
  const { grid, cols, rows } = terrain;
  const cw = PX_W / cols, ch = PX_H / rows;
  useMapEvents({
    mousemove(e) {
      const [x, y] = latLngToPx([e.latlng.lat, e.latlng.lng], bounds);
      const c = Math.floor(x / cw), r = Math.floor(y / ch);
      const cell = grid.find((g) => g.c === c && g.r === r);
      setHover(cell ? { x: e.containerPoint.x, y: e.containerPoint.y, slope: cell.slope } : null);
    },
    mouseout() { setHover(null); },
  });
  return null;
}

export default function LeafletMapView({ radius, slopeLimit, terrain = makeMockTerrain(), onReady, onOffline }) {
  const bounds = terrain.bounds ?? DEFAULT_BOUNDS;
  const { grid, cols, rows, parcelPolygon, parcelCenter, deadTrees = [] } = terrain;
  const cw = PX_W / cols, ch = PX_H / rows;
  const [hover, setHover] = useState(null);
  const errCount = useRef(0);
  const loadedRef = useRef(false);

  // 타일 로드 타임아웃 가드 — 3.5초 내 한 장도 못 받으면 오프라인 폴백.
  useEffect(() => {
    const t = setTimeout(() => { if (!loadedRef.current) onOffline?.(); }, 3500);
    return () => clearTimeout(t);
  }, [onOffline]);

  const parcelLatLng = parcelPolygon.map((p) => pxToLatLng(p, bounds));
  const centerLatLng = pxToLatLng(parcelCenter, bounds);
  const radiusMeters = pxRadiusToMeters(radiusToPx(radius), bounds);

  return (
    <div className="absolute inset-0 isolate">
      <MapContainer
        bounds={bounds}
        zoomControl={false}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: 'transparent' }}
      >
        <TileLayer
          url={IMAGERY_URL}
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          eventHandlers={{
            load: () => { loadedRef.current = true; errCount.current = 0; onReady?.(); },
            tileerror: () => { if (++errCount.current > 8) onOffline?.(); },
          }}
        />
        <TileLayer url={HILLSHADE_URL} opacity={0.35} />

        {/* 경사 히트맵 + 제한구역 — 600×400 SVG를 bounds에 정렬 */}
        <SVGOverlay bounds={bounds} attributes={{ viewBox: `0 0 ${PX_W} ${PX_H}`, preserveAspectRatio: 'none' }}>
          <g opacity={0.55}>
            {grid.map((cell) => (
              <rect key={`s-${cell.c}-${cell.r}`} x={cell.c * cw} y={cell.r * ch}
                width={cw + 0.4} height={ch + 0.4} fill={slopeColor(cell.slope)} />
            ))}
          </g>
          <g>
            {grid.map((cell) => cell.slope <= slopeLimit ? null : (
              <rect key={`r-${cell.c}-${cell.r}`} x={cell.c * cw} y={cell.r * ch}
                width={cw + 0.4} height={ch + 0.4} fill="rgba(255,51,75,0.40)" />
            ))}
          </g>
        </SVGOverlay>

        {/* 대상 필지 */}
        <Polygon positions={parcelLatLng}
          pathOptions={{ color: '#3366FF', weight: 2, fillColor: '#3366FF', fillOpacity: 0.10 }} />

        {/* 벌채 반경 */}
        <Circle center={centerLatLng} radius={radiusMeters}
          pathOptions={{ color: '#3366FF', weight: 1.4, dashArray: '4 4', fillColor: '#3366FF', fillOpacity: 0.05 }} />

        {/* 고사목 */}
        {deadTrees.map((d, i) => (
          <CircleMarker key={i} center={[d.lat, d.lng]} radius={4}
            pathOptions={{ color: '#fff', weight: 1, fillColor: d.pine ? '#FF334B' : '#F59E0B', fillOpacity: 1 }} />
        ))}

        <HoverProbe terrain={terrain} bounds={bounds} setHover={setHover} />
      </MapContainer>

      {/* hover readout */}
      {hover && (
        <div className="pointer-events-none absolute z-[400] rounded-md bg-[#181D20]/95 px-2 py-1 text-[10px] text-white shadow-card"
          style={{ left: Math.min(hover.x + 10, PX_W), top: Math.max(hover.y - 30, 6) }}>
          <span className="text-[#9AA3AB] font-semibold">경사 </span>
          <span className="font-bold tabular-nums">{hover.slope.toFixed(1)}°</span>
          <span className={`ml-1.5 rounded px-1 ${hover.slope > slopeLimit ? 'bg-wred' : 'bg-wgreen'}`}>
            {hover.slope > slopeLimit ? '제한' : '가능'}
          </span>
        </div>
      )}
    </div>
  );
}
