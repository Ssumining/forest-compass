# 산지일시사용신고서 — 프론트 ↔ 백엔드 계약서

> 대상 서식: **별지 제7호의4서식** (산지관리법 시행규칙) `<개정 2015.12.30.>`
> 핵심 원칙: **양식은 백엔드가 고정 보관, 프론트는 값(JSON)만 전송**

---

## 0. 왜 "법령 API에서 양식 끌어오기"를 안 하는가

국가법령정보센터 / 법제처 별표서식 API는 **빈 양식을 구조화 데이터로 주지 않는다.**
실제 호출 결과는 아래처럼 뷰어 페이지를 감싼 **HTML iframe 껍데기**다:

```
GET /api/law/interpretation/central?title=개정된 산지관리법 시행령 적용 기준
→ 200 OK (text/html)
  <iframe id="lawService" src="/LSW//cgmExpcInfoP.do?cgmExpcDatSeq=376032&ofiClsCd=350131"></iframe>
```

→ 매 요청마다 양식을 동적으로 받는 구조는 불가능. **서식은 우리가 1회 제작해 고정**하고,
   개정(수년에 1회)이 있을 때만 템플릿을 수동 교체한다. 법령 API는 "관련 법령해석례 링크"
   보조 표시 용도로만(런타임 필수 경로 아님).

---

## 1. 엔드포인트

```
POST /api/report          (Next BFF: app/api/report/route.js)
  └─ REPORT_BACKEND_URL 설정 시 → POST {REPORT_BACKEND_URL}/report/forest-temp-use 로 프록시
                                   → 백엔드가 만든 .hwpx/.pdf 를 그대로 스트리밍
  └─ 미설정 시 → 데모 폴백(.txt) 반환 (백엔드 없이도 다운로드 동작)
```

백엔드(python)는 `POST /report/forest-temp-use` 하나만 구현하면 된다.

- 요청: `Content-Type: application/json` (아래 §2 페이로드)
- 응답: 파일 바이너리
  - `Content-Type: application/octet-stream` (또는 `application/haansofthwp` 등)
  - `Content-Disposition: attachment; filename*=UTF-8''<urlencoded 파일명>`

---

## 2. 요청 페이로드 (프론트 → 백엔드)

`lib/reportSchema.js → buildReportPayload()` 가 생성한다. 단일 진실 공급원(SSOT).

```jsonc
{
  "formCode": "별지_제7호의4서식",
  "declarationType": "신규",          // 신규 | 변경 | 기간연장
  "outputs": ["hwpx", "pdf"],
  "reportId": "SLO-20260614-산321",   // BFF가 부여 (백엔드 프록시 시 주입됨)

  "applicant": {                       // 신고인
    "name": "윤석호", "birth": "1985-02-14",
    "address": "전북 남원시 산내면 부운길 17", "phone": "010-1234-5678"
  },
  "landowner": { "sameAsApplicant": true },
  // 다를 경우: { "sameAsApplicant": false, "name","birth","address","phone" }

  "siteDetails": [                     // 산지 일시사용 내역 (여러 필지 가능)
    {
      "location": "전북 남원시 산내면",
      "parcel": "산 32-1",
      "landCategory": "임야",
      "areaByType": { "임업용산지": 46210, "공익용산지": 0, "준보전산지": 0 },
      "areaTotal": 46210,
      "tempUseAreaSqm": 46210
    }
  ],

  "purpose": "산불 피해지 고사목 수확 및 산림 복구",
  "period": { "original": { "start": "2026-06-01", "end": "2026-08-31" } },
  // 변경신고: "changed": {start,end}, 그리고 최상위에 "changes": {before,after,reason}

  "declaredDate": "2026-06-14",
  "recipient": "시장·군수·구청장",

  "aiReview": {                        // 서식 본문 밖 첨부 별지용 (차별점)
    "avgSlopeDeg": 18.7, "expectedYieldM3": 646,
    "radiusM": 500, "slopeLimitDeg": 25, "compliant": true
  }
}
```

### 백엔드가 채우지 않는 칸 (관청 기입)
`접수번호 · 접수일자 · 처리일자 · 수수료` → 공란 유지.

---

## 3. HWPX 템플릿 플레이스홀더 매핑

한컴 한글로 별지 제7호의4서식을 작성 → 채울 칸에 아래 `{{...}}` 토큰을 넣고 `.hwpx` 저장.
백엔드는 `Contents/section0.xml` 의 토큰을 값으로 치환한다.

| 플레이스홀더 | JSON 경로 | 비고 |
|---|---|---|
| `{{decl_new}}` / `{{decl_change}}` / `{{decl_extend}}` | `declarationType` | 해당 항목 `√`, 나머지 공백 |
| `{{applicant_name}}` | `applicant.name` | |
| `{{applicant_birth}}` | `applicant.birth` | |
| `{{applicant_address}}` | `applicant.address` | |
| `{{applicant_phone}}` | `applicant.phone` | |
| `{{owner_name}}` | `landowner.sameAsApplicant ? applicant.name : landowner.name` | |
| `{{owner_birth}}` | `landowner.* or applicant.*` | 동일 시 신고인 값 |
| `{{owner_address}}` | 〃 | |
| `{{owner_phone}}` | 〃 | |
| `{{site_location}}` | `siteDetails[0].location` | 다필지는 행 복제 |
| `{{site_parcel}}` | `siteDetails[0].parcel` | |
| `{{site_category}}` | `siteDetails[0].landCategory` | |
| `{{area_imupum}}` | `siteDetails[0].areaByType.임업용산지` | 천단위 콤마 |
| `{{area_gongik}}` | `siteDetails[0].areaByType.공익용산지` | |
| `{{area_junbojeon}}` | `siteDetails[0].areaByType.준보전산지` | |
| `{{area_total}}` | `siteDetails[0].areaTotal` | |
| `{{temp_use_area}}` | `siteDetails[0].tempUseAreaSqm` | |
| `{{purpose}}` | `purpose` | |
| `{{period_start}}` / `{{period_end}}` | `period.original.*` | |
| `{{change_before}}` / `{{change_after}}` / `{{change_reason}}` | `changes.*` | 변경신고만 |
| `{{declared_date}}` | `declaredDate` | `YYYY년 M월 D일` 포맷 권장 |
| `{{recipient}}` | `recipient` | "~ 귀하" 앞 |

> 면적 표가 다필지이면 `siteDetails[]` 길이만큼 표 행(`<hp:tr>`)을 복제 후 치환.
> 레이아웃 보호를 위해 병합 시 `<hp:linesegarray>` 노드는 제거(명세 3.5 참고).

---

## 4. 응답 (백엔드 → 프론트)

성공: 파일 바이너리 스트림 (위 §1 헤더). 프론트는 `Content-Disposition` 파일명으로 즉시 다운로드.

실패 예시:
```jsonc
{ "error": "MISSING_FIELDS", "missing": ["applicant.name"] }   // 422
{ "error": "TEMPLATE_NOT_FOUND" }                              // 500
```

---

## 5. 환경변수

| 변수 | 의미 | 예 |
|---|---|---|
| `REPORT_BACKEND_URL` | python 백엔드 베이스 URL. 없으면 BFF 데모 폴백 | `http://localhost:8000` |
