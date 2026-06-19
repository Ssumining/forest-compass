// 산지일시사용 신고서 — 별지 제7호의4서식 (산지관리법 시행규칙) <개정 2015.12.30.>
//
// 양식 자체는 백엔드가 고정 보관(HWPX 템플릿)하고, 프론트는 "값(JSON)"만 보낸다.
// 이 파일이 프론트 ↔ 백엔드 사이의 단일 데이터 계약(source of truth)이다.

export const FORM_CODE = '별지_제7호의4서식';
export const FORM_TITLE = '산지일시사용신고서';

// 신고 구분 (서식 상단 체크박스 [ ]신고서 [ ]변경신고서 [ ]기간연장신고서)
export const DECLARATION_TYPES = ['신규', '변경', '기간연장'];

// 산지구분 (면적 표의 칼럼)
export const SAN_JI_TYPES = ['임업용산지', '공익용산지', '준보전산지'];

// 수신 기관 (서식 하단 "~ 귀하")
export const RECIPIENTS = [
  '시장·군수·구청장',
  '산림청장',
  '지방산림청국유림관리소장',
  '국립수목원장',
  '국립산림품종관리센터장',
  '국립산림과학원장',
  '국립자연휴양림관리소장',
];

// 데모/초기 폼 상태 (남원 산내면 시나리오)
export function makeDefaultFields() {
  return {
    declarationType: '신규',

    // 신고인
    applicantName: '윤석호',
    applicantBirth: '1985-02-14',
    applicantAddress: '전북 남원시 산내면 부운길 17',
    applicantPhone: '010-1234-5678',

    // 산지 소유자(권리관계) — 신고인과 동일하면 ownerSame=true
    ownerSame: true,
    ownerName: '',
    ownerBirth: '',
    ownerAddress: '',
    ownerPhone: '',

    // 산지 일시사용 내역 (1필지 기준)
    siteLocation: '전북 남원시 산내면',
    siteParcel: '산 32-1',
    siteLandCategory: '임야',
    areaImupum: 46210,   // 임업용산지(㎡)
    areaGongik: 0,       // 공익용산지(㎡)
    areaJunbojeon: 0,    // 준보전산지(㎡)
    tempUseArea: 46210,  // 일시사용 면적(㎡)

    // 목적·기간
    purpose: '산불 피해지 고사목 수확 및 산림 복구',
    periodStart: '2026-06-01',
    periodEnd: '2026-08-31',

    // 변경사항 (변경신고일 때만 사용)
    changeBefore: '',
    changeAfter: '',
    changeReason: '',

    declaredDate: '2026-06-14',
    recipient: '시장·군수·구청장',
  };
}

export const REQUIRED_FIELDS = [
  'applicantName', 'applicantBirth', 'applicantAddress',
  'siteLocation', 'siteParcel', 'purpose', 'periodStart', 'periodEnd', 'recipient',
];

export function validateFields(f) {
  const missing = REQUIRED_FIELDS.filter((k) => !String(f[k] ?? '').trim());
  if (!f.ownerSame) {
    if (!String(f.ownerName).trim()) missing.push('ownerName');
  }
  if (f.declarationType === '변경' && !String(f.changeReason).trim()) {
    missing.push('changeReason');
  }
  return missing;
}

const num = (v) => Number(String(v).replace(/[^\d.-]/g, '')) || 0;

// 폼 상태 + 시뮬레이션 결과 → 백엔드 전송용 JSON
export function buildReportPayload(f, sim = {}) {
  const areaTotal = num(f.areaImupum) + num(f.areaGongik) + num(f.areaJunbojeon);
  const owner = f.ownerSame
    ? { sameAsApplicant: true }
    : {
        sameAsApplicant: false,
        name: f.ownerName,
        birth: f.ownerBirth,
        address: f.ownerAddress,
        phone: f.ownerPhone,
      };

  const payload = {
    formCode: FORM_CODE,
    declarationType: f.declarationType,
    outputs: ['hwpx', 'pdf'],

    applicant: {
      name: f.applicantName,
      birth: f.applicantBirth,
      address: f.applicantAddress,
      phone: f.applicantPhone,
    },
    landowner: owner,

    siteDetails: [
      {
        location: f.siteLocation,
        parcel: f.siteParcel,
        landCategory: f.siteLandCategory,
        areaByType: {
          임업용산지: num(f.areaImupum),
          공익용산지: num(f.areaGongik),
          준보전산지: num(f.areaJunbojeon),
        },
        areaTotal,
        tempUseAreaSqm: num(f.tempUseArea),
      },
    ],

    purpose: f.purpose,
    period: { original: { start: f.periodStart, end: f.periodEnd } },

    declaredDate: f.declaredDate,
    recipient: f.recipient,

    // 우리 서비스 차별점: AI 사전검토 결과 (서식 본문 밖 첨부 별지)
    aiReview: {
      avgSlopeDeg: sim.avgSlope ?? null,
      expectedYieldM3: sim.Y ?? null,
      radiusM: sim.radius ?? null,
      slopeLimitDeg: sim.slopeLimit ?? null,
      compliant: sim.compliant ?? null,
    },
  };

  if (f.declarationType === '변경') {
    payload.period.changed = { start: f.periodStart, end: f.periodEnd };
    payload.changes = { before: f.changeBefore, after: f.changeAfter, reason: f.changeReason };
  }

  return payload;
}
