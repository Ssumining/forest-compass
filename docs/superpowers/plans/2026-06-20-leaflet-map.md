# Leaflet 실지도 + 경사 컴플라이언스 오버레이 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SVG 목업 지도(`MapView.jsx`)를 실제 Leaflet 2D 지도 + Esri 위성/hillshade로 교체하되, 검증된 `computeStats`·시뮬레이터는 한 줄도 바꾸지 않는다.

**Architecture:** terrain에 지리 앵커(`bounds`) 1필드만 추가하고, 픽셀(600×400)↔lat/lng 투영 헬퍼(`lib/geoProject.js`)를 신설한다. `MapCanvas`가 `next/dynamic({ssr:false})`로 `LeafletMapView`를 로드하고, 타일 실패/예외 시 기존 SVG `MapView`로 폴백한다. 경사 격자는 `SVGOverlay`로 bounds에 정렬해 재사용, 필지·반경·고사목은 네이티브 Leaflet 벡터로 그린다. `computeStats`는 픽셀 공간 그대로 두고 렌더링 직전에만 투영한다.

**Tech Stack:** Next.js 16.2.7 (App Router), React 19.2.4, Tailwind v4, leaflet ^1.9 + react-leaflet ^5. **단위 테스트 프레임워크 없음** → 검증은 프로젝트 관례인 `npm run build` + 런타임 curl 스모크 + 육안.

## Global Constraints

- **React 19** → react-leaflet는 **반드시 v5 이상** (v4.2.1은 React 18 전용, 비호환). leaflet ^1.9.
- **`computeStats`/`slope.js`의 `buildSlopeGrid`/`computeStats`/`buildBypassProposals` 연산 로직은 변경 금지.** 추가만 한다(`bounds` 필드, `deadTrees` 형태 승격).
- **Next.js 16 dynamic 규약:** `dynamic(() => import(...), { ssr:false })`는 **Client Component 안에서만** 호출. `MapCanvas`는 `'use client'`.
- **고사목 마커는 `CircleMarker`(벡터)** 사용 — `Marker`(이미지 아이콘)는 leaflet 기본 아이콘 경로 깨짐 이슈가 있어 쓰지 않는다.
- **검증 curl은 UTF-8 JSON 파일**(`--data-binary @file`)로 (Git Bash가 한글 인자 깨뜨림). 서버는 `npm run start -- -p 3940` 또는 `npm run dev`.
- 픽셀 좌표계: `PX_W=600`, `PX_H=400`. 반경 픽셀 공식 `radiusPx = 30 + ((radius-100)/(1500-100))*190` (MapView/computeStats와 동일).
- 모든 폴백 경로에서 **화면이 비지 않는다** — SVG `MapView`가 최종 안전망.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `package.json`, `package-lock.json` | leaflet + react-leaflet 의존성 | Modify (npm install) |
| `lib/geoProject.js` | 픽셀↔lat/lng 투영 헬퍼 | Create |
| `lib/slope.js` | `makeMockTerrain`에 `bounds`, `DEAD_TREES`를 lat/lng로 승격 | Modify |
| `lib/apiContract.js` | `GEO_TERRAIN_KEYS`에 `bounds` 추가 | Modify |
| `components/map/MapView.jsx` | deadTrees lat/lng 역투영 (SVG 폴백 유지) | Modify |
| `components/map/LeafletMapView.jsx` | react-leaflet 실지도 | Create |
| `components/map/MapCanvas.jsx` | dynamic 래퍼 + online/offline + ErrorBoundary + Leaflet CSS | Create |
| `components/map/MapPane.jsx` | `MapView` → `MapCanvas` 호출 | Modify (최소) |

---

## Task 1: Leaflet 의존성 설치

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: 현재 React 버전 확인**

Run: `node -p "require('./package.json').dependencies.react"`
Expected: `19.2.4` (React 19 → react-leaflet v5 필요 확인)

- [ ] **Step 2: 호환 버전 설치**

Run: `npm install leaflet@^1.9.4 react-leaflet@^5.0.0`
Expected: 에러 없이 설치 완료. peer dependency 경고(react 관련)가 없어야 한다. `ERESOLVE` 발생 시 중단하고 설치된 react-leaflet 메이저가 5인지 재확인.

- [ ] **Step 3: 설치 확인**

Run: `node -p "require('./package.json').dependencies['react-leaflet']"`
Expected: `^5.0.0` (또는 그 이상). leaflet도 `node -p "require('./package.json').dependencies.leaflet"` → `^1.9.4`.

- [ ] **Step 4: 빌드 검증 (의존성만 추가, 코드 변경 전)**

Run: `npm run build`
Expected: `✓ Compiled successfully` (기존 동작 그대로)

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json
git commit -m "build: add leaflet + react-leaflet v5 (React 19 compatible)"
```

---

## Task 2: 투영 헬퍼 `lib/geoProject.js`

**Files:**
- Create: `lib/geoProject.js`

**Interfaces:**
- Produces:
  - `PX_W = 600`, `PX_H = 400` (상수)
  - `DEFAULT_BOUNDS = [[latS,lngW],[latN,lngE]]`
  - `pxToLatLng([x,y], bounds=DEFAULT_BOUNDS) -> [lat,lng]`
  - `latLngToPx([lat,lng], bounds=DEFAULT_BOUNDS) -> [x,y]`
  - `gridCellBounds(cell, terrain) -> [[lat,lng],[lat,lng]]` (SW, NE)
  - `pxRadiusToMeters(radiusPx, bounds=DEFAULT_BOUNDS) -> meters`

- [ ] **Step 1: 파일 작성**

`lib/geoProject.js` 신규:
```js
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

// 픽셀 반경 → 미터 (Leaflet Circle radius). 수평 m/px 기준.
export function pxRadiusToMeters(radiusPx, bounds = DEFAULT_BOUNDS) {
  const [[latS, lngW], [latN, lngE]] = bounds;
  const latMid = (latS + latN) / 2;
  const metersPerLng = Math.cos((latMid * Math.PI) / 180) * 111320;
  const widthMeters = (lngE - lngW) * metersPerLng;
  return radiusPx * (widthMeters / PX_W);
}
```

> 참고: `pxToLatLng`/`latLngToPx`는 서로의 선형 역변환이라 round-trip은 구성상 보장된다. 좌표 정합은 Task 8에서 SVG 폴백과 같은 지점에 투영되는지 육안 스폿체크로 확인한다 (이 레포는 단위 테스트 프레임워크가 없음).

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully` (아직 미사용이라 컴파일만 확인)

- [ ] **Step 3: 커밋**

```bash
git add lib/geoProject.js
git commit -m "feat: add pixel<->latlng projection helpers (geoProject)"
```

---

## Task 3: terrain에 `bounds` + deadTrees lat/lng 승격

**Files:**
- Modify: `lib/slope.js`
- Modify: `lib/apiContract.js`

**Interfaces:**
- Consumes: `pxToLatLng`, `DEFAULT_BOUNDS` (Task 2)
- Produces: `makeMockTerrain()` 반환에 `bounds: [[latS,lngW],[latN,lngE]]`, `deadTrees: [{lat,lng,pine,conf}]`

- [ ] **Step 1: slope.js에 geoProject import 추가**

`lib/slope.js` 1번 줄(`import { DEFAULT_GEO_CONSTS } from './apiContract';`) 다음에 추가:
```js
import { pxToLatLng, DEFAULT_BOUNDS } from './geoProject';
```

- [ ] **Step 2: DEAD_TREES를 lat/lng로 승격**

기존 (`lib/slope.js` 10-13행):
```js
// 고사목 마커 (현 mock=픽셀좌표 / 실연동 시 terrain.deadTrees 의 lat,lng 사용)
export const DEAD_TREES = [
  [252, 168], [284, 184], [310, 158], [268, 212], [324, 202], [298, 238], [260, 196],
];
```
변경 (기존 픽셀 7점을 lat/lng로 투영, pine/conf 부여 — 7주 중 3주 재선충 의심):
```js
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
```

- [ ] **Step 3: makeMockTerrain에 bounds 추가**

기존 (`lib/slope.js` `makeMockTerrain` 반환):
```js
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
```
변경 (`bounds` 한 줄 추가):
```js
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
```

- [ ] **Step 4: apiContract GEO_TERRAIN_KEYS에 bounds 추가**

기존 (`lib/apiContract.js` 102-110행 배열):
```js
export const GEO_TERRAIN_KEYS = [
  'grid',          // [{ c, r, slope }] 경사 격자 (GEE 실측) — 핵심
  'cols', 'rows',  // 격자 차원
  'parcelPolygon', // [[x,y]...] 필지 경계 (현 mock=픽셀좌표 / 실연동 시 Leaflet 레이어가 lat,lng 투영)
  'parcelCenter',  // [x, y]
  'parcelAreaHa',  // number — 필지 면적(ha)
  'deadTrees',     // [{ lat, lng, pine, conf }] 고사목 (재선충 의심 pine=true) — Leaflet 레이어용
  'consts',        // DEFAULT_GEO_CONSTS 형태 (KFRI 상수 + 법정 한도)
];
```
변경 (`bounds` 항목 추가):
```js
export const GEO_TERRAIN_KEYS = [
  'grid',          // [{ c, r, slope }] 경사 격자 (GEE 실측) — 핵심
  'cols', 'rows',  // 격자 차원
  'parcelPolygon', // [[x,y]...] 필지 경계 (픽셀좌표 / Leaflet이 bounds로 lat,lng 투영)
  'parcelCenter',  // [x, y]
  'parcelAreaHa',  // number — 필지 면적(ha)
  'bounds',        // [[latS,lngW],[latN,lngE]] 픽셀영역 외접 bbox — Leaflet 투영 앵커
  'deadTrees',     // [{ lat, lng, pine, conf }] 고사목 (재선충 의심 pine=true) — Leaflet 레이어용
  'consts',        // DEFAULT_GEO_CONSTS 형태 (KFRI 상수 + 법정 한도)
];
```

- [ ] **Step 5: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`. (computeStats는 deadTrees/bounds를 읽지 않으므로 영향 없음 — Task 8에서 Y=646 불변 확인)

- [ ] **Step 6: 커밋**

```bash
git add lib/slope.js lib/apiContract.js
git commit -m "feat: add geo bounds anchor and promote deadTrees to lat/lng"
```

---

## Task 4: SVG 폴백(MapView)의 deadTrees 역투영

**Files:**
- Modify: `components/map/MapView.jsx`

**Interfaces:**
- Consumes: `latLngToPx`, `DEFAULT_BOUNDS` (Task 2), 새 `deadTrees:[{lat,lng,pine,conf}]` (Task 3)

- [ ] **Step 1: latLngToPx import 추가**

기존 (`components/map/MapView.jsx` 4행):
```js
import { slopeColor, makeMockTerrain } from '@/lib/slope';
```
변경:
```js
import { slopeColor, makeMockTerrain } from '@/lib/slope';
import { latLngToPx, DEFAULT_BOUNDS } from '@/lib/geoProject';
```

- [ ] **Step 2: deadTrees 렌더를 lat/lng 역투영으로 교체**

기존 (`components/map/MapView.jsx` 114-119행):
```jsx
      {/* Dead tree markers */}
      <g>
        {(terrain.deadTrees ?? []).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.4" fill="#FF334B" stroke="#fff" strokeWidth="1" />
        ))}
      </g>
```
변경 (객체 형태를 `latLngToPx`로 픽셀 복원, pine 색 구분):
```jsx
      {/* Dead tree markers — terrain.deadTrees={lat,lng,pine,conf} 를 픽셀로 역투영 */}
      <g>
        {(terrain.deadTrees ?? []).map((d, i) => {
          const [x, y] = latLngToPx([d.lat, d.lng], terrain.bounds ?? DEFAULT_BOUNDS);
          return <circle key={i} cx={x} cy={y} r="3.4" fill={d.pine ? '#FF334B' : '#F59E0B'} stroke="#fff" strokeWidth="1" />;
        })}
      </g>
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: 커밋**

```bash
git add components/map/MapView.jsx
git commit -m "feat: reverse-project latlng deadTrees in SVG fallback view"
```

---

## Task 5: `LeafletMapView.jsx` — react-leaflet 실지도

**Files:**
- Create: `components/map/LeafletMapView.jsx`

**Interfaces:**
- Consumes: `slopeColor`, `makeMockTerrain` (slope.js); `pxToLatLng`, `latLngToPx`, `pxRadiusToMeters`, `DEFAULT_BOUNDS`, `PX_W`, `PX_H` (geoProject)
- Produces: `default export LeafletMapView({ radius, slopeLimit, terrain, onReady, onOffline })`
  - `onReady()` — 첫 타일 로드 시 호출
  - `onOffline()` — 타일 다수 실패 또는 3.5초 타임아웃 시 호출

- [ ] **Step 1: 파일 작성**

`components/map/LeafletMapView.jsx` 신규:
```jsx
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
            load: () => { loadedRef.current = true; onReady?.(); },
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
```

> 컨트롤 설계 메모: `zoomControl={false}` + 휠줌/드래그팬만 둬서 MapPane의 기존 오버레이(좌상단 범례·우상단 배지·하단 통계바)와 겹치지 않게 한다. `isolate`로 Leaflet 내부 z-index(컨트롤 1000 등)를 이 래퍼 stacking context에 가둬 MapPane 오버레이가 항상 위에 그려지게 한다.

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`. (이 모듈은 Task 6에서 `ssr:false` dynamic으로만 로드되므로 SSR 평가 안 됨)

- [ ] **Step 3: 커밋**

```bash
git add components/map/LeafletMapView.jsx
git commit -m "feat: add Leaflet real-map view (Esri imagery + hillshade + overlays)"
```

---

## Task 6: `MapCanvas.jsx` — dynamic 래퍼 + 폴백

**Files:**
- Create: `components/map/MapCanvas.jsx`

**Interfaces:**
- Consumes: `LeafletMapView` (Task 5, dynamic), `MapView` (기존 SVG 폴백)
- Produces: `default export MapCanvas(props)` — props를 두 뷰에 그대로 전달. props에는 `radius, slopeLimit, terrain` (Leaflet용) + `hover, setHover, avgSlope, maxSlopeInRadius` (SVG 폴백용)가 모두 들어온다.

- [ ] **Step 1: 파일 작성**

`components/map/MapCanvas.jsx` 신규:
```jsx
'use client';
import 'leaflet/dist/leaflet.css';
import { Component, useState } from 'react';
import dynamic from 'next/dynamic';
import MapView from './MapView';

// react-leaflet은 window 의존 → 클라이언트에서만 로드 (Next 16 규약: ssr:false는 client comp에서).
const LeafletMapView = dynamic(() => import('./LeafletMapView'), { ssr: false });

// Leaflet import/마운트 예외 → SVG 폴백.
class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function MapCanvas(props) {
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);

  // 타일 실패/타임아웃 → 영구 SVG 폴백.
  if (offline) return <MapView {...props} />;

  return (
    <div className="absolute inset-0">
      {/* 첫 타일 로드 전까지 SVG를 뒤에 깔아 빈 화면 방지 */}
      {!ready && <MapView {...props} />}
      <MapErrorBoundary fallback={<MapView {...props} />}>
        <LeafletMapView {...props} onReady={() => setReady(true)} onOffline={() => setOffline(true)} />
      </MapErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: 커밋**

```bash
git add components/map/MapCanvas.jsx
git commit -m "feat: add MapCanvas (dynamic leaflet + SVG offline/error fallback)"
```

---

## Task 7: MapPane에서 MapCanvas로 교체

**Files:**
- Modify: `components/map/MapPane.jsx`

**Interfaces:**
- Consumes: `MapCanvas` (Task 6), `MapLegend` (기존 named export)

- [ ] **Step 1: import 교체**

기존 (`components/map/MapPane.jsx` 5행):
```js
import MapView, { MapLegend } from './MapView';
```
변경 (MapLegend는 그대로 named import, 지도 본체는 MapCanvas):
```js
import { MapLegend } from './MapView';
import MapCanvas from './MapCanvas';
```

- [ ] **Step 2: MapView 사용을 MapCanvas로 교체**

기존 (`components/map/MapPane.jsx` 131-136행):
```jsx
            <MapView
              radius={radius} slopeLimit={slopeLimit}
              hover={hover} setHover={setHover}
              avgSlope={avgSlope} maxSlopeInRadius={maxSlopeInRadius}
              terrain={terrain}
            />
```
변경 (props 동일 전달 — MapCanvas가 Leaflet/SVG 양쪽에 forward):
```jsx
            <MapCanvas
              radius={radius} slopeLimit={slopeLimit}
              hover={hover} setHover={setHover}
              avgSlope={avgSlope} maxSlopeInRadius={maxSlopeInRadius}
              terrain={terrain}
            />
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: 런타임 육안 확인 (dev)**

Run: `npm run dev` (포트 3000)
브라우저에서 페르소나 선택 → 지도 패널 확인:
- Esri 위성 + hillshade 위에 경사 격자(반투명)·파란 필지·점선 반경 원·고사목 점이 뜬다
- 좌상단 범례 / 우상단 적합·부적합 배지 / 하단 통계바가 지도 위에 정상 표시(가려지지 않음)
- 반경/경사 슬라이더 조작 시 반경 원·제한구역(빨강)이 실시간 갱신
- 지도 위 마우스 이동 시 경사 readout 툴팁 표시
확인 후 dev 서버 종료.

- [ ] **Step 5: 커밋**

```bash
git add components/map/MapPane.jsx
git commit -m "feat: wire MapPane to MapCanvas (Leaflet primary, SVG fallback)"
```

---

## Task 8: 통합 검증

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 빌드**

Run: `npm run build`
Expected: `✓ Compiled successfully` + 라우트 `ƒ /api/agent`, `ƒ /api/geo`, `ƒ /api/report`

- [ ] **Step 2: geo 라우트가 bounds + lat/lng deadTrees 반환 확인**

서버 기동(`npm run start -- -p 3940`) 후 별도 셸:
```bash
echo "== bounds =="; curl -s "http://localhost:3940/api/geo?parcelId=test" | grep -ao '"bounds":\[\[[0-9.]*,[0-9.]*\]'
echo "== deadTree[0] lat =="; curl -s "http://localhost:3940/api/geo?parcelId=test" | grep -ao '"lat":[0-9.]*' | head -1
```
Expected:
```
== bounds ==
"bounds":[[35.33,127.545]
== deadTree[0] lat ==
"lat":35.34...   (35.330~35.342 범위의 값)
```

- [ ] **Step 3: computeStats 불변 확인 (kpi 카드 Y=646)**

```bash
cd /tmp && printf '{"query":"수확 시뮬 지표","persona":"owner"}' > k.json
curl -s -N -X POST http://localhost:3940/api/agent -H "Content-Type: application/json" --data-binary @k.json --max-time 12 | grep -ao '"value":"646"'
```
Expected: `"value":"646"` (Task 3 변경이 computeStats에 영향 없음을 확인)

- [ ] **Step 4: 오프라인 폴백 육안 확인**

`npm run dev` 기동 → 브라우저 DevTools Network 탭에서 `arcgisonline.com` 도메인 차단(또는 Offline 모드) → 지도 패널 새로고침 → 약 3.5초 후 SVG 목업 지도로 폴백되는지 확인(격자·필지·반경·고사목 SVG 렌더, 화면 안 비움). 차단 해제 후 새로고침 → Leaflet 실지도 복귀.

- [ ] **Step 5: 좌표 정합 스폿체크**

온라인 Leaflet 뷰와 오프라인 SVG 뷰에서 **고사목 점·필지 외곽·반경 원 중심**이 같은 상대 위치에 오는지 비교 확인(필지 모양이 두 뷰에서 동일해야 함). 어긋나면 `geoProject`의 y 반전 또는 bounds 순서를 재확인.

- [ ] **Step 6: 서버 종료**

서버 프로세스 종료(포트 3940/3000).

---

## Self-Review (작성자 체크 완료)

- **Spec 커버리지:**
  - §2 핵심 결정(Esri 단독/hillshade, 온라인+SVG폴백, 픽셀유지+투영, MapView 폴백 보존) → Task 5·6 반영.
  - §3 아키텍처(MapCanvas/LeafletMapView/MapView/geoProject) → Task 2·5·6·7.
  - §4 투영 계약(pxToLatLng/latLngToPx/gridCellBounds/pxRadiusToMeters, bounds) → Task 2·3.
  - §5 deadTrees lat/lng 승격 + SVG 역투영 단일출처 → Task 3·4.
  - §6 레이어(베이스/hillshade/격자/제한/필지/반경/고사목/hover) → Task 5. (범례·배지·통계바는 MapPane 기존 오버레이 유지 — Task 7 육안 확인)
  - §7 오프라인/에러 폴백(tileerror·타임아웃·ErrorBoundary) → Task 5·6.
  - §8 의존성·SSR(react-leaflet v5, dynamic ssr:false) → Task 1·6.
  - §12 검증(build·온라인/오프라인 스모크·정합) → Task 7·8.
- **플레이스홀더:** 없음 (모든 코드 step에 전체 코드/명령/기대출력 포함).
- **타입 일관성:** `pxToLatLng`/`latLngToPx([x,y]|[lat,lng], bounds)`, `pxRadiusToMeters(radiusPx, bounds)`, `DEFAULT_BOUNDS`, `PX_W/PX_H`, `onReady`/`onOffline` 콜백, deadTrees `{lat,lng,pine,conf}` — Task 2/3/4/5/6 간 일치 확인.
- **스코프 메모:** §6의 `gridCellBounds`는 격자를 SVGOverlay로 렌더하는 채택안에선 직접 쓰이지 않지만, 계약 완결성·후속(셀 단위 네이티브 레이어 전환)을 위해 geoProject에 유지한다.
- **컨트롤 설계 정정:** spec §6의 `L.control.scale`은 MapPane 하단 통계바와 겹쳐 생략하고, 휠줌/드래그팬으로 대체(plan Task 5 메모). 기능 손실 없음.
