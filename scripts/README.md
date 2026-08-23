# 점검 스크립트

화면을 새로 만든 뒤에 돌린다. 새 화면이 생길 때마다
"모델에는 있는데 화면이 없는 것"이 드러난다.

```bash
node scripts/audit-dead-fields.mjs . src/shared/domain/types.ts
node scripts/audit-dead-api.mjs .
```

무엇을 찾는지와 왜 셋이 필요한지는
[`../docs/reference/missing-features-audit.md`](../docs/reference/missing-features-audit.md)에 적었다.

배포 설정도 함께 본다. Vercel은 모르는 키를 거부하기 때문에,
`vercel.json`에 설명용 키 하나만 남아 있어도 fork한 사람 전부가 배포에 실패한다.

```bash
node scripts/check-vercel-json.mjs
```

빌드 산출물도 눈으로 보고 넘기지 않는다. 웹 번들에 Tauri 런타임이 실리거나, 반대로
설치형 번들에서 Tauri 분기가 죽은 코드로 지워지면(둘 다 타입 검사·테스트·빌드는
그대로 초록불이다) 산출물을 직접 grep해야만 드러난다. `npm run verify`에 이미
물려 있고, 필요하면 따로도 돌릴 수 있다.

```bash
npm run build && node scripts/check-bundle-purity.mjs web
npm run build:desktop && node scripts/check-bundle-purity.mjs desktop
```
