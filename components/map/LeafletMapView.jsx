'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, SVGOverlay, Polygon, Circle, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import { slopeColor, makeMockTerrain } from '@/lib/slope';
import { pxToLatLng, latLngToPx, pxRadiusToMeters, DEFAULT_BOUNDS, PX_W, PX_H } from '@/lib/geoProject';

const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const HILLSHADE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';

function radiusToPx(radius) {
  return 30 + ((radius - 100) / (1500 - 100)) * 190;
}

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

// 클릭 위치 선택
function ClickSelector({ onLocationSelect, enabled }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onLocationSelect?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// 선택 위치가 바뀌면 지도를 그 위치로 이동
function FlyTo({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location?.lat && location?.lng) {
      map.flyTo([location.lat, location.lng], 14, { duration: 1.2 });
    }
  }, [location?.lat, location?.lng, map]);
  return null;
}

// 컨테이너 크기 변화(신고서 접기/펴기 등) 시 지도 재측정
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function LeafletMapView({
  radius, slopeLimit,
  terrain = makeMockTerrain(),
  selectedLocation,
  onLocationSelect,
  onReady, onOffline,
}) {
  const bounds = terrain.bounds ?? DEFAULT_BOUNDS;
  const { grid, cols, rows, parcelPolygon, parcelCenter, deadTrees = [] } = terrain;
  const cw = PX_W / cols, ch = PX_H / rows;
  const [hover, setHover] = useState(null);
  const errCount = useRef(0);
  const loadedRef = useRef(false);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { if (!loadedRef.current) onOffline?.(); }, 3500);
    return () => clearTimeout(t);
  }, [onOffline]);

  const parcelLatLng = parcelPolygon.map((p) => pxToLatLng(p, bounds));
  const centerLatLng = selectedLocation?.lat
    ? [selectedLocation.lat, selectedLocation.lng]
    : pxToLatLng(parcelCenter, bounds);
  const radiusMeters = pxRadiusToMeters(radiusToPx(radius), bounds);

  const heatmap = useMemo(
    () => grid.map((cell) => (
      <rect key={`s-${cell.c}-${cell.r}`} x={cell.c * cw} y={cell.r * ch}
        width={cw + 0.4} height={ch + 0.4} fill={slopeColor(cell.slope)} />
    )),
    [grid, cw, ch],
  );

  const restricted = useMemo(
    () => grid.map((cell) => cell.slope <= slopeLimit ? null : (
      <rect key={`r-${cell.c}-${cell.r}`} x={cell.c * cw} y={cell.r * ch}
        width={cw + 0.4} height={ch + 0.4} fill="url(#leaflet-restricted-stripe)" />
    )),
    [grid, cw, ch, slopeLimit],
  );

  return (
    <div className="absolute inset-0 isolate">
      {/* 위치 선택 안내 배너 */}
      {selecting && (
        <div className="absolute inset-x-0 top-2 z-[500] flex justify-center pointer-events-none">
          <div className="bg-wblue-500 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full shadow-pop flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            지도를 클릭해 위치를 선택하세요 — ESC로 취소
          </div>
        </div>
      )}

      {/* 선택 모드 토글 버튼 */}
      <button
        onClick={() => setSelecting(v => !v)}
        className={`absolute right-3 bottom-14 z-[400] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-pop border transition ${
          selecting
            ? 'bg-wblue-500 text-white border-wblue-500'
            : 'bg-white/95 text-wink border-wline hover:border-wblue-300'
        }`}
      >
        📍 {selecting ? '선택 중…' : '위치 선택'}
      </button>

      <MapContainer
        bounds={bounds}
        zoomControl={false}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: 'transparent', cursor: selecting ? 'crosshair' : '' }}
      >
        <AutoResize />
        <TileLayer
          url={IMAGERY_URL}
          attribution="Tiles &copy; Esri"
          eventHandlers={{
            load: () => { loadedRef.current = true; errCount.current = 0; onReady?.(); },
            tileerror: () => { if (++errCount.current > 8) onOffline?.(); },
          }}
        />
        <TileLayer url={HILLSHADE_URL} opacity={0.35} />

        {selectedLocation?.lat && (
          <SVGOverlay bounds={bounds} attributes={{ viewBox: `0 0 ${PX_W} ${PX_H}`, preserveAspectRatio: 'none' }}>
            <defs>
              <pattern id="leaflet-restricted-stripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="rgba(255,51,75,0.18)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#FF334B" strokeWidth="1.4" opacity="0.7" />
              </pattern>
            </defs>
            <g opacity={0.50}>{heatmap}</g>
            <g>{restricted}</g>
          </SVGOverlay>
        )}

        {selectedLocation?.lat && (
          <Polygon positions={parcelLatLng}
            pathOptions={{ color: '#3366FF', weight: 2, fillColor: '#3366FF', fillOpacity: 0.10 }} />
        )}

        <Circle center={centerLatLng} radius={radiusMeters}
          pathOptions={{ color: '#3366FF', weight: 1.4, dashArray: '4 4', fillColor: '#3366FF', fillOpacity: 0.05 }} />

        {deadTrees.map((d, i) => (
          <CircleMarker key={i} center={[d.lat, d.lng]} radius={4}
            pathOptions={{ color: '#fff', weight: 1, fillColor: d.pine ? '#FF334B' : '#F59E0B', fillOpacity: 1 }} />
        ))}

        <HoverProbe terrain={terrain} bounds={bounds} setHover={setHover} />
        <ClickSelector
          enabled={selecting}
          onLocationSelect={(loc) => {
            onLocationSelect?.(loc);
            setSelecting(false);
          }}
        />
        <FlyTo location={selectedLocation} />
      </MapContainer>

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
