import { DEFAULT_GEO_CONSTS } from './apiContract';
import { pxToLatLng, DEFAULT_BOUNDS } from './geoProject';

export const PARCEL_PTS = [
  [228, 132], [262, 116], [306, 122], [348, 144], [372, 178], [378, 218],
  [358, 252], [326, 274], [290, 282], [256, 274], [228, 256], [212, 226], [208, 188], [216, 156],
];

export const PARCEL_CENTER = [294, 200];

// 고사목 마커. 계약(apiContract GEO_TERRAIN_KEYS)대로 {lat,lng,pine,conf}.
// 기존 픽셀 7점을 DEFAULT_BOUNDS로 투영해 좌표 유지. pine=true는 재선충 의심.
const DEAD_TREE_PX = [
  [252, 168], [284, 184], [310, 158], [268, 212], [324, 202], [298, 238], [260, 196],
];
const DEAD_TREE_META = [
  { pine: true, conf: 0.94 }, { pine: false, conf: 0.88 }, { pine: true, conf: 0.91 },
  { pine: false, conf: 0.79 }, { pine: true, conf: 0.86 }, { pine: false, conf: 0.83 },
  { pine: false, conf: 0.80 },
];
export const DEAD_TREES = DEAD_TREE_PX.map(([x, y], i) => {
  const [lat, lng] = pxToLatLng([x, y], DEFAULT_BOUNDS);
  return { lat, lng, ...DEAD_TREE_META[i] };
});

const MOCK_COLS = 60, MOCK_ROWS = 40;

export function buildSlopeGrid(cols, rows) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c / cols;
      const y = r / rows;
      const v =
        16 +
        9 * Math.sin(x * 5.7 + y * 3.1) +
        7 * Math.cos(x * 3.4 - y * 4.8 + 1.1) +
        4 * Math.sin((x + y) * 8.2 + 2.3) +
        6 * (x - 0.4) +
        -3 * (y - 0.5);
      cells.push({ c, r, slope: Math.max(2, Math.min(40, v)) });
    }
  }
  return cells;
}

// 백엔드 미연동 시 폴백 terrain. 백엔드 /geo/analyze 가 같은 형태를 돌려준다.
export function makeMockTerrain() {
  return {
    grid: buildSlopeGrid(MOCK_COLS, MOCK_ROWS),
    cols: MOCK_COLS,
    rows: MOCK_ROWS,
    parcelPolygon: PARCEL_PTS,
    parcelCenter: PARCEL_CENTER,
    parcelAreaHa: 4.6,
    deadTrees: DEAD_TREES,
    bounds: DEFAULT_BOUNDS,
    consts: DEFAULT_GEO_CONSTS,
    source: 'mock',
  };
}

export function slopeColor(s) {
  if (s < 12) return '#D6F2E6';
  if (s < 18) return '#A9E2C7';
  if (s < 24) return '#FAE6B0';
  if (s < 30) return '#F7C58A';
  if (s < 36) return '#F49B7E';
  return '#E5677B';
}

export function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// 슬라이더 변화마다 호출되는 "재집계" — terrain(격자·상수)은 고정, 여기만 매번 계산.
export function computeStats(radius, slopeLimit, robotOn = true, terrain = makeMockTerrain()) {
  const { grid, cols, rows, parcelPolygon, parcelCenter, consts } = terrain;
  const cellW = 600 / cols, cellH = 400 / rows;
  const radiusPx = 30 + ((radius - 100) / 1400) * 190;
  let inside = 0, sumSlope = 0, maxS = 0, over = 0;

  for (const cell of grid) {
    const cx = cell.c * cellW + cellW / 2;
    const cy = cell.r * cellH + cellH / 2;
    const inRadius = Math.sqrt((cx - parcelCenter[0]) ** 2 + (cy - parcelCenter[1]) ** 2) <= radiusPx;
    const inParcel = pointInPoly([cx, cy], parcelPolygon);
    if (inRadius && inParcel) {
      inside++;
      sumSlope += cell.slope;
      if (cell.slope > maxS) maxS = cell.slope;
      if (cell.slope > slopeLimit) over++;
    }
  }

  const avgSlope = inside ? sumSlope / inside : 18.7;
  const cellAreaHa = (cellW * cellH) * (radius / 500) * (radius / 500) / 14000;
  // 실제 필지 면적(API)이 있으면 우선 사용, 없으면 반경 근사
  const areaHa = consts.parcelAreaHa ?? Math.max(0.4, inside * cellAreaHa);
  const Ntree = Math.round(areaHa * consts.treeDensity);
  const Vunit = consts.Vunit;
  const Srobot = robotOn ? consts.robotFactor : 1.0; // SmartHarvest-X1 ×2 투입 시 +18% 효율
  const overRatio = inside ? over / inside : 0;
  const Y = Math.round(Ntree * Vunit * Srobot * Math.cos(avgSlope * Math.PI / 180));
  const carbonKRW = Math.round(Y * consts.carbonPerM3 * consts.carbonKRWperT);
  const compliantProb = Math.max(0, Math.min(98, 100 - (maxS - slopeLimit) * 8 - overRatio * 120));
  const compliant = compliantProb >= 70;

  return { avgSlope, maxSlopeInRadius: maxS, Ntree, Vunit, Srobot, overRatio, Y, carbonKRW, compliantProb, compliant };
}

// 산지관리법상 경사도 법정 한도(°) 기본값. 실제 값은 terrain.consts.legalSlopeLimit.
export const LEGAL_SLOPE_LIMIT = DEFAULT_GEO_CONSTS.legalSlopeLimit;

// 반경 고정 + 상한 범위 내에서 compliantProb가 가장 높아지는 값 반환 (적합 달성 불가 시에도 최선값 반환)
function bestSlopeLimit(radius, robotOn, from, to, terrain) {
  let best = null, bestProb = -1;
  for (let L = Math.max(5, from); L <= to; L++) {
    const { compliantProb } = computeStats(radius, L, robotOn, terrain);
    if (compliantProb > bestProb) { bestProb = compliantProb; best = L; }
  }
  return best ? { L: best, prob: bestProb } : null;
}

// 상한 고정 + 반경을 줄여 compliantProb가 가장 높아지는 반경 반환
function bestRadius(maxRadius, slopeLimit, robotOn, terrain) {
  let best = null, bestProb = -1;
  for (let r = maxRadius - 20; r >= 100; r -= 20) {
    const { compliantProb } = computeStats(r, slopeLimit, robotOn, terrain);
    if (compliantProb > bestProb) { bestProb = compliantProb; best = r; }
  }
  return best ? { r: best, prob: bestProb } : null;
}

// 비적합 상태 → 우회 설계안 목록 (완전 적합 불가 시에도 "최선의 개선" 제안)
export function buildBypassProposals(radius, slopeLimit, robotOn = true, terrain = makeMockTerrain()) {
  const legal = terrain.consts.legalSlopeLimit;
  const current = computeStats(radius, slopeLimit, robotOn, terrain);
  const proposals = [];

  // 1) 경사 상한 조정 — slopeLimit < legal 이면 법정 한도까지 상향 시도
  if (slopeLimit < legal) {
    const res = bestSlopeLimit(radius, robotOn, slopeLimit + 1, legal, terrain);
    if (res && res.prob > current.compliantProb) {
      const after = computeStats(radius, res.L, robotOn, terrain);
      const isCompliant = after.compliant;
      proposals.push({
        id: 'slope',
        kind: 'slope',
        title: isCompliant ? '경사 작업범위 상향 (적합 전환)' : `경사 작업범위 상향 (최선: ${res.L}°)`,
        desc: `상한을 ${slopeLimit}° → ${res.L}°로 조정 (법정 한도 ${legal}° 이내)${isCompliant ? '' : ' · 급경사 구역 추가 조치 필요'}`,
        apply: { slopeLimit: res.L },
        prob: after.compliantProb,
        Y: after.Y,
      });
    }
  }

  // 2) 반경 축소 → 급경사 셀 제외 (현재 확률보다 개선되는 최소 반경)
  if (radius > 100) {
    const res = bestRadius(radius, slopeLimit, robotOn, terrain);
    if (res && res.prob > current.compliantProb) {
      const after = computeStats(res.r, slopeLimit, robotOn, terrain);
      proposals.push({
        id: 'radius',
        kind: 'radius',
        title: after.compliant ? '벌채 반경 축소 (적합 전환)' : `벌채 반경 축소 (최선: ${res.r}m)`,
        desc: `반경 ${radius}m → ${res.r}m 축소해 급경사(>${slopeLimit}°) 구역 제외${after.compliant ? '' : ' · 인허가 확률 향상'}`,
        apply: { radius: res.r },
        prob: after.compliantProb,
        Y: after.Y,
      });
    }
  }

  return proposals;
}

// (하위 호환 유지용 — 내부에서는 buildBypassProposals 사용)
export function findCompliantSlopeLimit(radius, robotOn = true, from, to, terrain = makeMockTerrain()) {
  const limit = to ?? terrain.consts.legalSlopeLimit;
  for (let L = Math.max(5, from ?? 5); L <= limit; L++) {
    if (computeStats(radius, L, robotOn, terrain).compliant) return L;
  }
  return null;
}

export function findCompliantRadius(slopeLimit, robotOn = true, terrain = makeMockTerrain()) {
  for (let r = 1500; r >= 100; r -= 20) {
    if (computeStats(r, slopeLimit, robotOn, terrain).compliant) return r;
  }
  return null;
}
