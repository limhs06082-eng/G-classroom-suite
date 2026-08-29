import { readFileSync } from 'node:fs';

/*
 * 설치 파일을 만들기 전에 참이어야 하는 것들.
 *
 * `docs/gboard-before-release.md`에 글로 적어 둔 것을 여기서 센다. 글로만
 * 두면 다음에 또 켜진다 — 실제로 2판 내내 개발자 도구가 켜져 있었고,
 * 그걸 기억하고 있던 것은 문서 한 줄뿐이었다.
 *
 * `npm run desktop:build`가 이것을 먼저 돌린다. 설치 파일을 만드는 일이
 * 곧 '남에게 줄 수 있는 것'을 만드는 일이라, 막을 자리가 거기다.
 * `tauri dev`는 안 거친다 — 개발 중에 개발자 도구를 켜는 것은 정상이다.
 */

const problems = [];

function fail(what, why) {
  problems.push({ what, why });
}

// ── 1. 개발자 도구가 꺼져 있는가 ─────────────────────────────
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8');
const tauriDep = /^tauri\s*=\s*\{[^}]*\}/m.exec(cargo)?.[0] ?? '';

if (tauriDep === '') {
  fail('Cargo.toml의 tauri 의존성을 못 찾았다', '이 검사가 무엇을 보는지 다시 봐야 한다.');
} else if (tauriDep.includes('devtools')) {
  fail(
    '개발자 도구가 켜져 있다 (src-tauri/Cargo.toml)',
    '켜져 있으면 키보드 앞의 누구나 window.__TAURI__.core.invoke(...)로 파일 삭제 명령을\n' +
      '  화면을 거치지 않고 직접 부를 수 있다. 교실 컴퓨터는 아이들이 앉는 자리다.\n' +
      '  features = [] 로 되돌려라.',
  );
}

// ── 2. CSP가 있는가 ──────────────────────────────────────────
const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const csp = conf.app?.security?.csp;

if (typeof csp !== 'string' || csp.trim() === '') {
  fail(
    'CSP가 비어 있다 (src-tauri/tauri.conf.json)',
    'Tauri에서 csp: null은 "느슨한 CSP"가 아니라 CSP가 아예 없다는 뜻이다.\n' +
      '  학생 이름이 담긴 앱에 방어선이 한 겹도 없는 상태가 된다.',
  );
}

// ── 3. 판 번호가 세 곳에서 같은가 ────────────────────────────
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1] ?? '(없음)';
const versions = {
  'package.json': pkg.version,
  'tauri.conf.json': conf.version,
  'Cargo.toml': cargoVersion,
};
const distinct = new Set(Object.values(versions));

if (distinct.size !== 1) {
  fail(
    '판 번호가 세 곳에서 다르다',
    Object.entries(versions)
      .map(([file, v]) => `  ${file}: ${String(v)}`)
      .join('\n') +
      '\n  설치 파일 이름은 tauri.conf.json을 따르는데, Windows가 덮어쓸지 말지는\n' +
      '  그 번호로 정한다. 셋이 어긋나면 어느 것이 진짜인지 알 수 없다.',
  );
}

// ── 4. 바깥으로 나가는 주소가 아는 것뿐인가 ──────────────────
const capabilities = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'));
const http = capabilities.permissions?.find(
  (p) => typeof p === 'object' && p !== null && p.identifier === 'http:default',
);
const allowed = (http?.allow ?? []).map((entry) => String(entry.url));

/*
 * 실제로 부르는 곳만 열어 둔다. 안 쓰는 주소가 열려 있으면, 개발자 도구든
 * XSS든 그 문으로 학생 이름을 실어 보낼 수 있다. 늘리려면 여기도 함께 고쳐라 —
 * 손이 한 번 더 가는 것이 이 검사의 값어치다.
 */
const EXPECTED_HOSTS = ['https://open.neis.go.kr/*', 'https://api.open-meteo.com/*'];

const unexpected = allowed.filter((url) => !EXPECTED_HOSTS.includes(url));
const missing = EXPECTED_HOSTS.filter((url) => !allowed.includes(url));

if (unexpected.length > 0) {
  fail('모르는 주소가 열려 있다', unexpected.map((u) => `  ${u}`).join('\n'));
}
if (missing.length > 0) {
  fail('있어야 할 주소가 없다', missing.map((u) => `  ${u}`).join('\n'));
}

// ── 결과 ─────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`배포 전 검사 이상 없습니다. 판 ${String(pkg.version)} · 바깥 주소 ${String(allowed.length)}곳.`);
  process.exit(0);
}

console.error(`배포 전 검사에서 ${String(problems.length)}가지가 걸렸습니다.\n`);
for (const { what, why } of problems) {
  console.error(`✗ ${what}`);
  console.error(`  ${why}\n`);
}
process.exit(1);
