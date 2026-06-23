// 백엔드 URL 해석 — BFF 라우트 공통 헬퍼
//
// 프로덕션 배포 시 환경변수가 하나만 설정돼도 동작하도록 여러 이름을 모두 허용하고,
// 프로토콜(https://)이 빠진 값, 복사-붙여넣기로 섞여 들어간 따옴표/공백/제어문자도 정규화한다.
//   - "Failed to parse URL" 오류: 값이 절대 URL이 아니면(프로토콜 누락·공백 혼입) fetch가 실패
//   - 라우트별 env 이름 불일치: BACKEND_URL 하나만 설정해도 모든 라우트가 같은 곳을 바라보게 함

export function resolveBackendUrl(...envNames) {
  let raw = '';
  // 우선순위: 라우트 전용 변수 → 공통 BACKEND_URL
  for (const name of [...envNames, 'BACKEND_URL']) {
    const v = process.env[name];
    if (v && v.trim()) { raw = v; break; }
  }

  // URL에는 공백/개행/탭이 없으므로 전부 제거 → 양끝 따옴표 제거
  raw = raw.replace(/\s+/g, '').replace(/^['"]+|['"]+$/g, '');

  if (!raw) raw = 'http://localhost:8000';

  // 프로토콜 누락 보정 (예: "api.example.com" -> "https://api.example.com")
  if (!/^https?:\/\//i.test(raw)) {
    const isLocal = /^(localhost|127\.0\.0\.1)/.test(raw);
    raw = (isLocal ? 'http://' : 'https://') + raw;
  }

  return raw.replace(/\/$/, '');
}
