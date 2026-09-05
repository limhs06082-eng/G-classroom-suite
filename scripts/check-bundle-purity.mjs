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
 * 설치형에는 형성평가 코드가 없어야 한다.
 *
 * 학생 폰이 들어올 서버가 없어 뺀 기능이다(Task 8). 라우트를 감추는
 * import.meta.env.VITE_TARGET 조건이 하나라도 되돌아가면 청크가
 * 되살아나는데, 시험은 그걸 못 잡는다 — 시험이 도는 환경은 늘 웹이기
 * 때문이다(VITE_TARGET을 안 준 채로 돈다). 결과물을 직접 열어 봐야 한다.
 *
 * 클래스·인터페이스 이름(QuizSessionRelay·LocalSessionRelay)만으로는
 * 못 잡는 경우가 있다는 것을 직접 되돌려 확인했다: quiz 라우트 하나만
 * 되살리면(join·QuizBoard는 그대로 가려진 채) QuizSessionRelay.ts를
 * 부르는 곳이 QuizPage 하나뿐이 되어, Rollup이 그 코드를 별도 청크로
 * 안 쪼개고 QuizPage 청크 안으로 그대로 합친다. 그러면 청크 경계를
 * 넘는 import 문(파일명 문자열)이 없어지고, 클래스 이름은 그냥 지역
 * 식별자가 되어 축약 과정에서 다른 이름으로 바뀐다 — 위 Tauri
 * 표지자와 같은 이유(식별자는 축약되지만 문자열 리터럴은 남는다)로,
 * LocalSessionRelay가 쓰는 저장소 키('teacher-toolkit:v1:quiz-sessions')를
 * 함께 봐야 어느 쪽으로 청크가 갈리든 잡을 수 있다.
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

/*
 * 설치형에서는 이 넷이 있으면 안 된다 — 학생 참여 통로(형성평가) 코드다.
 *
 * 앞의 둘은 식별자라 QuizSessionRelay.ts가 별도 청크로 갈릴 때만(여러
 * 곳에서 불릴 때) 청크 경계를 넘는 import 문의 파일명으로 남는다.
 * 마지막 하나는 LocalSessionRelay.ts의 저장소 키 문자열 리터럴이라,
 * 그 코드가 어느 청크에 어떤 모양으로 실리든(별도 청크든 다른 청크에
 * 합쳐지든) 축약되지 않고 그대로 남는다 — 실제로 되돌려 보니 이
 * 마지막 표지자만 모든 경우를 잡았다.
 */
const DESKTOP_FORBIDDEN = [
  'QuizSessionRelay',
  'LocalSessionRelay',
  'teacher-toolkit:v1:quiz-sessions',
  // 학급 게시판 학생 화면(joinStore.ts의 저장소 키). 교사 화면·Firebase 구현은 설치형에도 산다.
  'classroom-suite:v1:classboard-join',
];

// 파일 하나를 훑어 표지자별로 있는지 없는지 모을 때 쓰는 전체 표지자 목록.
const ALL_MARKERS = [TAURI_INTERNALS, TAURI_TO_IPC_KEY, ...DESKTOP_FORBIDDEN];

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
const foundIn = new Map(ALL_MARKERS.map((marker) => [marker, []]));
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
  for (const marker of DESKTOP_FORBIDDEN) {
    for (const file of foundIn.get(marker)) {
      problems.push(
        `"${marker}"가 ${file}에 있습니다 — 형성평가(학생 참여 통로) 코드가 설치형 ` +
          '번들에 실렸습니다. router.tsx나 BoardPage.tsx의 VITE_TARGET 조건이 되돌아간 ' +
          '것은 아닌지 확인하세요.',
      );
    }
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
