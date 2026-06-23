"""
Forest Compass — Python 백엔드 (FastAPI)

엔드포인트:
  POST /agent                   — Claude API SSE 스트리밍 에이전트
  POST /geo/analyze             — 경사도 격자 + KFRI 상수
  POST /knowledge/search        — 법령 RAG (현재: 내장 KB)
  POST /wood/verify             — 수피 이미지 판별 (현재: mock)
  POST /report/forest-temp-use  — HWPX 신고서 생성

환경변수:
  ANTHROPIC_API_KEY   Claude API 키 (없으면 /agent가 mock 폴백)
  GEO_BACKEND_URL     외부 GEE 서버 (없으면 내장 계산 사용)
"""

import io
import os
import re
import json
import math
import asyncio
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv 없어도 동작 (환경변수 직접 설정 시)
from typing import List, Dict, Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fill_report import fill_hwpx, build_token_map
from generate_pdf import generate_report_pdf
from geo_api import lookup_land

TEMPLATE_DIR = Path(__file__).parent / "templates"
TEMPLATE_FILE = TEMPLATE_DIR / "forest_temp_use.hwpx"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not TEMPLATE_FILE.exists():
        print(f"[Warning] HWPX 템플릿 파일이 없습니다: {TEMPLATE_FILE}")
        print("  → /report 엔드포인트가 500을 반환합니다. 템플릿을 배치해 주세요.")
    api_key = os.environ.get("GROQ_API_KEY")
    mode = "Groq API" if api_key else "키 없음 (GROQ_API_KEY 미설정)"
    print(f"[Info] /agent 모드: {mode}")
    yield


app = FastAPI(title="NIFOS 산림 지능형 에이전트 백엔드", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# 공통 지오메트리 / 상수 (slope.js 와 동기화)
# ─────────────────────────────────────────────────────────────

PARCEL_PTS = [
    [228, 132], [262, 116], [306, 122], [348, 144], [372, 178], [378, 218],
    [358, 252], [326, 274], [290, 282], [256, 274], [228, 256], [212, 226], [208, 188], [216, 156],
]
PARCEL_CENTER = [294, 200]
DEFAULT_BOUNDS = [[35.330, 127.545], [35.342, 127.567]]
DEFAULT_GEO_CONSTS = {
    "Vunit": 0.46,
    "treeDensity": 820,
    "robotFactor": 1.18,
    "carbonPerM3": 0.92,
    "carbonKRWperT": 30000,
    "legalSlopeLimit": 25,
}


def px_to_latlng(pt, bounds=DEFAULT_BOUNDS):
    x, y = pt
    lat_s, lng_w = bounds[0]
    lat_n, lng_e = bounds[1]
    lng = lng_w + (x / 600) * (lng_e - lng_w)
    lat = lat_n - (y / 400) * (lat_n - lat_s)
    return [lat, lng]


DEAD_TREE_PX = [
    [252, 168], [284, 184], [310, 158], [268, 212], [324, 202], [298, 238], [260, 196],
]
DEAD_TREE_META = [
    {"pine": True, "conf": 0.94}, {"pine": False, "conf": 0.88}, {"pine": True, "conf": 0.91},
    {"pine": False, "conf": 0.79}, {"pine": True, "conf": 0.86}, {"pine": False, "conf": 0.83},
    {"pine": False, "conf": 0.80},
]
DEAD_TREES = [
    {"lat": px_to_latlng(pt)[0], "lng": px_to_latlng(pt)[1], **DEAD_TREE_META[i]}
    for i, pt in enumerate(DEAD_TREE_PX)
]


def build_slope_grid(cols: int = 60, rows: int = 40) -> list:
    cells = []
    for r in range(rows):
        for c in range(cols):
            x = c / cols
            y = r / rows
            v = (
                16
                + 9 * math.sin(x * 5.7 + y * 3.1)
                + 7 * math.cos(x * 3.4 - y * 4.8 + 1.1)
                + 4 * math.sin((x + y) * 8.2 + 2.3)
                + 6 * (x - 0.4)
                - 3 * (y - 0.5)
            )
            cells.append({"c": c, "r": r, "slope": max(2.0, min(40.0, v))})
    return cells


def point_in_poly(pt, poly) -> bool:
    x, y = pt
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def compute_slope_stats(radius, slope_limit, robot_on, grid, cols, rows, parcel_polygon, parcel_center, consts):
    """slope.js computeStats() 와 동일한 집계 로직."""
    cell_w = 600 / cols
    cell_h = 400 / rows
    radius_px = 30 + ((radius - 100) / 1400) * 190
    inside = 0
    sum_slope = 0.0
    max_s = 0.0
    over = 0

    for cell in grid:
        cx = cell["c"] * cell_w + cell_w / 2
        cy = cell["r"] * cell_h + cell_h / 2
        in_radius = math.sqrt((cx - parcel_center[0]) ** 2 + (cy - parcel_center[1]) ** 2) <= radius_px
        if in_radius and point_in_poly([cx, cy], parcel_polygon):
            inside += 1
            sum_slope += cell["slope"]
            if cell["slope"] > max_s:
                max_s = cell["slope"]
            if cell["slope"] > slope_limit:
                over += 1

    avg_slope = sum_slope / inside if inside else 18.7
    cell_area_ha = (cell_w * cell_h) * (radius / 500) ** 2 / 14000
    area_ha = max(0.4, inside * cell_area_ha)
    n_tree = round(area_ha * consts["treeDensity"])
    s_robot = consts["robotFactor"] if robot_on else 1.0
    over_ratio = over / inside if inside else 0.0
    Y = round(n_tree * consts["Vunit"] * s_robot * math.cos(avg_slope * math.pi / 180))
    carbon_krw = round(Y * consts["carbonPerM3"] * consts["carbonKRWperT"])
    compliant_prob = max(0.0, min(98.0, 100 - (max_s - slope_limit) * 8 - over_ratio * 120))

    return {
        "avgSlope": round(avg_slope, 1),
        "maxSlopeInRadius": round(max_s, 1),
        "Ntree": n_tree,
        "Y": Y,
        "carbonKRW": carbon_krw,
        "compliantProb": round(compliant_prob, 1),
        "compliant": compliant_prob >= 70,
        "overRatio": round(over_ratio, 3),
    }


def build_bypass_proposals(sim: dict, grid: list) -> list:
    """slope.js buildBypassProposals() 와 동일 로직."""
    radius = sim.get("radius", 500)
    slope_limit = sim.get("slopeLimit", 25)
    robot_on = sim.get("robotOn", True)
    legal = DEFAULT_GEO_CONSTS["legalSlopeLimit"]
    consts = DEFAULT_GEO_CONSTS
    proposals = []

    def stats(r, sl):
        return compute_slope_stats(r, sl, robot_on, grid, 60, 40, PARCEL_PTS, PARCEL_CENTER, consts)

    current = stats(radius, slope_limit)
    if current["compliant"]:
        return proposals

    # 1) 경사 상한 상향
    if slope_limit < legal:
        for L in range(slope_limit + 1, legal + 1):
            after = stats(radius, L)
            if after["compliant"]:
                proposals.append({
                    "id": "slope", "kind": "slope", "title": "경사 작업범위 상향",
                    "desc": f"상한을 {slope_limit}° → {L}°로 조정 (법정 한도 {legal}° 이내)",
                    "apply": {"slopeLimit": L},
                    "prob": after["compliantProb"],
                    "Y": after["Y"],
                })
                break

    # 2) 반경 축소
    r = 1500
    while r >= 100:
        after = stats(r, slope_limit)
        if after["compliant"]:
            if r < radius:
                proposals.append({
                    "id": "radius", "kind": "radius", "title": "벌채 반경 축소",
                    "desc": f"반경을 {radius}m → {r}m로 축소해 위험 사면(>{slope_limit}°) 제외",
                    "apply": {"radius": r},
                    "prob": after["compliantProb"],
                    "Y": after["Y"],
                })
            break
        r -= 20

    return proposals


# ─────────────────────────────────────────────────────────────
# 1. AI 에이전트 (POST /agent)
# ─────────────────────────────────────────────────────────────

PERSONA_CONTEXTS = {
    "contractor": (
        "사용자는 현장 벌채 대행사의 실무 작업자입니다. "
        "장비 투입 효율, 작업 동선, 경사도 기준 위반 리스크를 우선해 실무 중심으로 간결하게 답하세요."
    ),
    "heir": (
        "사용자는 가업을 이어받은 영세 임업인(임업 후계자)입니다. "
        "보조금·지원 제도, 수익성, 장기 경영 관점에서 쉬운 용어로 답하세요."
    ),
    "owner": (
        "사용자는 개인 사유림 산주입니다. "
        "법적 규제 적합 여부를 스스로 검토하고 신고서를 직접 작성하려 합니다. "
        "절차와 적법성 위주로 친절히 안내하세요."
    ),
}

FOREST_SYSTEM = (
    "당신은 산림청 NIFOS(국립산림과학원) 기반의 산림 지능형 에이전트 Forest Compass입니다.\n"
    "산지관리법, 산림자원법, 소나무재선충병 방제 특별법 등 관련 법령을 정확히 알고 있습니다.\n"
    "경사도·벌채량·탄소 기여액 등 수치는 반드시 아래 제공된 분석 결과를 기반으로 답변하세요.\n"
    "답변은 3~5문장 내외로 간결하게, 한국어로 작성하세요."
)

MOCK_KNOWLEDGE = {
    "legalSlopeLimit": 25,
    "citations": [
        {
            "law": "산지관리법 시행령",
            "article": "제20조의2제2항",
            "text": "산지일시사용신고에 따른 산지의 평균경사도는 25도 이하이어야 한다. 다만, 산불피해지 고사목 벌채의 경우 완화 적용 기준을 둘 수 있다.",
            "url": "https://www.law.go.kr/",
        },
        {
            "law": "소나무재선충병 방제 특별법",
            "article": "제11조",
            "text": "감염목 및 감염 의심목은 벌채 후 즉시 훈증 처리하여야 한다.",
            "url": "",
        },
    ],
    "matches": [
        {
            "title": "산림청 인허가 실무 매뉴얼 (2025)",
            "snippet": "산림재해 복구 목적 벌채 시 지자체 조례에 따라 경사 25° 이하 기준이 적용되며, 시·군·구청장의 사전 승인이 필수입니다.",
            "source": "산림청 실무 지침",
        }
    ],
}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def sse_generator_claude(query: str, persona: str, parcel: str, sim: dict):
    """Groq API 스트리밍 에이전트."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        yield _sse("error", {"message": "GROQ_API_KEY가 설정되지 않았습니다."})
        yield _sse("done", {})
        return

    try:
        from groq import AsyncGroq
    except ImportError:
        yield _sse("error", {"message": "groq 패키지가 설치되지 않았습니다."})
        yield _sse("done", {})
        return

    persona_ctx = PERSONA_CONTEXTS.get(persona, PERSONA_CONTEXTS["owner"])
    system_prompt = (
        f"{FOREST_SYSTEM}\n\n"
        f"{persona_ctx}\n\n"
        f"## 현재 필지\n"
        f"- 필지: {parcel or '미지정'}\n"
        f"- 반경 {sim.get('radius', 500)}m / 경사 상한 {sim.get('slopeLimit', 25)}° / "
        f"로봇장비: {'투입' if sim.get('robotOn', True) else '미투입'}"
    )

    client = AsyncGroq(api_key=api_key)
    try:
        stream = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ],
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield _sse("answer", {"delta": delta})
    except Exception as e:
        yield _sse("error", {"message": f"Groq API 오류: {str(e)}"})

    yield _sse("done", {})


class AgentRequest(BaseModel):
    query: str
    persona: Optional[str] = "owner"
    parcelId: Optional[str] = None
    sim: Optional[Dict[str, Any]] = None


@app.post("/agent")
async def chat_agent(payload: AgentRequest):
    p = payload.model_dump()
    sim = p.get("sim") or {"radius": 500, "slopeLimit": 25, "robotOn": True}
    gen = sse_generator_claude(
        p.get("query", ""), p.get("persona", "owner"),
        p.get("parcelId", ""), sim,
    )
    return StreamingResponse(gen, media_type="text/event-stream")


# ─────────────────────────────────────────────────────────────
# 2. 지형 분석 (POST /geo/analyze)  — 실제 SRTM 고도 기반
# ─────────────────────────────────────────────────────────────

COLS, ROWS = 30, 20          # grid 크기 (600 points — API 1회 호출)
SPAN_LAT   = 0.018           # 위도 범위 ≈ 2 km
SPAN_LNG   = 0.024           # 경도 범위 ≈ 2 km
PX_W, PX_H = 600, 400        # 프론트 SVG 해상도

OPEN_ELEV_URL = "https://api.open-elevation.com/api/v1/lookup"


async def fetch_elevation_grid(lat: float, lng: float) -> list[list[float]]:
    """Open-Elevation(SRTM 30m)으로 ROWS×COLS 고도 행렬을 가져온다."""
    lat_min = lat - SPAN_LAT / 2
    lng_min = lng - SPAN_LNG / 2
    lat_step = SPAN_LAT / ROWS
    lng_step = SPAN_LNG / COLS

    locations = [
        {"latitude": round(lat_min + r * lat_step, 6),
         "longitude": round(lng_min + c * lng_step, 6)}
        for r in range(ROWS) for c in range(COLS)
    ]
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await client.post(OPEN_ELEV_URL, json={"locations": locations})
        resp.raise_for_status()
        results = resp.json()["results"]

    grid = [[0.0] * COLS for _ in range(ROWS)]
    for i, pt in enumerate(results):
        grid[i // COLS][i % COLS] = float(pt.get("elevation") or 0)
    return grid


def elevations_to_slope_grid(elevations: list[list[float]], lat: float) -> list[dict]:
    """고도 행렬 → 각 셀의 경사도(°) 계산."""
    lat_m = SPAN_LAT * 111_320                          # 남북 거리(m)
    lng_m = SPAN_LNG * 111_320 * math.cos(math.radians(lat))  # 동서 거리(m)
    cw_m  = lng_m / COLS
    ch_m  = lat_m / ROWS

    grid = []
    for r in range(ROWS):
        for c in range(COLS):
            # 중앙 차분 (경계는 단방향)
            dz_x = ((elevations[r][min(c+1, COLS-1)] - elevations[r][max(c-1, 0)])
                    / (2 * cw_m if 0 < c < COLS-1 else cw_m))
            dz_y = ((elevations[min(r+1, ROWS-1)][c] - elevations[max(r-1, 0)][c])
                    / (2 * ch_m if 0 < r < ROWS-1 else ch_m))
            slope = math.degrees(math.atan(math.sqrt(dz_x**2 + dz_y**2)))
            grid.append({"c": c, "r": r, "slope": round(max(0.5, min(70.0, slope)), 1)})
    return grid


def make_parcel_polygon_px():
    """픽셀 좌표계에서 중심 주변 단순 8각형 필지 경계."""
    cx, cy = PX_W / 2, PX_H / 2
    r = min(PX_W, PX_H) * 0.28
    pts = []
    for i in range(8):
        a = math.radians(i * 45 - 22.5)
        pts.append([round(cx + r * math.cos(a)), round(cy + r * math.sin(a))])
    return pts


# 산지구분별 수목 상수 (KFRI 기준값 근사)
CONSTS_BY_SITE = {
    "임업용산지": {"treeDensity": 900, "Vunit": 0.52},
    "공익용산지": {"treeDensity": 620, "Vunit": 0.38},
    "준보전산지": {"treeDensity": 700, "Vunit": 0.43},
}


def build_consts(site_class: str, area_ha: Optional[float]) -> dict:
    overrides = CONSTS_BY_SITE.get(site_class, {})
    consts = {**DEFAULT_GEO_CONSTS, **overrides}
    if area_ha:
        consts["parcelAreaHa"] = round(area_ha, 4)
    return consts


class GeoRequest(BaseModel):
    lat: float
    lng: float
    parcelAreaHa: Optional[float] = None
    siteClassification: Optional[str] = None   # 임업용산지 | 공익용산지 | 준보전산지


@app.post("/geo/analyze")
async def analyze_geo(payload: GeoRequest):
    lat, lng = payload.lat, payload.lng
    lat_min = lat - SPAN_LAT / 2
    lng_min = lng - SPAN_LNG / 2

    try:
        elevations = await fetch_elevation_grid(lat, lng)
        slope_grid = elevations_to_slope_grid(elevations, lat)
        source = "srtm"
    except Exception as e:
        print(f"[Warn] Open-Elevation 실패, mock 폴백: {e}")
        slope_grid = build_slope_grid(COLS, ROWS)
        source = "mock"

    bounds = [
        [lat_min, lng_min],
        [lat_min + SPAN_LAT, lng_min + SPAN_LNG],
    ]

    return {
        "grid":          slope_grid,
        "cols":          COLS,
        "rows":          ROWS,
        "parcelPolygon": make_parcel_polygon_px(),
        "parcelCenter":  [PX_W / 2, PX_H / 2],
        "parcelAreaHa":  payload.parcelAreaHa,
        "deadTrees":     [],
        "bounds":        bounds,
        "consts":        build_consts(payload.siteClassification or "", payload.parcelAreaHa),
        "source":        source,
    }


# ─────────────────────────────────────────────────────────────
# 3. 지식 검색 (POST /knowledge/search)
# ─────────────────────────────────────────────────────────────

class KnowledgeRequest(BaseModel):
    query: str
    region: Optional[str] = None
    topic: Optional[str] = None


@app.post("/knowledge/search")
async def search_knowledge(payload: KnowledgeRequest):
    return MOCK_KNOWLEDGE


# ─────────────────────────────────────────────────────────────
# 4. 수피 이미지 판별 (POST /wood/verify)
# ─────────────────────────────────────────────────────────────

class WoodVerifyRequest(BaseModel):
    parcelId: str
    imageRefs: List[str]


@app.post("/wood/verify")
async def verify_wood(payload: WoodVerifyRequest):
    return {
        "species": [
            {"name": "소나무", "ratio": 0.73},
            {"name": "신갈나무", "ratio": 0.19},
            {"name": "졸참나무", "ratio": 0.08},
        ],
        "deadTreeCount": 41,
        "pineWiltSuspect": 7,
        "confidence": 0.914,
    }


# ─────────────────────────────────────────────────────────────
# 5. 신고서 생성 (POST /report/forest-temp-use)
# ─────────────────────────────────────────────────────────────

class PeriodItem(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None


class Period(BaseModel):
    original: Optional[PeriodItem] = None
    changed: Optional[PeriodItem] = None


class Applicant(BaseModel):
    name: str
    birth: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None


class SiteDetail(BaseModel):
    location: str
    parcel: str
    landCategory: Optional[str] = None
    areaByType: Optional[Dict[str, float]] = None
    areaTotal: float
    tempUseAreaSqm: float


class Changes(BaseModel):
    before: Optional[str] = None
    after: Optional[str] = None
    reason: Optional[str] = None


class ReportPayload(BaseModel):
    formCode: str
    declarationType: str
    outputs: List[str]
    applicant: Applicant
    siteDetails: List[SiteDetail]
    purpose: str
    landowner: Optional[Dict[str, Any]] = None
    period: Optional[Period] = None
    changes: Optional[Changes] = None
    declaredDate: Optional[str] = None
    recipient: Optional[str] = None
    aiReview: Optional[Dict[str, Any]] = None
    reportId: Optional[str] = None  # BFF가 주입하는 파일명용 ID


@app.post("/report/forest-temp-use")
async def generate_report(payload: ReportPayload):
    p = payload.model_dump()

    missing = []
    if not p.get("applicant", {}).get("name"):
        missing.append("applicant.name")
    if not p.get("siteDetails"):
        missing.append("siteDetails[]")
    if missing:
        raise HTTPException(status_code=422, detail={"error": "MISSING_FIELDS", "missing": missing})

    if not TEMPLATE_FILE.exists():
        raise HTTPException(status_code=500, detail={"error": "TEMPLATE_NOT_FOUND"})

    try:
        from urllib.parse import quote
        rid = p.get("reportId", "report")
        pdf_bytes = generate_report_pdf(p)
        filename = quote(f"산지일시사용신고서_{rid}.pdf")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "GENERATION_FAILED", "detail": str(e)})


# ─────────────────────────────────────────────────────────────
# 지리정보 조회 (VWORLD 공공API)
# ─────────────────────────────────────────────────────────────

class LandQuery(BaseModel):
    address: str   # 예: "경기도 가평군 북면 산100"


@app.post("/land/info")
async def land_info(q: LandQuery):
    """
    주소/지번 문자열 → 필지 기본정보 + 산지구분 반환.

    응답:
      pnu, address, jibun, x, y,
      landCategory (지목), areaSqm (면적),
      siteClassification (임업용산지|공익용산지|준보전산지|미분류),
      regulations (토지이용규제 목록)
    """
    if not os.environ.get("VWORLD_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail={"error": "VWORLD_API_KEY_MISSING",
                    "message": "VWORLD_API_KEY 환경변수를 설정해 주세요."},
        )
    try:
        result = await lookup_land(q.address)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": str(e)})
    except Exception as e:
        raise HTTPException(status_code=502, detail={"error": "API_ERROR", "message": str(e)})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
