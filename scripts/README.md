# 점검 스크립트

화면을 새로 만든 뒤에 돌린다. 새 화면이 생길 때마다
"모델에는 있는데 화면이 없는 것"이 드러난다.

```bash
node scripts/audit-dead-fields.mjs . src/shared/domain/types.ts
node scripts/audit-dead-api.mjs .
```

무엇을 찾는지와 왜 셋이 필요한지는
[`../docs/reference/missing-features-audit.md`](../docs/reference/missing-features-audit.md)에 적었다.
