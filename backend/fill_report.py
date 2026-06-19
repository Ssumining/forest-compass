"""
산지일시사용신고서 (별지 제7호의4서식) — HWPX 템플릿 치환 프로토타입.

설계 원칙
---------
- 양식(빈 서식)은 법령 API에서 받지 않는다. 한컴 한글로 1회 제작한 고정 템플릿
  `templates/forest_temp_use.hwpx` 의 플레이스홀더({{...}})를 값으로 치환할 뿐이다.
- 프론트가 보내는 JSON 계약은 docs/backend-report-contract.md 의 §2 와 동일.

HWPX 구조
---------
  .hwpx 는 ZIP 컨테이너. 본문 텍스트는 보통 `Contents/section0.xml` 에 들어있다.
  텍스트 런(`<hp:t>...</hp:t>`)에 {{token}} 을 넣어두고 문자열 치환한다.

의존성: python-hwpx, lxml  (pip install python-hwpx lxml)
        ※ 본 파일은 표준 ZIP 치환 폴백도 포함하여 라이브러리 없이도 동작한다.
"""
from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path

TEMPLATE = Path(__file__).parent / "templates" / "forest_temp_use.hwpx"
BODY_ENTRY = "Contents/section0.xml"

DECL = {"신규": "decl_new", "변경": "decl_change", "기간연장": "decl_extend"}


def _comma(n) -> str:
    try:
        return f"{int(float(n)):,}"
    except (TypeError, ValueError):
        return str(n or "")


def _kdate(iso: str) -> str:
    # "2026-06-14" -> "2026년 6월 14일"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso or "")
    return f"{int(m[1])}년 {int(m[2])}월 {int(m[3])}일" if m else (iso or "")


def build_token_map(p: dict) -> dict[str, str]:
    """JSON 페이로드 → {플레이스홀더 토큰: 값} (docs §3 매핑과 1:1)."""
    a = p["applicant"]
    lo = p.get("landowner", {})
    owner = a if lo.get("sameAsApplicant") else lo
    s = p["siteDetails"][0]
    area = s.get("areaByType", {})
    changes = p.get("changes", {})

    t: dict[str, str] = {
        # 신고 구분 체크박스
        "decl_new": "√" if p["declarationType"] == "신규" else " ",
        "decl_change": "√" if p["declarationType"] == "변경" else " ",
        "decl_extend": "√" if p["declarationType"] == "기간연장" else " ",
        # 신고인
        "applicant_name": a.get("name", ""),
        "applicant_birth": a.get("birth", ""),
        "applicant_address": a.get("address", ""),
        "applicant_phone": a.get("phone", ""),
        # 소유자
        "owner_name": owner.get("name", ""),
        "owner_birth": owner.get("birth", ""),
        "owner_address": owner.get("address", ""),
        "owner_phone": owner.get("phone", ""),
        # 산지 내역
        "site_location": s.get("location", ""),
        "site_parcel": s.get("parcel", ""),
        "site_category": s.get("landCategory", ""),
        "area_imupum": _comma(area.get("임업용산지", 0)),
        "area_gongik": _comma(area.get("공익용산지", 0)),
        "area_junbojeon": _comma(area.get("준보전산지", 0)),
        "area_total": _comma(s.get("areaTotal", 0)),
        "temp_use_area": _comma(s.get("tempUseAreaSqm", 0)),
        # 목적·기간
        "purpose": p.get("purpose", ""),
        "period_start": (p.get("period", {}).get("original", {}) or {}).get("start", ""),
        "period_end": (p.get("period", {}).get("original", {}) or {}).get("end", ""),
        # 변경사항
        "change_before": changes.get("before", ""),
        "change_after": changes.get("after", ""),
        "change_reason": changes.get("reason", ""),
        # 서명부
        "declared_date": _kdate(p.get("declaredDate", "")),
        "recipient": p.get("recipient", ""),
    }
    return t


def _xml_escape(v: str) -> str:
    return (
        str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )


def fill_hwpx(payload: dict, template: Path = TEMPLATE) -> bytes:
    """템플릿 .hwpx 의 {{token}} 을 치환하여 완성된 .hwpx 바이트를 반환."""
    tokens = build_token_map(payload)

    src = zipfile.ZipFile(template, "r")
    out_buf = io.BytesIO()
    with zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == BODY_ENTRY:
                xml = data.decode("utf-8")
                for key, val in tokens.items():
                    xml = xml.replace("{{" + key + "}}", _xml_escape(val))
                # 다필지: siteDetails[1:] 가 있으면 여기서 표 행 복제 처리(TODO)
                data = xml.encode("utf-8")
            dst.writestr(item, data)
    src.close()
    return out_buf.getvalue()


# --- FastAPI 연동 예시 (REPORT_BACKEND_URL 가 가리키는 서버) ---------------
# from fastapi import FastAPI
# from fastapi.responses import Response
# from urllib.parse import quote
# app = FastAPI()
#
# @app.post("/report/forest-temp-use")
# def generate(payload: dict):
#     hwpx = fill_hwpx(payload)
#     rid = payload.get("reportId", "report")
#     fname = quote(f"산지일시사용신고서_{rid}.hwpx")
#     return Response(
#         content=hwpx,
#         media_type="application/octet-stream",
#         headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}"},
#     )


if __name__ == "__main__":
    # 토큰 매핑 점검용 샘플
    sample = {
        "declarationType": "신규",
        "applicant": {"name": "윤석호", "birth": "1985-02-14",
                      "address": "전북 남원시 산내면 부운길 17", "phone": "010-1234-5678"},
        "landowner": {"sameAsApplicant": True},
        "siteDetails": [{"location": "전북 남원시 산내면", "parcel": "산 32-1",
                         "landCategory": "임야",
                         "areaByType": {"임업용산지": 46210, "공익용산지": 0, "준보전산지": 0},
                         "areaTotal": 46210, "tempUseAreaSqm": 46210}],
        "purpose": "산불 피해지 고사목 수확 및 산림 복구",
        "period": {"original": {"start": "2026-06-01", "end": "2026-08-31"}},
        "declaredDate": "2026-06-14", "recipient": "시장·군수·구청장",
    }
    for k, v in build_token_map(sample).items():
        print(f"{{{{{k}}}}} -> {v}")
