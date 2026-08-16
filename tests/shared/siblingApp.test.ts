import { describe, expect, it } from 'vitest';

import { SIBLING_APP_URL, siblingAppHref } from '../../src/shared/siblingApp';

describe('siblingAppHref', () => {
  it('비어 있으면 null — 버튼이 안 나온다', () => {
    expect(siblingAppHref('')).toBeNull();
    expect(siblingAppHref('   ')).toBeNull();
  });

  it('기본값은 비어 있다', () => {
    // fork한 직후 아무 설정 없이 올려도 동작해야 한다.
    expect(siblingAppHref(SIBLING_APP_URL)).toBeNull();
  });

  it('https 주소를 받는다', () => {
    expect(siblingAppHref('https://my-toolkit.vercel.app')).toBe('https://my-toolkit.vercel.app/');
  });

  it('http도 받는다 — 교내 서버에 올리는 경우가 있다', () => {
    expect(siblingAppHref('http://localhost:3100')).toBe('http://localhost:3100/');
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(siblingAppHref('  https://a.example.com  ')).toBe('https://a.example.com/');
  });

  it('javascript: 같은 것은 받지 않는다', () => {
    // 손으로 고치는 파일이라 이런 값이 들어갈 수 있다. 링크에 그대로 넣으면 안 된다.
    expect(siblingAppHref('javascript:alert(1)')).toBeNull();
    expect(siblingAppHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(siblingAppHref('file:///etc/passwd')).toBeNull();
  });

  it('주소 모양이 아니면 null — 깨진 링크를 보여 주지 않는다', () => {
    expect(siblingAppHref('my-toolkit.vercel.app')).toBeNull();
    expect(siblingAppHref('아무거나')).toBeNull();
  });
});
