/**
 * vercel.json이 Vercel 스키마에 맞는지 본다.
 *
 * Vercel은 모르는 키를 거부한다(additionalProperties: false). 한때 rewrites 안에
 * 설명용 "comment" 키를 넣어 뒀는데, 그대로 배포하면 fork한 사람 전부가
 * 배포 실패를 만난다. 눈으로 보고 넘기지 않으려고 스크립트로 둔다.
 *
 *   node scripts/check-vercel-json.mjs
 */
import { readFileSync } from 'node:fs';

const SCHEMA_URL = 'https://openapi.vercel.sh/vercel.json';

const schema = await fetch(SCHEMA_URL).then((res) => {
  if (!res.ok) throw new Error(`스키마를 받지 못했습니다: ${res.status}`);
  return res.json();
});

const allowedTop = new Set(Object.keys(schema.properties ?? {}));
const rewriteItem = schema.properties?.rewrites?.items ?? {};
const allowedRewrite = new Set(Object.keys(rewriteItem.properties ?? {}));
const requiredRewrite = rewriteItem.required ?? [];

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const problems = [];

for (const key of Object.keys(config)) {
  if (!allowedTop.has(key)) problems.push(`최상위 "${key}"는 Vercel이 거부합니다`);
}

for (const [index, rule] of (config.rewrites ?? []).entries()) {
  for (const key of Object.keys(rule)) {
    if (!allowedRewrite.has(key)) {
      problems.push(`rewrites[${index}]의 "${key}"는 Vercel이 거부합니다`);
    }
  }
  for (const key of requiredRewrite) {
    if (!(key in rule)) problems.push(`rewrites[${index}]에 "${key}"가 빠졌습니다`);
  }
}

if (problems.length === 0) {
  console.log('vercel.json 이상 없습니다.');
} else {
  console.error('vercel.json에 문제가 있습니다:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
