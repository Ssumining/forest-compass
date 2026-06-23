"""산지일시사용신고서 PDF — 별지 제7호의4서식 (Canvas 직접 드로잉)"""
from __future__ import annotations
import io
from pathlib import Path

_FONT_DIR = Path("C:/Windows/Fonts")


def _setup():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    try:
        pdfmetrics.registerFont(TTFont("KR",   str(_FONT_DIR / "malgun.ttf")))
        pdfmetrics.registerFont(TTFont("KRBd", str(_FONT_DIR / "malgunbd.ttf")))
        return "KR", "KRBd"
    except Exception:
        return "Helvetica", "Helvetica-Bold"


def _comma(n) -> str:
    try:
        return f"{int(float(n or 0)):,}" if float(n or 0) else ""
    except Exception:
        return str(n or "")


def _chk(val, target) -> str:
    return "√" if str(val or "") == str(target) else " "


def generate_report_pdf(payload: dict) -> bytes:
    from reportlab.pdfgen import canvas as cv
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    F, FB = _setup()

    # ── 데이터 추출 ────────────────────────────────────────────────────────
    a     = payload.get("applicant")  or {}
    lo    = payload.get("landowner")  or {}
    owner = a if lo.get("sameAsApplicant") else lo
    sites = payload.get("siteDetails") or [{}]
    s0    = sites[0] if sites else {}
    period   = payload.get("period")  or {}
    orig     = period.get("original") or {}
    chgd     = period.get("changed")  or {}
    changes  = payload.get("changes") or {}
    decl     = payload.get("declarationType", "신규")
    declared = payload.get("declaredDate", "")
    recip    = payload.get("recipient", "시장·군수·구청장")

    buf = io.BytesIO()
    c = cv.Canvas(buf, pagesize=A4)
    PW, PH = A4          # 595.28, 841.89 pts
    ML = 15 * mm         # left margin
    MT = 15 * mm         # top margin
    UW = PW - 2 * ML     # usable width ≈ 180 mm

    # ── 좌표 헬퍼 ─────────────────────────────────────────────────────────
    # y_t: mm from top of usable area (↓ positive)
    def ypt(y_t):       return PH - MT - y_t * mm
    def xpt(x_mm):      return ML + x_mm * mm

    def hl(x1, x2, y_t, lw=0.5):
        c.setLineWidth(lw)
        c.line(xpt(x1), ypt(y_t), xpt(x2), ypt(y_t))

    def vl(x, y_t1, y_t2, lw=0.5):
        c.setLineWidth(lw)
        c.line(xpt(x), ypt(y_t1), xpt(x), ypt(y_t2))

    def rect(x, y_t, w, h, lw=0.8):
        c.setLineWidth(lw)
        c.rect(xpt(x), ypt(y_t + h), w * mm, h * mm)

    def cell_text(x_mm, y_t, w_mm, h_mm, text, size=8, bold=False,
                  align="left", pad=1.5):
        """셀 안에 텍스트를 수직 중앙 정렬로 그린다."""
        if text is None:
            return
        text = str(text)
        if not text:
            return
        c.setFont(FB if bold else F, size)
        # 수직 중앙: 셀 상단에서 h/2 내려가고 폰트 높이의 약 35% 올린다
        yp = ypt(y_t + h_mm / 2) - size * mm * 0.18
        if align == "center":
            c.drawCentredString(xpt(x_mm) + w_mm * mm / 2, yp, text)
        elif align == "right":
            c.drawRightString(xpt(x_mm) + w_mm * mm - pad * mm, yp, text)
        else:
            c.drawString(xpt(x_mm) + pad * mm, yp, text)

    def two_line(x_mm, y_t, w_mm, h_mm, line1, line2, size=8, bold=False):
        """셀 안에 두 줄 텍스트를 수직 중앙 정렬로 그린다."""
        gap = size * 0.4  # mm between lines
        mid = ypt(y_t + h_mm / 2)
        c.setFont(FB if bold else F, size)
        c.drawCentredString(xpt(x_mm) + w_mm * mm / 2,
                            mid + gap * mm / 2, line1)
        c.drawCentredString(xpt(x_mm) + w_mm * mm / 2,
                            mid - size * mm * 0.35 - gap * mm / 2, line2)

    # ── 열 위치 정의 (mm, ML 기준) ────────────────────────────────────────
    # 메인 섹션 열 (신고인, 소유자 등)
    C_LEFT   = 0      # 좌측 외곽
    C_SEC    = 13     # 섹션 라벨 우측
    C_F1     = 23     # 필드라벨1 우측
    C_V1     = 80     # 값1 우측
    C_F2     = 98     # 필드라벨2 우측
    C_RIGHT  = 180    # 우측 외곽

    # 산지내역 열
    C_LOC    = 48     # 소재지 우측
    C_PAR    = 70     # 지번 우측
    C_CAT    = 88     # 지목 우측
    C_TOT    = 108    # 계 우측
    C_IM     = 128    # 임업용 우측
    C_GO     = 150    # 공익용 우측
    # C_RIGHT  = 180  # 준보전 우측 (동일)

    RH = 8    # 기본 행 높이 (mm)
    BH = 12   # 넓은 행 높이 (mm)

    # ── 헤더 ──────────────────────────────────────────────────────────────
    c.setFont(F, 7)
    c.drawString(xpt(0), ypt(0), "■ 산지관리법 시행규칙 [별지 제7호의4서식] <개정 2015.12.30.>")

    title = (f"산지일시사용  [{_chk(decl,'신규')}]신고서  "
             f"[{_chk(decl,'변경')}]변경신고서  "
             f"[{_chk(decl,'기간연장')}]기간연장신고서")
    c.setFont(FB, 14)
    c.drawCentredString(xpt(0) + UW / 2, ypt(6), title)

    c.setFont(F, 7)
    c.drawRightString(xpt(C_RIGHT), ypt(11.5), "(앞쪽)")

    # ── 폼 테이블 시작 ────────────────────────────────────────────────────
    T = 13   # 테이블 상단 (mm from top)

    # ── 접수 행 ───────────────────────────────────────────────────────────
    rect(C_LEFT, T, C_RIGHT, RH)
    vl(45, T, T+RH);  vl(90, T, T+RH);  vl(130, T, T+RH)
    cell_text(C_LEFT,  T, 45,         RH, "접수번호", align="center", bold=True)
    cell_text(45,       T, 45,         RH, "접수일자", align="center", bold=True)
    cell_text(90,       T, 40,         RH, "처리일자", align="center", bold=True)
    two_line(130, T, 50, RH, "처리기간    10일", "* 기간연장신고서 5일", size=7)

    # ── 신고인 (3행) ──────────────────────────────────────────────────────
    Y1 = T + RH
    rect(C_LEFT, Y1, C_RIGHT, RH*3)
    vl(C_SEC, Y1, Y1+RH*3)

    # 섹션 라벨
    c.setFont(FB, 9)
    c.drawCentredString(xpt(C_LEFT) + C_SEC*mm/2, ypt(Y1 + RH*1.5) - 4.5, "신고인")

    # 행1: 성명 / 생년월일
    hl(C_SEC, C_RIGHT, Y1+RH)
    vl(C_F1, Y1, Y1+RH);  vl(C_V1, Y1, Y1+RH);  vl(C_F2, Y1, Y1+RH)
    cell_text(C_SEC, Y1, C_F1-C_SEC, RH, "성명",    align="center")
    cell_text(C_F1,  Y1, C_V1-C_F1,  RH, a.get("name",""))
    cell_text(C_V1,  Y1, C_F2-C_V1,  RH, "생년월일", align="center")
    cell_text(C_F2,  Y1, C_RIGHT-C_F2, RH, a.get("birth",""))

    # 행2: 주소 / 전화번호
    hl(C_SEC, C_RIGHT, Y1+RH*2)
    vl(C_F1, Y1+RH, Y1+RH*2);  vl(C_V1, Y1+RH, Y1+RH*2);  vl(C_F2, Y1+RH, Y1+RH*2)
    cell_text(C_SEC, Y1+RH, C_F1-C_SEC, RH, "주소",    align="center")
    cell_text(C_F1,  Y1+RH, C_V1-C_F1,  RH, a.get("address",""))
    cell_text(C_V1,  Y1+RH, C_F2-C_V1,  RH, "전화번호", align="center")
    cell_text(C_F2,  Y1+RH, C_RIGHT-C_F2, RH, a.get("phone",""))

    # 행3: 권리관계
    vl(C_F1, Y1+RH*2, Y1+RH*3)
    cell_text(C_SEC, Y1+RH*2, C_F1-C_SEC, RH, "해당 산지에 대한 권리관계", size=7, align="center")
    owner_txt = "신고인과 동일" if lo.get("sameAsApplicant") else owner.get("name","")
    cell_text(C_F1, Y1+RH*2, C_RIGHT-C_F1, RH, owner_txt)

    # ── 산지 소유자 (2행) ──────────────────────────────────────────────────
    Y2 = Y1 + RH*3
    rect(C_LEFT, Y2, C_RIGHT, RH*2)
    vl(C_SEC, Y2, Y2+RH*2)
    two_line(C_LEFT, Y2, C_SEC, RH*2, "산  지", "소유자", size=9, bold=True)

    hl(C_SEC, C_RIGHT, Y2+RH)
    for _y in [Y2, Y2+RH]:
        vl(C_F1, _y, _y+RH);  vl(C_V1, _y, _y+RH);  vl(C_F2, _y, _y+RH)

    ov = owner if not lo.get("sameAsApplicant") else {}
    cell_text(C_SEC, Y2,    C_F1-C_SEC,     RH, "성명",    align="center")
    cell_text(C_F1,  Y2,    C_V1-C_F1,      RH, ov.get("name",""))
    cell_text(C_V1,  Y2,    C_F2-C_V1,      RH, "생년월일", align="center")
    cell_text(C_F2,  Y2,    C_RIGHT-C_F2,   RH, ov.get("birth",""))
    cell_text(C_SEC, Y2+RH, C_F1-C_SEC,     RH, "주소",    align="center")
    cell_text(C_F1,  Y2+RH, C_V1-C_F1,      RH, ov.get("address",""))
    cell_text(C_V1,  Y2+RH, C_F2-C_V1,      RH, "전화번호", align="center")
    cell_text(C_F2,  Y2+RH, C_RIGHT-C_F2,   RH, ov.get("phone",""))

    # ── 일시사용 산지내역 ──────────────────────────────────────────────────
    Y3 = Y2 + RH*2
    n_sites = max(len(sites), 1)
    # 헤더1행 + 데이터n행 + 계1행 + 일시사용면적1행
    area_rows = 1 + n_sites + 1 + 1
    AH = area_rows * RH
    rect(C_LEFT, Y3, C_RIGHT, AH)
    vl(C_SEC, Y3, Y3+AH)
    two_line(C_LEFT, Y3, C_SEC, AH, "일시사용", "산지내역", size=8, bold=True)

    # 헤더 행
    for cx in [C_LOC, C_PAR, C_CAT, C_TOT, C_IM, C_GO]:
        vl(cx, Y3, Y3+RH)
    hl(C_SEC, C_RIGHT, Y3+RH)
    cell_text(C_SEC, Y3, C_LOC-C_SEC, RH, "소재지",       align="center", bold=True)
    cell_text(C_LOC, Y3, C_PAR-C_LOC, RH, "지번",         align="center", bold=True)
    cell_text(C_PAR, Y3, C_CAT-C_PAR, RH, "지목",         align="center", bold=True)
    cell_text(C_CAT, Y3, C_TOT-C_CAT, RH, "계",           align="center", bold=True)
    cell_text(C_TOT, Y3, C_IM-C_TOT,  RH, "임업용산지(㎡)", size=6.5, align="center", bold=True)
    cell_text(C_IM,  Y3, C_GO-C_IM,   RH, "공익용산지(㎡)", size=6.5, align="center", bold=True)
    cell_text(C_GO,  Y3, C_RIGHT-C_GO,RH, "준보전산지(㎡)", size=6.5, align="center", bold=True)

    # 데이터 행
    for i, si in enumerate(sites):
        yr = Y3 + RH*(1+i)
        hl(C_SEC, C_RIGHT, yr+RH)
        ar = si.get("areaByType") or {}
        for cx in [C_LOC, C_PAR, C_CAT, C_TOT, C_IM, C_GO]:
            vl(cx, yr, yr+RH)
        cell_text(C_SEC, yr, C_LOC-C_SEC, RH, si.get("location",""))
        cell_text(C_LOC, yr, C_PAR-C_LOC, RH, si.get("parcel",""), align="center")
        cell_text(C_PAR, yr, C_CAT-C_PAR, RH, si.get("landCategory",""), align="center")
        cell_text(C_CAT, yr, C_TOT-C_CAT, RH, _comma(si.get("areaTotal",0)), align="right")
        cell_text(C_TOT, yr, C_IM-C_TOT,  RH, _comma(ar.get("임업용산지",0)), align="right")
        cell_text(C_IM,  yr, C_GO-C_IM,   RH, _comma(ar.get("공익용산지",0)), align="right")
        cell_text(C_GO,  yr, C_RIGHT-C_GO,RH, _comma(ar.get("준보전산지",0)), align="right")

    # 계 행
    Y_SUM = Y3 + RH*(1+n_sites)
    hl(C_SEC, C_RIGHT, Y_SUM+RH)
    for cx in [C_LOC, C_PAR, C_CAT, C_TOT, C_IM, C_GO]:
        vl(cx, Y_SUM, Y_SUM+RH)
    t_all = sum(s.get("areaTotal",0) for s in sites)
    t_im  = sum((s.get("areaByType") or {}).get("임업용산지",0) for s in sites)
    t_go  = sum((s.get("areaByType") or {}).get("공익용산지",0) for s in sites)
    t_jun = sum((s.get("areaByType") or {}).get("준보전산지",0) for s in sites)
    cell_text(C_SEC, Y_SUM, C_LOC-C_SEC, RH, "계", align="center", bold=True)
    cell_text(C_CAT, Y_SUM, C_TOT-C_CAT, RH, _comma(t_all), align="right")
    cell_text(C_TOT, Y_SUM, C_IM-C_TOT,  RH, _comma(t_im),  align="right")
    cell_text(C_IM,  Y_SUM, C_GO-C_IM,   RH, _comma(t_go),  align="right")
    cell_text(C_GO,  Y_SUM, C_RIGHT-C_GO,RH, _comma(t_jun), align="right")

    # 일시사용 면적 행
    Y_AREA = Y_SUM + RH
    vl(C_CAT, Y_AREA, Y_AREA+RH)
    cell_text(C_SEC,  Y_AREA, C_CAT-C_SEC,    RH, "일시사용 면적", align="center", bold=True)
    temp = s0.get("tempUseAreaSqm", 0)
    cell_text(C_CAT,  Y_AREA, C_RIGHT-C_CAT,  RH,
              f"{_comma(temp)} ㎡" if temp else "", align="center")

    # ── 일시사용 목적 ──────────────────────────────────────────────────────
    Y4 = Y3 + AH
    rect(C_LEFT, Y4, C_RIGHT, BH)
    vl(C_SEC, Y4, Y4+BH)
    two_line(C_LEFT, Y4, C_SEC, BH, "일시사용", "목  적", size=8, bold=True)
    cell_text(C_SEC, Y4, C_RIGHT-C_SEC, BH, payload.get("purpose",""), size=9)

    # ── 일시사용 기간 ──────────────────────────────────────────────────────
    Y5 = Y4 + BH
    MID_P = 97   # 당초/변경 구분선 위치
    rect(C_LEFT, Y5, C_RIGHT, BH)
    vl(C_SEC, Y5, Y5+BH);  vl(MID_P, Y5, Y5+BH)

    two_line(C_LEFT, Y5, C_SEC, BH, "일시사용", "기  간", size=8, bold=True)

    orig_str = f"{orig.get('start','')} ~ {orig.get('end','')}"
    chgd_str = f"{chgd.get('start','')} ~ {chgd.get('end','')}" if chgd.get("start") else ""

    two_line(C_SEC, Y5, MID_P-C_SEC,    BH, "당초(신규)", orig_str, size=8)
    two_line(MID_P, Y5, C_RIGHT-MID_P, BH, "변경",       chgd_str, size=8)

    # ── 변경사항 ───────────────────────────────────────────────────────────
    Y6 = Y5 + BH
    CHG1 = 68;  CHG2 = 124
    rect(C_LEFT, Y6, C_RIGHT, BH)
    vl(C_SEC, Y6, Y6+BH);  vl(CHG1, Y6, Y6+BH);  vl(CHG2, Y6, Y6+BH)

    two_line(C_LEFT, Y6, C_SEC, BH, "변경", "사항", size=8, bold=True)
    two_line(C_SEC, Y6, CHG1-C_SEC,    BH, "변경 전", changes.get("before",""), size=8)
    two_line(CHG1,  Y6, CHG2-CHG1,    BH, "변경 후", changes.get("after",""),  size=8)
    two_line(CHG2,  Y6, C_RIGHT-CHG2, BH, "사  유",  changes.get("reason",""), size=8)

    # ── 하단 법령 문구 ────────────────────────────────────────────────────
    Y_END = Y6 + BH
    legal1 = "「산지관리법」 제15조의2제2항·제3항 및 같은 법 시행규칙 제15조의3제1항·제15조의4제2항에 따라"
    legal2 = (f"위와 같이 산지일시사용 [{_chk(decl,'신규')}]신고  "
              f"[{_chk(decl,'변경')}]변경신고  "
              f"[{_chk(decl,'기간연장')}]기간연장신고를 합니다.")
    c.setFont(F, 8.5)
    c.drawCentredString(xpt(0)+UW/2, ypt(Y_END+5),  legal1)
    c.drawCentredString(xpt(0)+UW/2, ypt(Y_END+10), legal2)

    # 날짜
    if declared and "-" in declared:
        pts = declared.split("-")
        date_str = f"{pts[0]}년    {int(pts[1])}월    {int(pts[2])}일"
    else:
        date_str = declared
    c.setFont(F, 10)
    c.drawCentredString(xpt(0)+UW/2, ypt(Y_END+16), date_str)

    # 서명
    c.setFont(F, 10)
    sig = f"신고인    {a.get('name','')}    (서명 또는 인)"
    c.drawCentredString(xpt(0)+UW/2, ypt(Y_END+22), sig)

    # 귀하
    c.setFont(FB, 10)
    c.drawCentredString(xpt(0)+UW/2, ypt(Y_END+29), f"{recip}  귀하")

    # 뒤쪽 안내
    c.setFont(F, 7)
    c.drawString(xpt(0), ypt(Y_END+34),
                 "* 신청인 제출서류, 담당 공무원 확인사항, 수수료, 행정정보 공동이용 동의서: 뒤쪽 참조")

    # ── 처리절차 ───────────────────────────────────────────────────────────
    PROC_Y = Y_END + 39
    PROC_H = 13

    # 제목 박스
    rect(C_LEFT, PROC_Y, C_RIGHT, 5)
    c.setFont(FB, 9)
    c.drawCentredString(xpt(0)+UW/2, ypt(PROC_Y+3.5), "처리절차")

    # 단계 박스
    steps = ["신고서", "접  수", "현지조사\n확인", "복구비\n산정",
             "복구비 예치\n통지", "복구비\n예치", "신고수리\n결정", "신고\n수리"]
    sw = C_RIGHT / len(steps)
    rect(C_LEFT, PROC_Y+5, C_RIGHT, PROC_H)
    for i, step in enumerate(steps):
        xv = i * sw
        if i > 0:
            vl(xv, PROC_Y+5, PROC_Y+5+PROC_H)
        lines = step.split("\n")
        mid_y = ypt(PROC_Y + 5 + PROC_H/2)
        line_h = 8 * 0.45 * mm
        for li, ln in enumerate(lines):
            offset = (len(lines)-1-li*2) * line_h / 2
            c.setFont(F, 7)
            c.drawCentredString(xpt(xv) + sw*mm/2, mid_y - 3 + offset, ln)

    # 화살표
    for i in range(1, len(steps)):
        c.setFont(F, 7)
        c.drawCentredString(xpt(i*sw) - 2*mm, ypt(PROC_Y+5+PROC_H/2)-2, ">")

    # 담당 라벨
    c.setFont(F, 7)
    labels = [(0,"신고인"), (1,"담당부서"), (5,"신고인"), (6,"담당부서"), (7,"신고인")]
    for idx, label in labels:
        c.drawCentredString(xpt(idx*sw) + sw*mm/2, ypt(PROC_Y+5+PROC_H+4), label)

    # 용지 규격
    c.setFont(F, 6.5)
    c.drawRightString(xpt(C_RIGHT), ypt(PROC_Y+5+PROC_H+8),
                      "210mm×297mm[백상지(80g/㎡) 또는 중질지(80g/㎡)]")

    c.showPage()
    c.save()
    return buf.getvalue()
