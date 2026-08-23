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
 * 표지자는 둘 다 Tauri 자신의 코드에만 있는 문자열이다. 식별자는 축약되어
 * 사라지지만 문자열 리터럴은 남으므로, 번들을 열어 보면 그대로 걸린다.
 *
 * __TAURI_INTERNALS__   IPC 다리. 명령을 부르는 모듈이면 반드시 지고 있다.
 * __TAURI_TO_IPC_KEY__  core.js의 상수. dpi처럼 명령을 아예 안 부르는
 *                       모듈이 있어서 필요하다 — dpi.js에는 __TAURI_INTERNALS__가
 *                       하나도 없고, core에서 이 상수 하나만 가져온다.
 *                       그 상태로 실리면 첫 표지자만으로는 못 잡는다.
 *
 * readTextFile·writeTextFile·onCloseRequested를 표지자로 쓰면 안 된다.
 * 그건 우리 소스가 부르는 이름이라, external로 Tauri를 통째로 빼내도
 * 우리 코드 쪽에 그대로 남는다. 실제로 main.tsx의
 * `currentWindow.onCloseRequested(...)`가 그렇게 걸려 검사만 붉게 만들었다.
 *
 * 맨 특정자(`import("@tauri-apps/api/window")`)도 표지자가 아니다.
 * external을 쓰면 나오는 것이 정상이고, 실행되지 않는다.
 *
 * 설치형 쪽은 __TAURI_INTERNALS__만 본다. 다리가 실제로 실렸는지가
 * 확인할 것이지, 상수 하나가 딸려 왔는지가 아니다.
 *
 *   node scripts/check-bundle-purity.mjs web
 *   node scripts/check-bundle-purity.mjs desktop
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

const ASSETS_DIR = 'dist/assets';
const MAX_WEB_BYTES = 400 * 1024;

const TAURI_INTERNALS = '__TAURI_INTERNALS__';
const TAURI_TO_IPC_KEY = '__TAURI_TO_IPC_KEY__';

// 웹에서는 둘 다 없어야 한다. 설치형에서는 IPC 다리 자체가 실렸는지만 본다.
const WEB_MARKERS = [TAURI_INTERNALS, TAURI_TO_IPC_KEY];

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

// 표지자별로 어느 파일에서 나왔는지 모은다.
const foundIn = new Map([TAURI_INTERNALS, TAURI_TO_IPC_KEY].map((marker) => [marker, []]));
let largest = { file: null, size: 0 };

for (const file of files) {
  const size = statSync(file).size;
  if (size > largest.size) largest = { file, size };

  const text = readFileSync(file, 'utf8');
  for (const marker of foundIn.keys()) {
    if (text.includes(marker)) foundIn.get(marker).push(file);
  }
}

const largestKb = (largest.size / 1024).toFixed(1);
const largestLabel = largest.file ? `${largest.file} (${largestKb}KB)` : '(청크 없음)';

const problems = [];

if (target === 'web') {
  for (const marker of WEB_MARKERS) {
    for (const file of foundIn.get(marker)) {
      problems.push(`"${marker}"가 ${file}에 있습니다 — Tauri 런타임이 웹 번들에 실렸습니다`);
    }
  }
  if (largest.size > MAX_WEB_BYTES) {
    problems.push(`가장 큰 청크가 ${largestKb}KB로 400KB 한도를 넘었습니다 (${largest.file})`);
  }
} else {
  if (foundIn.get(TAURI_INTERNALS).length === 0) {
    problems.push(
      `${TAURI_INTERNALS}가 어디에도 없습니다 — 설치형 분기가 두 빌드 모두에서 죽은 코드로 ` +
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
