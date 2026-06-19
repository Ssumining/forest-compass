// BFF(Backend-For-Frontend) — 산지일시사용신고서 생성 엔드포인트
//
// 흐름:
//   1) 프론트가 reportSchema.buildReportPayload() 결과(JSON)를 POST
//   2) 페이로드 검증
//   3) REPORT_BACKEND_URL 환경변수가 있으면 → 실제 python-hwpx 백엔드로 프록시,
//      받은 파일(.hwpx/.pdf)을 그대로 스트리밍해서 반환
//   4) 없으면 → 데모 폴백: 채워진 신고서 텍스트(.txt)를 즉시 생성해 반환
//      (백엔드 연동 전에도 다운로드 버튼이 끝까지 동작하도록)

const REQUIRED = ['formCode', 'declarationType', 'applicant', 'siteDetails', 'purpose'];

function validate(p) {
  const missing = REQUIRED.filter((k) => p[k] == null);
  if (p.applicant && !p.applicant.name) missing.push('applicant.name');
  if (!Array.isArray(p.siteDetails) || p.siteDetails.length === 0) missing.push('siteDetails[]');
  return missing;
}

function makeReportId(p) {
  const parcel = p.siteDetails?.[0]?.parcel ?? 'NA';
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SLO-${stamp}-${String(parcel).replace(/[^\dA-Za-z]/g, '')}`;
}

// 데모 폴백: 사람이 읽을 수 있는 신고서 텍스트로 렌더 (백엔드 미연동 시)
function renderPlainText(p) {
  const s = p.siteDetails[0];
  const a = p.applicant;
  const o = p.landowner?.sameAsApplicant ? '(신고인과 동일)' : (p.landowner?.name ?? '');
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  return [
    '■ 산지관리법 시행규칙 [별지 제7호의4서식]',
    `산지일시사용 [${p.declarationType === '신규' ? '√' : ' '}]신고서 ` +
      `[${p.declarationType === '변경' ? '√' : ' '}]변경신고서 ` +
      `[${p.declarationType === '기간연장' ? '√' : ' '}]기간연장신고서`,
    '',
    '── 신고인 ──────────────────────────────',
    `성명: ${a.name}    생년월일: ${a.birth ?? ''}`,
    `주소: ${a.address ?? ''}    전화번호: ${a.phone ?? ''}`,
    '',
    '── 해당 산지에 대한 권리관계(소유자) ──────',
    `소유자: ${o}`,
    '',
    '── 산지 일시사용 내역 ─────────────────────',
    `소재지: ${s.location}    지번: ${s.parcel}    지목: ${s.landCategory ?? ''}`,
    `면적(㎡)  임업용 ${fmt(s.areaByType?.임업용산지)} · ` +
      `공익용 ${fmt(s.areaByType?.공익용산지)} · ` +
      `준보전 ${fmt(s.areaByType?.준보전산지)}  / 계 ${fmt(s.areaTotal)}`,
    `일시사용 면적: ${fmt(s.tempUseAreaSqm)} ㎡`,
    '',
    `일시사용 목적: ${p.purpose}`,
    `일시사용 기간: ${p.period?.original?.start ?? ''} ~ ${p.period?.original?.end ?? ''}`,
    p.changes ? `변경사항: (전) ${p.changes.before} → (후) ${p.changes.after} / 사유: ${p.changes.reason}` : '',
    '',
    '「산지관리법」 제15조의2제2항·제3항 및 같은 법 시행규칙 제15조의3제1항·제15조의4제2항에 따라',
    `위와 같이 산지일시사용 신고를 합니다.`,
    '',
    `신고일: ${p.declaredDate ?? ''}`,
    `신고인: ${a.name} (서명 또는 인)`,
    `${p.recipient} 귀하`,
    '',
    '─────────────────────────────────────────',
    `[AI 사전검토] 평균경사 ${p.aiReview?.avgSlopeDeg ?? '-'}° · ` +
      `예상재적 ${p.aiReview?.expectedYieldM3 ?? '-'} m³ · ` +
      `인허가 ${p.aiReview?.compliant ? '적합' : '검토필요'}`,
    '※ 데모 모드 텍스트 출력입니다. 백엔드(python-hwpx) 연동 시 .hwpx/.pdf로 반환됩니다.',
  ].filter((l) => l !== null && l !== undefined).join('\n');
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const missing = validate(payload);
  if (missing.length) {
    return Response.json({ error: 'MISSING_FIELDS', missing }, { status: 422 });
  }

  const reportId = makeReportId(payload);
  const backend = process.env.REPORT_BACKEND_URL;

  // 1) 실제 백엔드 연동된 경우 → 프록시 후 파일 스트리밍
  if (backend) {
    try {
      const upstream = await fetch(`${backend.replace(/\/$/, '')}/report/forest-temp-use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, reportId }),
      });
      if (!upstream.ok) {
        return Response.json({ error: 'BACKEND_ERROR', status: upstream.status }, { status: 502 });
      }
      const headers = new Headers();
      headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'application/octet-stream');
      headers.set(
        'Content-Disposition',
        upstream.headers.get('Content-Disposition') ?? `attachment; filename="${reportId}.hwpx"`,
      );
      headers.set('X-Report-Id', reportId);
      headers.set('X-Report-Mode', 'backend');
      return new Response(upstream.body, { status: 200, headers });
    } catch {
      return Response.json({ error: 'BACKEND_UNREACHABLE' }, { status: 502 });
    }
  }

  // 2) 데모 폴백 → 채워진 신고서 텍스트 반환
  const text = renderPlainText(payload);
  const filename = `${FORM_FILENAME(payload)}_${reportId}.txt`;
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'X-Report-Id': reportId,
      'X-Report-Mode': 'demo',
    },
  });
}

function FORM_FILENAME(p) {
  const t = { 신규: '산지일시사용신고서', 변경: '산지일시사용변경신고서', 기간연장: '산지일시사용기간연장신고서' };
  return t[p.declarationType] ?? '산지일시사용신고서';
}
