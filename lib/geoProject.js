// 픽셀(600×400 SVG 좌표) ↔ 지리좌표(lat/lng) 양방향 투영.
// computeStats(slope.js)는 픽셀 공간 그대로 두고, 렌더링 직전에만 이 헬퍼로 투영한다.
// (외부 의존성 없음 — 순수 선형 변환)

export const PX_W = 600;
export const PX_H = 400;

// 전북 남원시 산내면 산 32-1 (지리산권) 근방 외접 bbox.
// 600×400 픽셀 영역이 매핑되는 실제 위경도 범위. y=0(상단)=북(latN).
// 폭 약 2km / 높이 약 1.33km.
export const DEFAULT_BOUNDS = [
  [35.330, 127.545], // [latS, lngW] 남서
  [35.342, 127.567], // [latN, lngE] 북동
];

// 픽셀 [x,y] → [lat, lng]. x: 0→lngW, PX_W→lngE / y: 0→latN, PX_H→latS (y 반전).
export function pxToLatLng([x, y], bounds = DEFAULT_BOUNDS) {
  const [[latS, lngW], [latN, lngE]] = bounds;
  const lng = lngW + (x / PX_W) * (lngE - lngW);
  const lat = latN - (y / PX_H) * (latN - latS);
  return [lat, lng];
}

// [lat, lng] → 픽셀 [x, y] (pxToLatLng 역변환).
export function latLngToPx([lat, lng], bounds = DEFAULT_BOUNDS) {
  const [[latS, lngW], [latN, lngE]] = bounds;
  const x = ((lng - lngW) / (lngE - lngW)) * PX_W;
  const y = ((latN - lat) / (latN - latS)) * PX_H;
  return [x, y];
}

// 격자 셀 1칸(c,r) → Leaflet Rectangle bounds [[lat,lng],[lat,lng]] (SW, NE).
export function gridCellBounds(cell, terrain) {
  const { cols, rows, bounds = DEFAULT_BOUNDS } = terrain;
  const cw = PX_W / cols, ch = PX_H / rows;
  const sw = pxToLatLng([cell.c * cw, (cell.r + 1) * ch], bounds);
  const ne = pxToLatLng([(cell.c + 1) * cw, cell.r * ch], bounds);
  return [sw, ne];
}

// 픽셀 반경 → 미터 (Leaflet Circle radius).
// 수평(경도) m/px 근사 — 근사정방형 소규모 필지에서 정확하며, 반경 원은 표시용이라
// bbox가 약간 비정방형이어도(가로/세로 m/px 차이) 시각 오차는 무시 가능.
export function pxRadiusToMeters(radiusPx, bounds = DEFAULT_BOUNDS) {
  const [[latS, lngW], [latN, lngE]] = bounds;
  const latMid = (latS + latN) / 2;
  const metersPerLng = Math.cos((latMid * Math.PI) / 180) * 111320;
  const widthMeters = (lngE - lngW) * metersPerLng;
  return radiusPx * (widthMeters / PX_W);
}
