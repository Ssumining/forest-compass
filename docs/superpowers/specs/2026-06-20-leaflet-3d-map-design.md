# Leaflet 실지도 + 경사 컴플라이언스 오버레이 (설계)

- 날짜: 2026-06-20
- 대상: `forest-compass/` (Next.js 16)
- 기능명세 근거: 명세 3.3 — "3D GIS 경사도 컴플라이언스 지도 (GEE 10m 격자 분석)"
- 배경: 현재 지도(`components/map/MapView.jsx`)는 600×400 픽셀 SVG 목업. 이를
  실제 Leaflet 지도로 교체하되, 검증된 시뮬레이터 연산은 보존한다.

## 1. 목표

SVG 목업을 **실제 Leaflet 2D 지도 + hillshade 음영**으로 교체한다. 위성 베이스
타일 위에 경사 격자·필지·벌채 반경·고사목을 지리좌표로 투영해 올린다.

핵심 제약: `lib/slope.js`의 `computeStats`와 What-If 시뮬레이터·KPI 카드는
이미 검증되어 있고 **전부 픽셀 공간(600×400)에서 동작**한다. 이 연산을 한 줄도
바꾸지 않고, **표현 계층에서만** 픽셀↔지리좌표 투영을 추가한다.

### 비목표 (YAGNI)
- 실제 3D 틸트 / deck.gl / MapLibre GPU terrain (→ 2D Leaflet + hillshade로 입체감)
- `computeStats`·시뮬레이터·KPI 연산의 지오좌표 마이그레이션 (픽셀 유지)
- 다중 필지, 타일 캐싱/PWA, 오프라인 타일 번들
- `MapPane`의 시뮬레이터/통계카드/수확량 모델 변경

## 2. 핵심 결정 (브레인스토밍 합의)

| 결정 | 채택 | 이유 |
|---|---|---|
| 베이스맵 | **Esri World Imagery 단독** (+ Esri World_Hillshade 음영) | API 키 불필요, 시연 안정성 |
| 네트워크 폴백 | 온라인 타일 + **오프라인 시 SVG 폴백** | 시연 중 인터넷 끊겨도 화면 안 비움 |
| 3D 표현 | **2D Leaflet + hillshade 음영** | 안정·가볍·react-leaflet 계약과 정합 |
| 좌표 정합 | **픽셀 연산 유지 + 투영 레이어 추가** | 검증된 시뮬레이터·카드 0 리스크 |

## 3. 아키텍처 & 컴포넌트 경계

```
MapPane.jsx (변경 최소 — MapView 직접 호출 → MapCanvas 호출로 1줄)
  └─ MapCanvas.jsx          ← 신규: online Leaflet vs offline SVG 선택자 + dynamic 래퍼
       ├─ LeafletMapView.jsx ← 신규(ssr:false): react-leaflet 실지도 (primary)
       └─ MapView.jsx        ← 기존 SVG, "오프라인 폴백" 역할로 유지 (삭제 안 함)
  └─ lib/geoProject.js       ← 신규: 픽셀(600×400) ↔ lat/lng 양방향 투영
```

원칙:
- `MapPane`은 `computeStats` 결과(픽셀 기반)를 그대로 자식에 내려보낸다.
- `MapCanvas`가 dynamic import(`{ ssr: false }`)와 online/offline 분기를 소유.
- `MapView.jsx`(SVG)는 **최종 안전망**으로 보존. 어떤 실패에도 빈 화면 없음.
- react-leaflet은 `window` 의존 → Next.js 16 dynamic 규약을 **구현 전**
  `node_modules/next/dist/docs/`에서 확인 (AGENTS.md 지시).

## 4. 투영 계약 (`lib/geoProject.js`)

terrain에 **지리 앵커 1필드** 추가:
```js
// makeMockTerrain() 및 백엔드 응답에 포함
bounds: [[latS, lngW], [latN, lngE]]  // 600×400 픽셀 영역의 외접 bbox
// mock: 전북 남원시 산내면 산 32-1 (지리산권) 근방 실좌표
```

헬퍼:
```js
pxToLatLng([x, y], bounds)      // 600×400 픽셀 → [lat, lng] (선형 보간)
                                //   x=0→lngW, x=600→lngE / y=0→latN, y=400→latS (y 반전)
latLngToPx([lat, lng], bounds)  // 역변환 (hover → cell 조회)
gridCellBounds(cell, terrain)   // 격자 1칸 → [[lat,lng],[lat,lng]] (Leaflet Rectangle)
pxRadiusToMeters(radiusPx, bounds) // 픽셀 반경 → 미터 (Leaflet Circle 반경)
```
- 투영은 **순수 표현 계층**. `computeStats`는 호출 안 함.
- y축: 픽셀 위(0)=북쪽 → lat 반전 매핑.

## 5. 데이터 단일 출처 — deadTrees 계약 정합

- 계약서(`apiContract.js`)는 `deadTrees: [{lat,lng,pine,conf}]`로 문서화돼 있으나
  현 mock(`slope.js DEAD_TREES`)은 픽셀 배열 `[[x,y]...]`.
- **채택**: mock `deadTrees`를 `{lat,lng,pine,conf}` 형태로 승격.
  - 기존 픽셀값을 `pxToLatLng`로 변환해 lat/lng 채움 (시각 위치 동일 유지).
  - `pine`/`conf`는 도메인 값으로 부여 (일부 재선충 의심 `pine:true`).
- SVG 폴백(`MapView`)은 lat/lng를 `latLngToPx`로 **역투영**해 기존대로 픽셀 렌더.
  → 온라인/오프라인 두 뷰가 **동일 데이터 단일 출처** 사용.
- `parcelPolygon`/`parcelCenter`는 픽셀 유지(컨트랙트 주석대로 "Leaflet이 투영").
  Leaflet 뷰에서 `pxToLatLng`로 투영, SVG는 그대로 사용.

## 6. Leaflet 렌더 레이어 (`LeafletMapView.jsx`)

레이어 스택 (아래→위):
1. **베이스 타일** — Esri World Imagery (`{z}/{y}/{x}`, 키 불필요).
2. **Hillshade 음영** — Esri World_Hillshade TileLayer, `opacity ≈ 0.35`.
3. **경사 격자 오버레이** — `grid` 각 셀을 `slopeColor`로 칠한 반투명 Rectangle.
4. **제한 구역** — `slope > slopeLimit` 셀에 빨강 빗금/반투명 빨강 강조.
5. **대상 필지** — `parcelPolygon` 투영 → Polygon (파랑 외곽선 + 반투명 채움).
6. **벌채 반경** — Circle(center=`parcelCenter` 투영, 반경=`pxRadiusToMeters`).
   슬라이더 실시간 반영.
7. **고사목 마커** — CircleMarker. `pine=true`(재선충 의심) 강조색.

기존 SVG 오버레이 패리티 (보존):
- 범례(`MapLegend` 재사용) · 컴플라이언스 배지(적합/부적합) · 하단 통계바
  (평균/최대 경사·고사목 수·EPSG 표기)
- hover readout: Leaflet `mousemove` → `latLngToPx` → cell 조회 → 좌표+경사 툴팁
- Leaflet 기본 제공: 줌/팬, `L.control.scale`(스케일바). 방위는 북 고정이라
  기존 정적 컴퍼스 마크 유지.

줌 동작: 초기 `fitBounds(terrain.bounds)`, min/max zoom 제한(필지 이탈 방지).

## 7. 오프라인/에러 폴백

- `MapCanvas`가 `offline` 상태 관리. `LeafletMapView`가 다음 중 하나면 신호:
  - `TileLayer`의 `tileerror` 누적이 임계치 초과
  - **타임아웃 가드**: 마운트 후 3초 내 `tileload` 0건
- `offline=true` → SVG `MapView` 렌더로 전환.
- `leaflet`/`react-leaflet` import/마운트 실패 → ErrorBoundary가 SVG 폴백.
- 어떤 경로에서도 화면이 비지 않음 (SVG가 최종 안전망).

## 8. 의존성 & SSR

- 추가: `leaflet`, `react-leaflet`.
  - 설치 전 Next.js 16/React 버전과 **피어 호환 확인 후 호환 버전 고정**
    (메모리 계약은 react-leaflet v4.2.1 기준이나 실제 설치 버전 확인 우선).
- Leaflet CSS import (`leaflet/dist/leaflet.css`) — `MapCanvas` 또는 `app/layout.js`.
- `LeafletMapView`는 `next/dynamic`으로 `{ ssr: false }` 로드.
- SSR/초기 페인트는 SVG 또는 로딩 placeholder → 클라이언트 마운트 시 Leaflet.

## 9. 수정/신규 파일

| 파일 | 변경 |
|---|---|
| `lib/geoProject.js` | 신규 — 투영 헬퍼 4종 |
| `lib/slope.js` | `makeMockTerrain`에 `bounds` 추가, `DEAD_TREES`를 lat/lng 형태로 승격 |
| `lib/apiContract.js` | `GEO_TERRAIN_KEYS`에 `bounds` 추가, 주석 갱신 |
| `components/map/MapCanvas.jsx` | 신규 — dynamic 래퍼 + online/offline 분기 + ErrorBoundary |
| `components/map/LeafletMapView.jsx` | 신규 — react-leaflet 실지도 |
| `components/map/MapView.jsx` | deadTrees lat/lng 역투영 처리 (폴백 유지) |
| `components/map/MapPane.jsx` | `MapView` → `MapCanvas` 호출로 교체 (최소) |
| `app/layout.js` 또는 `MapCanvas` | Leaflet CSS import |
| `package.json` | `leaflet`, `react-leaflet` 추가 |

## 10. 데이터 흐름

```
useTerrain → terrain(+bounds, latlng deadTrees)
  → MapPane (computeStats, 픽셀 — 변경 없음)
  → MapCanvas
       ├─ online  → LeafletMapView (geoProject로 투영 렌더)
       └─ offline → MapView (latLngToPx 역투영 후 SVG 렌더)
백엔드 연동 시: /geo/analyze가 bounds + latlng deadTrees 포함해 반환 (env만 전환)
```

## 11. 에러 처리

- 타일 로드 실패/네트워크 끊김 → SVG 폴백 (8·7절)
- `terrain.bounds` 누락(구버전 백엔드) → mock bounds 기본값으로 가드, 또는 SVG 폴백
- import/마운트 예외 → ErrorBoundary → SVG 폴백
- 어떤 경우에도 빈 화면 없음

## 12. 검증

- `next build` 통과 (lint 포함).
- 런타임 스모크:
  - (a) 온라인 — 타일+경사격자+필지+반경+고사목+hover 정상 렌더
  - (b) 오프라인 시뮬(타일 차단) — SVG 폴백 전환 확인
- 슬라이더 조작 시 Leaflet 반경 원·제한구역이 `computeStats`와 일치 갱신.
- 좌표 정합 스폿체크: 필지 중심/고사목이 SVG와 동일 지점에 투영.
- 브라우저 육안 확인 (권장).

## 13. 미해결/후속

- 실제 3D 틸트(MapLibre/deck.gl) — 별도 백로그
- 후속 대화 thought 블록 렌더 (기존 백로그 항목)
- bypass 카드 "지도에서 적용" → Leaflet 반경/제한구역 하이라이트 연동
- VWorld 위성(국내 공공데이터) 전환 — API 키 발급 시 심사 가점용 옵션
