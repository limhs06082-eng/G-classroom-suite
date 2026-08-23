/**
 * 번들에 Tauri 런타임이 있어야 할 자리에 있는지, 없어야 할 자리에서 빠지지 않았는지 본다.
 *
 * 타입 검사도, 테스트도, 빌드도 초록불인데 실제 산출물은 어긋날 수 있다. Task 6에서
 * 실물로 겪었다 — 웹 번들에 Tauri 런타임이 실려 있었고(다운로드 낭비, 죽은 코드가
 * 그대로 배포됨), 그걸 external로 고치는 과정에서 이번엔 설치형에서 같은 부류의 사고가
 * 날 수 있다는 것도 드러났다: isDesktop() 분기가 청크 경계를 넘으면 Rollup이 상수로
 * 접지 못해 동적 import 전체가 죽은 코드로 지워질 수 있는데, 이게 **설치형** 쪽에서
 * 일어나면 파일 저장소가 통째로 사라지고 앱은 아무 경고 없이 브라우저 저장소로
 * 조용히 떨어진다 — 교사는 껐다 켤 때마다 자료를 잃는다. grep 한 번 깜빡하는 사람에게
 * 맡기지 않고 검증 파이프라인에 못 박아 둔다.
 *
 * 표시자는 실제 Tauri 런타임 코드의 흔적이다. IPC 경계를 문자열로 건너가야 해서
 * minify를 거쳐도 이름이 그대로 남는다:
 *   - __TAURI_INTERNALS__      : invoke 브리지 (@tauri-apps/api/core)
 *   - readTextFile/writeTextFile : @tauri-apps/plugin-fs
 *   - onCloseRequested         : @tauri-apps/api/window
 *
 * `import("@tauri-apps/api/window")`처럼 맨 스펙(bare specifier)만 남은 동적 import는
 * 표시자로 세지 않는다. vite.config.ts의 external 처리로 웹 빌드에서 의도적으로 남기는
 * 흔적이고, isDesktop()이 항상 거짓인 웹에서는 절대 실행되지 않는 죽은 코드다. 나중에
 * 이 검사를 "더 엄격하게" 만들려고 bare import 문자열까지 표시자에 넣으면 웹 빌드가
 * 매번 실패한다 — 넣지 말 것.
 *
 *   node scripts/check-bundle-purity.mjs web
 *   node scripts/check-bundle-purity.mjs desktop
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

const ASSETS_DIR = 'dist/assets';
const MAX_WEB_BYTES = 400 * 1024;

// IPC 경계를 문자열로 건너가야 해서 minify에도 살아남는, 진짜 Tauri 런타임의 흔적.
const MARKERS = ['__TAURI_INTERNALS__', 'readTextFile', 'writeTextFile', 'onCloseRequested'];

const target = process.argv[2];
if (target !== 'web' && target !== 'desktop') {
  console.error('사용법: node scripts/check-bundle-purity.mjs <web|desktop>');
  process.exit(2);
}

if (!existsSync(ASSETS_DIR)) {
  console.error(`${ASSETS_DIR}가 없습니다. 먼저 빌드하세요 (npm run build 또는 npm run build:desktop).`);
  process.exit(2);
}

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = listJsFiles(ASSETS_DIR);

// 표시자별로 어느 파일에서 나왔는지 모은다.
const foundIn = new Map(MARKERS.map((marker) => [marker, []]));
let largest = { file: null, size: 0 };

for (const file of files) {
  const size = statSync(file).size;
  if (size > largest.size) largest = { file, size };

  const text = readFileSync(file, 'utf8');
  for (const marker of MARKERS) {
    if (text.includes(marker)) foundIn.get(marker).push(file);
  }
}

const largestKb = (largest.size / 1024).toFixed(1);
const largestLabel = largest.file ? `${largest.file} (${largestKb}KB)` : '(청크 없음)';

const problems = [];

if (target === 'web') {
  for (const marker of MARKERS) {
    for (const file of foundIn.get(marker)) {
      problems.push(`"${marker}"가 ${file}에 있습니다 — Tauri 런타임이 웹 번들에 실렸습니다`);
    }
  }
  if (largest.size > MAX_WEB_BYTES) {
    problems.push(`가장 큰 청크가 ${largestKb}KB로 400KB 한도를 넘었습니다 (${largest.file})`);
  }
} else {
  if (foundIn.get('__TAURI_INTERNALS__').length === 0) {
    problems.push(
      '__TAURI_INTERNALS__가 어디에도 없습니다 — 설치형 분기가 두 빌드 모두에서 죽은 코드로 ' +
        '지워졌다는 뜻입니다. 이 상태로는 파일 저장소가 아니라 브라우저 저장소로 조용히 ' +
        '떨어져, 껐다 켤 때마다 자료를 잃습니다.',
    );
  }
}

if (problems.length === 0) {
  console.log(`${target} 번들 이상 없습니다. 가장 큰 청크: ${largestLabel}`);
} else {
  console.error(`${target} 번들에 문제가 있습니다:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`가장 큰 청크: ${largestLabel}`);
  process.exit(1);
}
