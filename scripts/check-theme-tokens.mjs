/**
 * 테마 셋이 같은 변수 집합을 덮는지, 중립 눈금이 뜻한 방향으로 놓였는지 본다.
 *
 * 시험으로는 못 잡는 두 흠이 있다.
 *
 * 1. **빠진 변수.** 한 테마만 `--color-slate-400`을 빠뜨리면 그 테마에서
 *    그 눈금 하나만 `@theme`의 기본값으로 남는다. 어두운 테마라면 뒤집힌
 *    눈금 한복판에 밝은 회색 한 단계가 박히는 것인데, 열 단계 중 하나가
 *    어긋난 것을 눈으로 골라내기는 어렵다. 화면 시험으로도 안 잡힌다 —
 *    색이 CSS 변수라 jsdom에서는 계산된 값이 안 나온다.
 *
 * 2. **뒤집힌 눈금.** 어두운 테마는 50이 가장 어둡고 900이 가장 밝아야
 *    하고, 나머지 둘은 그 반대여야 한다. 한 블록의 값을 다른 블록에
 *    복사해 붙이면 변수 이름은 하나도 안 빠지므로 1번 검사는 통과하는데,
 *    어두운 테마가 조용히 밝은 테마가 된다. 앞 과제에서 `.ink`가 꼭 이
 *    모양으로 거꾸로 들어갈 뻔했다. 이름을 세는 것만으로는 모자란다.
 *
 * 방향은 아래 표에 적어 둔다. 새 테마를 더하면서 방향을 안 정하면 검사가
 * 멈춘다 — 어느 쪽이어야 하는지는 사람이 정할 일이지 짐작할 일이 아니다.
 *
 *   node scripts/check-theme-tokens.mjs
 */
import { readFileSync } from 'node:fs';

const CSS_PATH = 'src/index.css';

/**
 * 테마마다 중립 눈금이 놓이는 방향.
 *
 * `descending` 이면 번호가 커질수록 어둡다(밝은 화면). `ascending` 이면
 * 반대다(어두운 화면). `밝게`는 `:root`의 기본값이라 블록이 없다.
 */
const NEUTRAL_DIRECTION = {
  warm: 'descending',
  dark: 'ascending',
  contrast: 'descending',
};

/** 주석은 걷어 낸다. 주석 처리한 선언은 지운 것과 같다. */
function withoutComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * `[data-theme='...'] { ... }` 덩어리를 테마 id별로 모은다.
 *
 * `:root`가 붙어 있어도 읽는다. 지금 CSS는 뿌리에 안 매어 두었지만(설정의
 * '화면' 탭이 미리보기 조각에 같은 속성을 붙여 쓴다), 이 검사는 어느 쪽이든
 * 변수 집합과 눈금 방향을 봐야 한다. 못 읽으면 블록이 하나도 없다고 잘못 말한다.
 */
function themeBlocks(css) {
  const blocks = new Map();
  const opener = /(?::root)?\[data-theme='([a-z-]+)'\]\s*\{/g;
  let found;
  while ((found = opener.exec(css)) !== null) {
    const closed = css.indexOf('}', found.index);
    if (closed === -1) continue;
    blocks.set(found[1], css.slice(found.index + found[0].length, closed));
  }
  return blocks;
}

/** 한 덩어리가 덮는 `--color-*` 이름들. */
function colorNames(block) {
  return new Set([...block.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
}

/**
 * `oklch(...)`의 명도. `98.4%`도 `0.984`도 같은 값으로 읽는다.
 *
 * 값이 아니라 **차례**를 보려는 것이라 이 한 숫자면 된다.
 */
function lightness(declaration) {
  const found = /oklch\(\s*([0-9.]+)(%?)/.exec(declaration);
  if (found === null) return Number.NaN;
  const raw = Number(found[1]);
  return found[2] === '%' ? raw / 100 : raw;
}

/** 한 덩어리의 `--color-slate-*`를 번호 순으로. */
function neutralSteps(block) {
  return [...block.matchAll(/--color-slate-(\d+)\s*:([^;]+);/g)]
    .map((match) => ({ step: Number(match[1]), light: lightness(match[2]) }))
    .sort((a, b) => a.step - b.step);
}

const css = withoutComments(readFileSync(CSS_PATH, 'utf8'));
const blocks = themeBlocks(css);
const problems = [];

if (blocks.size === 0) {
  problems.push(`${CSS_PATH}에 :root[data-theme='...'] 블록이 하나도 없습니다.`);
}

/*
 * 이름 집합을 견준다. 어느 하나를 기준으로 삼는 게 아니라 **합집합**과 견준다.
 * 기준을 하나로 잡으면 그 기준에서 빠진 변수는 셋 모두에서 빠져도 조용하다.
 */
const union = new Set();
const perTheme = new Map();
for (const [id, block] of blocks) {
  const names = colorNames(block);
  perTheme.set(id, names);
  for (const name of names) union.add(name);
}
for (const [id, names] of perTheme) {
  const missing = [...union].filter((name) => !names.has(name)).sort();
  if (missing.length > 0) {
    problems.push(`'${id}' 테마에 없는 변수 ${missing.length}개: ${missing.join(', ')}`);
  }
}

// 눈금 방향
for (const [id, block] of blocks) {
  const want = NEUTRAL_DIRECTION[id];
  if (want === undefined) {
    problems.push(
      `'${id}' 테마의 중립 눈금 방향이 정해져 있지 않습니다. ` +
        `${import.meta.url.split('/').pop()}의 NEUTRAL_DIRECTION에 적으세요.`,
    );
    continue;
  }
  const steps = neutralSteps(block);
  if (steps.length === 0) {
    problems.push(`'${id}' 테마에 --color-slate-* 가 하나도 없습니다.`);
    continue;
  }
  const wrong = steps
    .slice(1)
    .filter((entry, index) => {
      const previous = steps[index]?.light ?? Number.NaN;
      return want === 'ascending' ? !(entry.light > previous) : !(entry.light < previous);
    })
    .map((entry) => `slate-${entry.step}`);
  if (wrong.length > 0) {
    problems.push(
      `'${id}' 테마의 중립 눈금이 ${want === 'ascending' ? '오름차(50이 가장 어둡다)' : '내림차(50이 가장 밝다)'}가 ` +
        `아닙니다. 어긋난 단계: ${wrong.join(', ')}`,
    );
  }
}

// 방향 표에만 있고 CSS에는 없는 테마 — 블록을 통째로 빠뜨린 경우다.
for (const id of Object.keys(NEUTRAL_DIRECTION)) {
  if (!blocks.has(id)) problems.push(`'${id}' 테마 블록이 ${CSS_PATH}에 없습니다.`);
}

if (problems.length === 0) {
  const ids = [...blocks.keys()].join(', ');
  console.log(`테마 토큰 이상 없습니다. 테마 ${blocks.size}개(${ids}) · 변수 ${union.size}개씩.`);
} else {
  console.error('테마 토큰에 문제가 있습니다:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
