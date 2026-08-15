import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const typesRel = process.argv[3];

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

// ── 인터페이스 필드 뽑기 ──────────────────────────────────────
const src = readFileSync(join(root, typesRel), 'utf8');
const fields = new Map(); // field -> Set<interface>
const iface = /export interface (\w+)\s*\{([\s\S]*?)\n\}/g;
let m;
while ((m = iface.exec(src)) !== null) {
  const name = m[1];
  for (const line of m[2].split('\n')) {
    const f = /^\s*(?:readonly\s+)?(\w+)\??\s*:/.exec(line);
    if (f === null) continue;
    if (!fields.has(f[1])) fields.set(f[1], new Set());
    fields.get(f[1]).add(name);
  }
}

// ── 화면·기능 코드만 본다. 도메인·저장 계층은 제외 ────────────
const screenDirs = [
  'src/features',
  'src/app',
  'src/shared/state',
  'src/shared/ui',
  'src/shared/roster',
  'src/shared/setup',
];
const files = screenDirs.flatMap((d) => walk(join(root, d)));
const blob = files.map((f) => readFileSync(f, 'utf8')).join('\n');

const dead = [];
for (const [field, owners] of fields) {
  if (!new RegExp(`\\b${field}\\b`).test(blob)) {
    dead.push(`${field}  ←  ${[...owners].join(', ')}`);
  }
}

console.log(`검사 파일 ${files.length}개 (${blob.length}자), 필드 ${fields.size}개`);
console.log(
  dead.length === 0 ? '미사용 필드 없음' : `미사용 ${dead.length}개:\n  ${dead.join('\n  ')}`,
);
