"""산지 지리정보 조회 — VWORLD + 국토부 공공API 기반

흐름:
  1. address API → 법정동코드 + 좌표 획득
  2. 지번 파싱 → PNU 직접 구성 (법정동코드 + 산여부 + 본번 + 부번)
  3. ladfrlList API → 지목, 면적, 소유구분
  4. getLandUseAttr API → 토지이용규제 / 산지구분
"""
from __future__ import annotations

import os
import re
import asyncio
import httpx
from typing import Optional

VWORLD_BASE = "https://api.vworld.kr"

# VWORLD 키는 등록한 도메인으로만 동작한다. geocoder(req/address)는 Referer 헤더로,
# ned/* API는 domain 쿼리파라미터로 도메인을 검사한다.
# 키를 'localhost'로 발급했다면 기본값 그대로, 배포 도메인으로 발급했다면 VWORLD_DOMAIN을 맞춰준다.
VWORLD_DOMAIN = os.getenv("VWORLD_DOMAIN", "localhost")


def _key() -> str:
    k = os.getenv("VWORLD_API_KEY", "")
    if not k:
        raise RuntimeError("VWORLD_API_KEY 환경변수가 설정되지 않았습니다.")
    return k


def _referer() -> str:
    d = VWORLD_DOMAIN
    if not d.startswith("http"):
        d = ("http://" if d.startswith("localhost") else "https://") + d
    return d.rstrip("/") + "/"


async def _get_json(path: str, params: dict, retries: int = 3) -> dict:
    """
    VWORLD GET 호출. 등록 도메인 Referer 헤더를 붙이고,
    일시적 502/503/504 는 백오프 재시도한다.
    """
    headers = {
        "Referer": _referer(),
        "User-Agent": "forest-compass/1.0",
    }
    last_exc: Optional[Exception] = None
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        for attempt in range(retries):
            try:
                r = await client.get(f"{VWORLD_BASE}{path}", params=params)
                if r.status_code in (502, 503, 504):
                    last_exc = httpx.HTTPStatusError(
                        f"VWORLD {r.status_code}", request=r.request, response=r,
                    )
                    await asyncio.sleep(0.6 * (attempt + 1))
                    continue
                r.raise_for_status()
                return r.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as e:
                last_exc = e
                await asyncio.sleep(0.6 * (attempt + 1))
    raise last_exc or RuntimeError(f"VWORLD 호출 실패: {path}")


# ── 지번 파싱 ─────────────────────────────────────────────────────────────
def parse_jibun(jibun: str) -> tuple[int, int, int]:
    """
    지번 문자열 → (산여부, 본번, 부번)
    예) '산100' → (1, 100, 0)
        '산100-2' → (1, 100, 2)
        '200-3' → (0, 200, 3)
        '200' → (0, 200, 0)
    """
    jibun = jibun.strip()
    is_san = 1 if jibun.startswith("산") else 0
    nums = jibun.lstrip("산").strip()
    m = re.match(r"(\d+)(?:-(\d+))?", nums)
    if not m:
        raise ValueError(f"지번 파싱 실패: {jibun!r}")
    main = int(m.group(1))
    sub  = int(m.group(2)) if m.group(2) else 0
    return is_san, main, sub


def build_pnu(dong_code: str, jibun: str) -> str:
    """법정동코드(10자리) + 지번 → PNU 19자리"""
    is_san, main, sub = parse_jibun(jibun)
    return f"{dong_code}{is_san}{main:04d}{sub:04d}"


# ── 1. 주소 → 법정동코드 + 좌표 ──────────────────────────────────────────
async def get_coord_and_code(address: str) -> dict:
    """
    VWORLD address API로 주소에서 법정동코드·좌표를 가져온다.
    '경기도 가평군 북면 산100' 형태의 전체 주소에서
    지번 부분은 별도 파싱한다.
    """
    # 지번 분리: 맨 끝 토큰이 지번인지 확인
    parts  = address.strip().split()
    jibun  = parts[-1] if parts and re.search(r"\d", parts[-1]) else ""
    addr_q = " ".join(parts[:-1]) if jibun else address

    params = {
        "service":  "address",
        "request":  "getcoord",
        "version":  "2.0",
        "crs":      "epsg:4326",
        "address":  addr_q,
        "format":   "json",
        "type":     "parcel",   # 지번주소 우선
        "key":      _key(),
    }
    body = await _get_json("/req/address", params)

    if body.get("response", {}).get("status") != "OK":
        # fallback: road type
        params["type"] = "road"
        body = await _get_json("/req/address", params)

    if body.get("response", {}).get("status") != "OK":
        raise ValueError(f"주소 변환 실패: {addr_q!r}")

    resp    = body["response"]
    refined = resp.get("refined", {}).get("structure", {})
    point   = resp["result"]["point"]

    # level4LC가 19자리면 PNU 직접 포함 (지번 주소 조회 시)
    level4lc  = refined.get("level4LC", "")
    level4ac  = refined.get("level4AC", "")
    direct_pnu = level4lc if len(level4lc) == 19 else ""

    return {
        "dongCode":  level4ac,
        "directPnu": direct_pnu,   # 있으면 PNU 구성 단계 건너뜀
        "jibun":     jibun,
        "x": float(point["x"]),
        "y": float(point["y"]),
    }


# ── 2. PNU → 토지임야정보 ────────────────────────────────────────────────
async def get_land_info(pnu: str) -> dict:
    params = {
        "pnu":       pnu,
        "key":       _key(),
        "format":    "json",
        "numOfRows": 1,
        "pageNo":    1,
        "domain":    VWORLD_DOMAIN,
    }
    body = await _get_json("/ned/data/ladfrlList", params)

    # 응답 구조: body["ladfrlVOList"]["ladfrlVOList"] (중첩 동일명 키)
    outer = body.get("ladfrlVOList") or {}
    fields = outer.get("ladfrlVOList") or outer.get("field") or []
    if isinstance(fields, dict):   # 단건 시 리스트 대신 dict로 올 수 있음
        fields = [fields]
    if not fields:
        raise ValueError(f"토지임야정보 없음: pnu={pnu!r}")

    f = fields[0]
    return {
        "pnu":          f.get("pnu", pnu),
        "ldCodeNm":     f.get("ldCodeNm", ""),       # 법정동명
        "landCategory": f.get("lndcgrCodeNm", ""),   # 지목명
        "areaSqm":      float(f.get("lndpclAr", 0)), # 면적(㎡)
        "ownerType":    f.get("posesnSeCodeNm", ""),  # 소유구분
        "lastUpdated":  f.get("lastUpdtDt", ""),
    }


# ── 3. PNU → 토지이용규제 / 산지구분 ────────────────────────────────────
async def get_land_regulation(pnu: str) -> dict:
    params = {
        "pnu":    pnu,
        "key":    _key(),
        "format": "json",
        "domain": VWORLD_DOMAIN,
    }
    body = await _get_json("/ned/data/getLandUseAttr", params)

    # 응답 구조: body["landUses"]["field"]
    regulations = (body.get("landUses") or body.get("landUseAttrList") or {}).get("field", [])
    if isinstance(regulations, dict):
        regulations = [regulations]

    forest_regs = [
        reg for reg in regulations
        if any(kw in str(reg.get("prposAreaDstrcCodeNm", ""))
               for kw in ["산지", "보전", "임업", "공익"])
    ]

    return {
        "siteClassification": _classify_forest(forest_regs),
        "regulations": [
            {"name": r.get("prposAreaDstrcCodeNm", ""),
             "code": r.get("prposAreaDstrcCode", "")}
            for r in forest_regs
        ],
    }


def _classify_forest(regs: list) -> str:
    names = " ".join(r.get("prposAreaDstrcCodeNm", "") for r in regs)
    if "임업용" in names: return "임업용산지"
    if "공익용" in names: return "공익용산지"
    if "준보전" in names: return "준보전산지"
    if "산지"   in names: return "산지(구분미상)"
    return "미분류"


# ── 통합 조회 ────────────────────────────────────────────────────────────
async def lookup_land(address: str) -> dict:
    """
    주소 문자열 하나로 필지 기본정보 + 산지구분까지 반환.
    부분 실패는 error_* 키로 기록하고 최대한 반환한다.
    """
    result: dict = {"query": address}

    # 1) 좌표 + 법정동코드
    try:
        coord = await get_coord_and_code(address)
        result.update(coord)
    except Exception as e:
        result["error_coord"] = str(e)
        return result

    # 2) PNU 결정 — level4LC 직접 제공 시 우선 사용
    direct_pnu = result.get("directPnu", "")
    if direct_pnu:
        pnu = direct_pnu
        result["pnu"] = pnu
    else:
        dong_code = result.get("dongCode", "")
        jibun     = result.get("jibun", "")
        if not dong_code or not jibun:
            result["error_pnu"] = f"PNU 구성 불가 (dongCode={dong_code!r}, jibun={jibun!r})"
            return result
        try:
            pnu = build_pnu(dong_code, jibun)
            result["pnu"] = pnu
        except Exception as e:
            result["error_pnu"] = str(e)
            return result

    # 3) 토지임야정보
    try:
        info = await get_land_info(pnu)
        result.update(info)
    except Exception as e:
        result["error_land_info"] = str(e)

    # 4) 토지이용규제
    try:
        reg = await get_land_regulation(pnu)
        result.update(reg)
    except Exception as e:
        result["error_regulation"] = str(e)

    return result
