import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * 설치 파일을 만들기 전에 참이어야 하는 것들.
 *
 * `docs/gboard-before-release.md`에 글로 적어 둔 것을 여기서 센다. 글로만
 * 두면 다음에 또 켜진다 — 실제로 2판 내내 개발자 도구가 켜져 있었고,
 * 그걸 기억하고 있던 것은 문서 한 문단뿐이었다.
 *
 * `tauri.conf.json`의 `beforeBuildCommand`가 이것을 먼저 돌린다. `package.json`의
 * `desktop:build`에만 두면 `npx tauri build`·`cargo tauri build`·GitHub Actions의
 * `tauri-action`이 전부 검사를 건너뛴다. 빌드 훅에 두면 **tauri CLI를 거치는
 * 모든 길**이 여기를 지나간다.
 *
 * `tauri dev`는 `beforeDevCommand`를 쓰므로 안 걸린다 — 개발 중에 개발자
 * 도구를 켜는 것은 정상이다.
 */

const problems = [];

function fail(what, why) {
  problems.push({ what, why });
}

// ── 0. 디버그 빌드인가 ───────────────────────────────────────
/*
 * **feature를 꺼도 디버그 빌드에는 개발자 도구가 산다.** Tauri는
 * `debug_assertions`가 켜지면 feature와 무관하게 devtools를 켠다. 그래서
 * `tauri build --debug`는 아래 1번 검사를 초록불로 통과하면서 콘솔이
 * 살아 있는 설치본을 만든다 — 그리고 초록불이 떴으니 오히려 안심하고
 * 건네게 된다. **검사가 있어서 더 위험해지는 자리다.**
 *
 * Tauri가 빌드 훅에 `TAURI_ENV_DEBUG`를 넘겨준다. 그 변수가 없으면 사람이
 * 이 검사를 직접 돌린 것이므로 넘어간다.
 */
if (process.env.TAURI_ENV_DEBUG === 'true') {
  fail(
    '디버그 빌드다 (--debug)',
    [
      '  디버그 빌드에는 features와 무관하게 개발자 도구가 살아 있고, 검은 명령창도 함께 뜬다.',
      '  남에게 줄 것은 --debug 없이 만든다. 버그를 재현해야 하면 tauri dev를 쓴다.',
    ].join('\n'),
  );
}

// ── 1. 개발자 도구 feature가 꺼져 있는가 ─────────────────────
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8');
const tauriDep = /^tauri\s*=\s*\{[^}]*\}/m.exec(cargo)?.[0] ?? '';

if (tauriDep === '') {
  fail('Cargo.toml의 tauri 의존성을 못 찾았다', '  이 검사가 무엇을 보는지 다시 봐야 한다.');
} else if (tauriDep.includes('devtools')) {
  fail(
    '개발자 도구가 켜져 있다 (src-tauri/Cargo.toml)',
    [
      '  켜져 있으면 키보드 앞의 누구나 window.__TAURI__.core.invoke(...)로 파일 삭제 명령을',
      '  화면을 거치지 않고 직접 부를 수 있다. 교실 컴퓨터는 아이들이 앉는 자리다.',
      '  features = [] 로 되돌려라.',
    ].join('\n'),
  );
}

// ── 2. CSP가 있고, 넓지 않은가 ───────────────────────────────
const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const csp = conf.app?.security?.csp;

if (typeof csp !== 'string' || csp.trim() === '') {
  fail(
    'CSP가 비어 있다 (src-tauri/tauri.conf.json)',
    [
      '  Tauri에서 csp: null은 "느슨한 CSP"가 아니라 CSP가 아예 없다는 뜻이다.',
      '  학생 이름이 담긴 앱에 방어선이 한 겹도 없는 상태가 된다.',
    ].join('\n'),
  );
} else if (csp.includes('*') || csp.includes('unsafe-eval')) {
  /*
   * 있기만 하면 되는 것이 아니다. `script-src 'self' *`도 글자로는 통과하므로,
   * 방어선이 있다고 여기면서 실은 아무것도 안 막는 상태가 된다.
   */
  fail(
    'CSP가 너무 넓다 (src-tauri/tauri.conf.json)',
    "  '*'나 'unsafe-eval'이 들어 있으면 CSP가 있어도 막는 것이 거의 없다.",
  );
}

// ── 3. 판 번호가 어긋나지 않는가 ─────────────────────────────
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1] ?? '(없음)';
const versions = {
  'package.json': pkg.version,
  'tauri.conf.json': conf.version,
  'Cargo.toml': cargoVersion,
};

if (new Set(Object.values(versions)).size !== 1) {
  fail(
    '판 번호가 세 곳에서 다르다',
    [
      ...Object.entries(versions).map(([file, v]) => `  ${file}: ${String(v)}`),
      '  설치 파일 이름은 tauri.conf.json을 따르는데, Windows가 기존 설치를 덮어쓸지',
      '  말지도 그 번호로 정한다. 어긋나면 덮어쓰기가 조용히 안 된다.',
    ].join('\n'),
  );
}

/*
 * 태그를 붙여 미는 길에서는 태그와도 맞아야 한다. GitHub Actions가
 * `RELEASE_TAG`로 넘겨준다. 안 맞으면 `G-board v0.7.0`이라는 이름의
 * 릴리스에 `G-board_0.6.0_x64-setup.exe`가 담긴다 — 받는 분이 덮어씌워도
 * Windows가 같은 판으로 보고 아무 일도 안 한다.
 */
const tag = process.env.RELEASE_TAG ?? '';
if (tag !== '' && tag.replace(/^v/, '') !== String(conf.version)) {
  fail('태그와 판 번호가 다르다', `  태그 ${tag} · tauri.conf.json ${String(conf.version)}`);
}

// ── 4. 바깥으로 나가는 문이 아는 것뿐인가 ────────────────────
/*
 * 폴더 전부를 본다. Tauri는 `capabilities/` 아래 **모든** 파일을 읽으므로,
 * 무엇을 시험하려고 만든 `dev.json` 하나가 잊혀 남아 있으면 그것도 그대로
 * 권한이 된다. `default.json`만 보면 검사가 "바깥 주소 2곳"이라고 말하는
 * 동안 세 번째 문이 열려 있을 수 있다.
 */
const capDir = 'src-tauri/capabilities';
const capFiles = readdirSync(capDir).filter((name) => name.endsWith('.json'));
const allowed = [];
const permissionIds = [];

for (const name of capFiles) {
  const cap = JSON.parse(readFileSync(join(capDir, name), 'utf8'));
  for (const permission of cap.permissions ?? []) {
    if (typeof permission === 'string') {
      permissionIds.push(permission);
      continue;
    }
    if (typeof permission !== 'object' || permission === null) continue;

    permissionIds.push(String(permission.identifier));
    if (permission.identifier !== 'http:default') continue;
    for (const entry of permission.allow ?? []) allowed.push(String(entry.url));
  }
}

/*
 * 실제로 부르는 곳만 열어 둔다. 안 쓰는 주소가 열려 있으면, 개발자 도구든
 * XSS든 그 문으로 학생 이름을 실어 보낼 수 있다. 늘리려면 여기도 함께
 * 고쳐라 — 손이 한 번 더 가는 것이 이 검사의 값어치다.
 */
const EXPECTED_HOSTS = ['https://open.neis.go.kr/*', 'https://api.open-meteo.com/*'];

const unexpectedHosts = allowed.filter((url) => !EXPECTED_HOSTS.includes(url));
const missingHosts = EXPECTED_HOSTS.filter((url) => !allowed.includes(url));

if (unexpectedHosts.length > 0) {
  fail('모르는 주소가 열려 있다', unexpectedHosts.map((u) => `  ${u}`).join('\n'));
}
if (missingHosts.length > 0) {
  fail('있어야 할 주소가 없다', missingHosts.map((u) => `  ${u}`).join('\n'));
}

/*
 * 권한 자체도 센다. 주소만 보면 `shell:allow-execute`가 `fs:allow-remove`
 * 옆에 조용히 늘어나도 모른다. 늘릴 일이 있으면 여기 적으면서 한 번 더
 * 생각하게 하는 것이 목적이다.
 */
const EXPECTED_PERMISSIONS = [
  'core:default',
  'core:webview:allow-create-webview-window',
  'core:window:allow-destroy',
  'core:window:allow-close',
  'core:window:allow-set-focus',
  'core:window:allow-set-fullscreen',
  'core:window:allow-set-position',
  'fs:allow-appdata-read-recursive',
  'fs:allow-appdata-write-recursive',
  // 아래 넷은 FileBackedStorage의 원자적 쓰기가 쓴다 — 임시 파일에 쓰고
  // 이름을 바꿔 치우는 길이라, 폴더 만들기·이름 바꾸기·있는지 보기·지우기가
  // 다 필요하다. 이 검사를 처음 돌렸을 때 셋을 내가 몰랐다는 것이 드러났다.
  'fs:allow-mkdir',
  'fs:allow-rename',
  'fs:allow-exists',
  'fs:allow-remove',
  'http:default',
  'log:default',
];

const unexpectedPermissions = permissionIds.filter((id) => !EXPECTED_PERMISSIONS.includes(id));

if (unexpectedPermissions.length > 0) {
  fail(
    '모르는 권한이 열려 있다',
    [
      ...unexpectedPermissions.map((id) => `  ${id}`),
      '  정말 필요하면 scripts/check-release.mjs의 EXPECTED_PERMISSIONS에 함께 적어라.',
    ].join('\n'),
  );
}

// ── 결과 ─────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(
    `배포 전 검사 이상 없습니다. 판 ${String(pkg.version)} · ` +
      `권한 파일 ${String(capFiles.length)}개 · 권한 ${String(permissionIds.length)}개 · ` +
      `바깥 주소 ${String(allowed.length)}곳.`,
  );
  process.exit(0);
}

console.error(`배포 전 검사에서 ${String(problems.length)}가지가 걸렸습니다.\n`);
for (const { what, why } of problems) {
  console.error(`✗ ${what}`);
  console.error(`${why}\n`);
}
process.exit(1);
