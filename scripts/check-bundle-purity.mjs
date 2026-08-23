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
 * 표지자는 __TAURI_INTERNALS__ 하나다.
 *
 * 이것은 Tauri API 모듈이 저마다 지고 다니는 IPC 다리라, 모듈이 번들에
 * 실리면 반드시 나오고 안 실리면 절대 안 나온다. 딱 그 질문에만 답한다.
 *
 * readTextFile·writeTextFile·onCloseRequested를 표지자로 쓰면 안 된다.
 * 그건 우리 소스가 부르는 이름이라, external로 Tauri를 통째로 빼내도
 * 우리 코드 쪽에 그대로 남는다. 실제로 main.tsx의
 * `currentWindow.onCloseRequested(...)`가 그렇게 걸렸다 — 죽은 글자인데
 * 검사만 붉게 만들었다.
 *
 * 맨 특정자(`import("@tauri-apps/api/window")`)도 같은 이유로 표지자가
 * 아니다. external을 쓰면 나오는 것이 정상이고, 실행되지 않는다.
 *
 *   node scripts/check-bundle-purity.mjs web
 *   node scripts/check-bundle-purity.mjs desktop
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

const ASSETS_DIR = 'dist/assets';
const MAX_WEB_BYTES = 400 * 1024;

// invoke 브리지 — Tauri API 모듈이면 반드시 지니고, 아니면 절대 없다.
const MARKER = '__TAURI_INTERNALS__';

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

const foundIn = [];
let largest = { file: null, size: 0 };

for (const file of files) {
  const size = statSync(file).size;
  if (size > largest.size) largest = { file, size };

  const text = readFileSync(file, 'utf8');
  if (text.includes(MARKER)) foundIn.push(file);
}

const largestKb = (largest.size / 1024).toFixed(1);
const largestLabel = largest.file ? `${largest.file} (${largestKb}KB)` : '(청크 없음)';

const problems = [];

if (target === 'web') {
  for (const file of foundIn) {
    problems.push(`"${MARKER}"가 ${file}에 있습니다 — Tauri 런타임이 웹 번들에 실렸습니다`);
  }
  if (largest.size > MAX_WEB_BYTES) {
    problems.push(`가장 큰 청크가 ${largestKb}KB로 400KB 한도를 넘었습니다 (${largest.file})`);
  }
} else {
  if (foundIn.length === 0) {
    problems.push(
      `${MARKER}가 어디에도 없습니다 — 설치형 분기가 두 빌드 모두에서 죽은 코드로 ` +
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
