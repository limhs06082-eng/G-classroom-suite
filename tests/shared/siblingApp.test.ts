import { describe, expect, it } from 'vitest';

import { SIBLING_APP_URL, siblingAppHref } from '../../src/shared/siblingApp';

describe('siblingAppHref', () => {
  it('비어 있으면 null — 버튼이 안 나온다', () => {
    expect(siblingAppHref('')).toBeNull();
    expect(siblingAppHref('   ')).toBeNull();
  });

  it('이 저장소에 적힌 주소는 쓸 만한 값이거나 비어 있다', () => {
    /*
     * 이 저장소는 강사 데모이면서 수강생 템플릿이다. 배포한 뒤에는 주소가
     * 채워져 있고, 아직 안 했으면 비어 있다. 둘 다 정상이다.
     *
     * **fork한 사람은 이 주소를 자기 것으로 바꿔야 한다.** 안 바꾸면 버튼이
     * 강사 앱으로 간다. docs/linking-two-apps.md에 적어 두었다.
     */
    const href = siblingAppHref(SIBLING_APP_URL);

    if (SIBLING_APP_URL.trim() === '') {
      expect(href).toBeNull();
    } else {
      expect(href).not.toBeNull();
      expect(href?.startsWith('https://')).toBe(true);
    }
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
