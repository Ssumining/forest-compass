import { DEFAULT_GEO_CONSTS } from './apiContract';

export const PARCEL_PTS = [
  [228, 132], [262, 116], [306, 122], [348, 144], [372, 178], [378, 218],
  [358, 252], [326, 274], [290, 282], [256, 274], [228, 256], [212, 226], [208, 188], [216, 156],
];

export const PARCEL_CENTER = [294, 200];

// 고사목 마커 (현 mock=픽셀좌표 / 실연동 시 terrain.deadTrees 의 lat,lng 사용)
export const DEAD_TREES = [
  [252, 168], [284, 184], [310, 158], [268, 212], [324, 202], [298, 238], [260, 196],
];

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
  const areaHa = Math.max(0.4, inside * cellAreaHa);
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

// 현재 반경에서 "적합"이 되는 최소 경사 상한치(법정 한도 이내). 없으면 null.
export function findCompliantSlopeLimit(radius, robotOn = true, from, to, terrain = makeMockTerrain()) {
  const limit = to ?? terrain.consts.legalSlopeLimit;
  const start = Math.max(5, from ?? 5);
  for (let L = start; L <= limit; L++) {
    if (computeStats(radius, L, robotOn, terrain).compliant) return L;
  }
  return null;
}

// 현재 경사 상한에서 "적합"을 유지하는 가장 넓은 반경(m). 없으면 null.
export function findCompliantRadius(slopeLimit, robotOn = true, terrain = makeMockTerrain()) {
  for (let r = 1500; r >= 100; r -= 20) {
    if (computeStats(r, slopeLimit, robotOn, terrain).compliant) return r;
  }
  return null;
}

// 비적합 상태 → 적용 가능한 우회 설계안 목록 생성
export function buildBypassProposals(radius, slopeLimit, robotOn = true, terrain = makeMockTerrain()) {
  const legal = terrain.consts.legalSlopeLimit;
  const proposals = [];

  // 1) 경사 상한을 법정 한도 이내로 정상화하여 적합 전환
  if (slopeLimit < legal) {
    const L = findCompliantSlopeLimit(radius, robotOn, slopeLimit + 1, legal, terrain);
    if (L != null) {
      const after = computeStats(radius, L, robotOn, terrain);
      proposals.push({
        id: 'slope',
        kind: 'slope',
        title: '경사 작업범위 상향',
        desc: `상한을 ${slopeLimit}° → ${L}°로 조정 (법정 한도 ${legal}° 이내)`,
        apply: { slopeLimit: L },
        prob: after.compliantProb,
        Y: after.Y,
      });
    }
  }

  // 2) 벌채 반경 축소 → 위험 사면 제외
  const r = findCompliantRadius(slopeLimit, robotOn, terrain);
  if (r != null && r < radius) {
    const after = computeStats(r, slopeLimit, robotOn, terrain);
    proposals.push({
      id: 'radius',
      kind: 'radius',
      title: '벌채 반경 축소',
      desc: `반경을 ${radius}m → ${r}m로 축소해 위험 사면(>${slopeLimit}°) 제외`,
      apply: { radius: r },
      prob: after.compliantProb,
      Y: after.Y,
    });
  }

  return proposals;
}
