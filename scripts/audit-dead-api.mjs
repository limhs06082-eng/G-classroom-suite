import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * 묶음 3·4에서 찾은 결함은 필드 검사로 안 잡혔다.
 *
 *   Assignment.description — 모달이 입력은 받는데 보여 주는 곳이 없었다
 *   Submission.note        — setNote가 훅에 있는데 부르는 화면이 없었다
 *   Assignment.status      — updateAssignment가 있는데 부르는 곳이 없었다
 *   ScoreGoal.startDate    — 저장은 되는데 계산이 읽지 않았다
 *
 * 셋은 "훅에 있는데 아무도 안 부르는 것", 하나는 "쓰기만 하고 안 읽는 것"이다.
 * 두 가지를 따로 찾는다.
 */

const root = process.argv[2];

function walk(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const all = walk(join(root, 'src'));
const read = (f) => readFileSync(f, 'utf8');

// ── 1. 훅이 내주는데 아무도 안 부르는 것 ──────────────────────
console.log('── 훅에 있는데 부르는 곳이 없는 것 ──');

const hookFiles = all.filter((f) => /use[A-Z]\w*\.ts$/.test(basename(f)));
let deadApi = 0;

for (const hookFile of hookFiles) {
  const src = read(hookFile);

  // 그 파일이 export하는 ...View 인터페이스의 멤버를 뽑는다
  const members = [];
  const iface = /export interface \w*View\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = iface.exec(src)) !== null) {
    for (const line of m[1].split('\n')) {
      const f = /^\s*(?:readonly\s+)?(\w+)\??\s*:/.exec(line);
      if (f !== null) members.push(f[1]);
    }
  }
  if (members.length === 0) continue;

  // 그 훅 파일을 뺀 나머지 전부에서 `.member` 를 찾는다
  const others = all.filter((f) => f !== hookFile);
  const blob = others.map(read).join('\n');

  const unused = members.filter((name) => !new RegExp(`\\.${name}\\b`).test(blob));
  if (unused.length > 0) {
    deadApi += unused.length;
    console.log(`  ${hookFile.replace(root + '\\', '').replace(/\\/g, '/')}`);
    for (const name of unused) console.log(`      ${name}`);
  }
}
if (deadApi === 0) console.log('  없음');

// ── 2. 쓰기만 하고 안 읽는 필드 ───────────────────────────────
console.log('\n── 저장은 되는데 읽는 곳이 없는 필드 ──');

const typesSrc = read(join(root, 'src/shared/domain/types.ts'));
const fields = new Map();
const iface2 = /export interface (\w+)\s*\{([\s\S]*?)\n\}/g;
let m2;
while ((m2 = iface2.exec(typesSrc)) !== null) {
  for (const line of m2[2].split('\n')) {
    const f = /^\s*(?:readonly\s+)?(\w+)\??\s*:/.exec(line);
    if (f === null) continue;
    if (!fields.has(f[1])) fields.set(f[1], new Set());
    fields.get(f[1]).add(m2[1]);
  }
}

// 도메인·저장 계층은 뺀다. 거기선 당연히 읽고 쓴다.
const consumers = all.filter(
  (f) => !/[\\/]shared[\\/](domain|storage|migration)[\\/]/.test(f),
);
const blob = consumers.map(read).join('\n');

const writeOnly = [];
for (const [field, owners] of fields) {
  // `.field` 로 읽는 곳이 하나도 없는데 `field:` 로 쓰는 곳은 있는 경우
  const isRead = new RegExp(`\\.${field}\\b`).test(blob);
  const isWritten = new RegExp(`\\b${field}\\s*:`).test(blob);
  if (!isRead && isWritten) writeOnly.push(`${field}  ←  ${[...owners].join(', ')}`);
}

console.log(writeOnly.length === 0 ? '  없음' : `  ${writeOnly.join('\n  ')}`);
