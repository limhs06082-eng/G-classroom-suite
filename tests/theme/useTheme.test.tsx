import { readFileSync } from 'node:fs';

import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { THEMES, type ThemeId } from '../../src/shared/theme/themes';
import { applyStoredTheme, useTheme } from '../../src/shared/theme/useTheme';

/*
 * 키를 상수로 안 가져오고 글자를 그대로 적는다. 가져오면 키가 바뀔 때
 * 시험이 같이 바뀌어 버려서, "이 컴퓨터가 어제 담아 둔 것을 오늘 읽는다"는
 * 약속이 깨져도 초록이 뜬다. 실제로 지키려는 것은 저 글자다.
 */
const KEY = 'gboard:theme';

let last: ReturnType<typeof useTheme> | null = null;

function Probe() {
  last = useTheme();
  return <span data-testid="theme">{last.theme}</span>;
}

/** 갈고리가 지금 들고 있는 테마. */
function chosen(): string {
  return document.querySelector('[data-testid="theme"]')?.textContent ?? '';
}

/** `<html>`에 실제로 붙어 있는 표. 색을 고르는 것은 오직 이것뿐이다. */
function marked(): string | null {
  return document.documentElement.getAttribute('data-theme');
}

function pick(id: ThemeId): void {
  act(() => {
    last?.setTheme(id);
  });
}

/** 저장소에 닿기만 해도 던지는 환경(사생활 보호 창, 저장소 꺼짐)을 흉내 낸다. */
function blockStorage(method: 'getItem' | 'setItem'): void {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new Error('저장소를 쓸 수 없습니다');
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.body.innerHTML = '';
  last = null;
});

describe('useTheme — 뜰 때', () => {
  it('담아 둔 것이 없으면 기본 테마다', () => {
    render(<Probe />);

    expect(chosen()).toBe('light');
    // 밝게는 `:root`의 기본값이라 속성이 아예 없어야 한다.
    expect(marked()).toBeNull();
  });

  it('담아 둔 것이 있으면 그것이다', () => {
    window.localStorage.setItem(KEY, 'dark');

    render(<Probe />);

    expect(chosen()).toBe('dark');
    expect(marked()).toBe('dark');
  });

  it('담긴 글자를 모르면 기본 테마다', () => {
    /*
     * 저장소는 앱 밖이다. 손으로 고칠 수도 있고, 예전 판에서 쓰다 지운
     * 이름이 남아 있을 수도 있다. 모르는 글자를 그대로 `<html>`에 붙이면
     * 어느 CSS 블록에도 안 걸려 색이 반쯤 어긋난 화면이 뜬다.
     */
    window.localStorage.setItem(KEY, '주황색');

    render(<Probe />);

    expect(chosen()).toBe('light');
    expect(marked()).toBeNull();
  });
});

describe('useTheme — 고를 때', () => {
  it('고르면 <html>에 표가 붙는다', () => {
    render(<Probe />);

    pick('contrast');

    expect(marked()).toBe('contrast');
    expect(chosen()).toBe('contrast');
  });

  it('밝게로 되돌리면 표가 사라진다', () => {
    window.localStorage.setItem(KEY, 'dark');
    render(<Probe />);
    expect(marked()).toBe('dark');

    pick('light');

    // 남겨 두면 아무 효과도 없는 속성이 붙은 채로 다음 사람이 CSS를 두 벌 적게 된다.
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(chosen()).toBe('light');
  });

  it('고른 것이 다음에 켤 때도 남아 있다', () => {
    const first = render(<Probe />);
    pick('warm');
    first.unmount();

    render(<Probe />);

    // 이 저장소가 "이 컴퓨터에 기억한다"고 약속한 것이 정확히 이 한 줄이다.
    expect(chosen()).toBe('warm');
    expect(marked()).toBe('warm');
    expect(window.localStorage.getItem(KEY)).toBe('warm');
  });

  it('갈고리를 쓰던 화면을 떠나도 테마는 그대로다', () => {
    const view = render(<Probe />);
    pick('dark');

    view.unmount();

    /*
     * 속성의 수명은 컴포넌트가 아니라 창이다. 효과에 정리를 달면 설정
     * 화면을 나가는 순간 테마가 풀린다.
     */
    expect(marked()).toBe('dark');
  });
});

describe('useTheme — 저장소가 막혀 있을 때', () => {
  it('읽기가 던져도 앱이 뜬다', () => {
    blockStorage('getItem');

    render(<Probe />);

    // 테마를 못 읽은 것이지 앱이 못 뜰 일이 아니다.
    expect(chosen()).toBe('light');
    expect(marked()).toBeNull();
  });

  it('쓰기가 던져도 화면은 바뀐다', () => {
    render(<Probe />);
    blockStorage('setItem');

    pick('dark');

    // 담는 데 실패한 것이지 고르는 데 실패한 것이 아니다.
    expect(marked()).toBe('dark');
    expect(chosen()).toBe('dark');
  });
});

describe('applyStoredTheme — 앱이 뜨는 자리', () => {
  it('그리기 전에 담아 둔 테마를 붙인다', () => {
    window.localStorage.setItem(KEY, 'contrast');

    applyStoredTheme();

    expect(marked()).toBe('contrast');
  });

  it('모르는 글자면 기본 테마다', () => {
    window.localStorage.setItem(KEY, 'projector');

    applyStoredTheme();

    expect(marked()).toBeNull();
  });

  it('읽기가 던져도 안 죽는다', () => {
    blockStorage('getItem');

    expect(() => {
      applyStoredTheme();
    }).not.toThrow();
    expect(marked()).toBeNull();
  });
});

/*
 * 이 한 덩어리는 화면이 아니라 **소스 글자**를 본다.
 *
 * 지키려는 것은 전자칠판 창이다. `/board/*`는 `AppShell` 밖의 라우트라,
 * 붙이는 자리를 셸로 옮기면 칠판 창만 밝게 남는다 — 프로젝터 때문에 만든
 * '또렷하게'가 정작 프로젝터에서 안 걸리는 셈이다. 그런데 그렇게 옮겨도
 * 위의 시험은 하나도 안 깨진다. 갈고리는 멀쩡하고 부르는 자리만 틀린
 * 것이라, 갈고리를 아무리 시험해도 그 흠은 안 잡힌다.
 *
 * jsdom으로 창 둘을 띄울 수는 없으니 부르는 자리를 글자로 못 박는다.
 * 설치형의 칠판 창(별도 앱 창)도 웹의 칠판 탭(새 탭)도 `main.tsx`를
 * 처음부터 다시 밟는다 — 그래서 여기가 맞는 자리다.
 */
describe('붙이는 자리', () => {
  /** 주석은 걷어 낸다. 주석에 적힌 이름은 부르는 것이 아니다. */
  function bareMain(): string {
    return readFileSync('src/main.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  }

  it('main.tsx가 테마를 붙인다', () => {
    expect(bareMain()).toContain('applyStoredTheme()');
  });

  it('그리기 전에 붙인다', () => {
    const source = bareMain();

    /*
     * 첫 그림부터 제 색이어야 한다. 그린 뒤에 붙이면 불 꺼 둔 교실에서
     * 흰 화면이 한 번 번쩍인 뒤 어두워진다.
     */
    expect(source.indexOf('applyStoredTheme()')).toBeLessThan(source.indexOf('createRoot('));
  });
});

describe('표를 안 붙이는 테마와 CSS 블록이 없는 테마는 같은 것이어야 한다', () => {
  it('CSS 블록이 있는 테마는 표가 붙고, 없는 테마는 안 붙는다', () => {
    const css = readFileSync('src/index.css', 'utf8');
    render(<Probe />);

    for (const theme of THEMES) {
      act(() => {
        last?.setTheme(theme.id);
      });

      const hasBlock = css.includes(`[data-theme='${theme.id}']`);

      /*
       * 이 둘이 어긋나는 순간이 조용히 온다. 지금은 `DEFAULT_THEME`과
       * `ROOT_DEFAULT_THEME`이 둘 다 'light'라 하나로 합쳐도 아무 시험이
       * 안 깨진다. 그런데 언젠가 기본을 '포근하게'로 바꾸면, 합쳐 둔
       * 코드는 포근하게에 표를 안 붙이고 — 포근하게는 CSS 블록이 있으므로
       * 그 블록이 영영 안 걸려 그냥 밝게로 뜬다. 기본 테마를 바꿨는데
       * 화면이 안 바뀌는 자리라 원인을 찾기가 어렵다.
       */
      expect(marked(), theme.id).toBe(hasBlock ? theme.id : null);
    }
  });
})

describe('다른 창에서 바꾸면 따라간다', () => {
  it('storage 이벤트가 오면 표를 다시 붙인다', () => {
    applyStoredTheme();
    expect(marked()).toBeNull();

    // 다른 창이 담았다. storage 이벤트는 담은 창 말고 나머지에게만 온다.
    window.localStorage.setItem(KEY, 'contrast');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'contrast' }));
    });

    /*
     * 이게 없으면 '또렷하게'가 정작 프로젝터에 못 닿는다. 칠판은 별도 창이고
     * 열릴 때 색이 굳는다. 1교시에 띄운 칠판이 씻겨 보여 교사가 설정에서
     * 또렷하게를 골라도 교사 모니터만 바뀐다. [전자칠판]을 다시 눌러도
     * 이미 열린 창을 앞으로 가져올 뿐이다.
     */
    expect(marked()).toBe('contrast');
  });

  it('남의 열쇠가 바뀐 것은 흘려보낸다', () => {
    window.localStorage.setItem(KEY, 'dark');
    applyStoredTheme();
    expect(marked()).toBe('dark');

    window.localStorage.setItem(KEY, 'contrast');
    act(() => {
      // 학급 자료도 같은 저장소를 쓴다. 저장할 때마다 테마를 다시 붙일 일이 아니다.
      window.dispatchEvent(new StorageEvent('storage', { key: 'teacher-toolkit:v1', newValue: '{}' }));
    });

    expect(marked()).toBe('dark');
  });
})
