import { readFileSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import SettingsPage from '../../src/features/settings/SettingsPage';
import { ThemeTab } from '../../src/features/settings/ThemeTab';
import { subjectTint } from '../../src/shared/subjects';
import { THEMES } from '../../src/shared/theme/themes';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const CSS_PATH = 'src/index.css';

/*
 * 키 글자를 그대로 적는다. 상수로 가져오면 키가 바뀔 때 시험이 같이 바뀌어,
 * "어제 고른 테마로 오늘 열린다"가 깨져도 초록이 뜬다(useTheme.test.tsx와 같은 결).
 */
const KEY = 'gboard:theme';

/** `<html>`에 실제로 붙은 표. 앱 전체의 색을 고르는 것은 오직 이것뿐이다. */
function marked(): string | null {
  return document.documentElement.getAttribute('data-theme');
}

/** 이름으로 타일 하나. 고른 타일은 '사용 중'이 붙어 이름이 길어지므로 부분으로 찾는다. */
function tile(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(name) });
}

function show() {
  return render(<ThemeTab />);
}

function showSettings(url = '/settings') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <SuiteDataProvider adapter={stubAdapter()}>
          <SettingsPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  // 속성의 수명은 컴포넌트가 아니라 창이다. 시험 사이에 손으로 걷어 낸다.
  document.documentElement.removeAttribute('data-theme');
});

describe('테마 고르기', () => {
  it('넷이 다 보인다', () => {
    show();

    for (const theme of THEMES) {
      // 이름만으로는 모자란다. 언제 쓰는 것인지가 고르는 근거다.
      expect(tile(theme.name), theme.id).toHaveAccessibleName(new RegExp(theme.when));
    }
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('누르면 <html>에 표가 붙는다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(tile('또렷하게'));

    expect(marked()).toBe('contrast');
    expect(window.localStorage.getItem(KEY)).toBe('contrast');
  });

  it('밝게를 누르면 표가 사라진다', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(KEY, 'dark');
    show();
    expect(marked()).toBe('dark');

    await user.click(tile('밝게'));

    /*
     * `:root`의 기본값이 곧 밝은 테마다. 아무 데도 안 걸리는 속성을 남겨 두면
     * 다음 사람이 "light 블록이 있어야 하나 보다" 하고 색을 두 벌 적게 된다.
     */
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('지금 고른 것만 눌린 상태다', async () => {
    const user = userEvent.setup();
    show();

    expect(tile('밝게')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('어둡게')).toHaveAttribute('aria-pressed', 'false');

    await user.click(tile('어둡게'));

    /*
     * 테두리 색과 체크 표시는 낭독기에 아무것도 안 남긴다. 그것만 두면
     * 넷 다 그냥 단추로 읽혀서, 눈으로 못 보는 사람은 지금 무엇이 켜져
     * 있는지 알 길이 없다.
     */
    expect(tile('어둡게')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('밝게')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('미리보기', () => {
  it('조각마다 제 테마 표가 붙어 있다', () => {
    show();

    for (const theme of THEMES) {
      const preview = screen.getByTestId(`theme-preview-${theme.id}`);

      if (theme.id === 'light') {
        /*
         * 밝게에는 안 붙인다. `light` 블록이 아예 없어서 붙여도 아무 CSS가
         * 안 걸리고, 붙는 순간 `<html>` 쪽 규칙과 어긋난 두 벌이 된다.
         */
        expect(preview.hasAttribute('data-theme')).toBe(false);
      } else {
        expect(preview, theme.id).toHaveAttribute('data-theme', theme.id);
      }
    }
  });

  it('CSS의 테마 블록이 뿌리에 매여 있지 않다', () => {
    /*
     * **이 시험이 미리보기를 실제로 지킨다.**
     *
     * 위 시험은 속성이 붙었는지만 본다. 그런데 `index.css`가
     * `:root[data-theme='dark']`로 적혀 있으면 그 속성은 `<html>`에서만
     * 걸리고 미리보기 조각에서는 한 줄도 안 걸린다 — 넷이 전부 지금 테마
     * 색으로 똑같이 그려지는데, 속성은 멀쩡히 붙어 있으니 위 시험도
     * 통과한다. 색이 CSS 변수라 jsdom에서는 계산된 값이 안 나오므로,
     * 화면을 눈으로 볼 때까지 아무도 모른다. 그래서 글자로 못 박는다.
     */
    const css = bareCss();

    const rooted = THEMES.filter((theme) => css.includes(`:root[data-theme='${theme.id}']`)).map(
      (theme) => theme.id,
    );
    expect(rooted).toEqual([]);

    // 규칙이 지킬 대상이 사라지면 위 검사는 빈 배열끼리 견주며 조용히 통과한다.
    const blocks = THEMES.filter((theme) => css.includes(`[data-theme='${theme.id}'] {`)).map(
      (theme) => theme.id,
    );
    expect(blocks).toEqual(['warm', 'dark', 'contrast']);
  });

  it('과목 색이 시간표에서 쓰는 것과 같다', () => {
    show();

    const preview = screen.getByTestId('theme-preview-contrast');
    const chips = [...preview.querySelectorAll('[class*="bg-subject-"]')];

    /*
     * '또렷하게'가 있는 까닭이 과목 색 채도인데, 미리보기가 시간표와 다른
     * 색을 보이면 고르는 근거 자체가 거짓이 된다. 번호는 `subjects.ts`가
     * 정한다 — 여기서 국어가 빨강인데 시간표에서 파랑이면 안 된다.
     */
    expect(chips).toHaveLength(4);
    for (const chip of chips) {
      const name = chip.textContent ?? '';
      expect(chip.className.split(' '), name).toContain(
        `bg-subject-${String(subjectTint(name))}`,
      );
    }
  });

  it('낭독기에는 안 읽힌다', () => {
    show();

    /*
     * 미리보기의 '우리 반'·'국어'는 색을 보이려고 놓은 그림이지 읽을 글이
     * 아니다. 숨기지 않으면 타일 이름이 넷 다 같은 말로 길어져, 정작
     * 이름과 언제 쓰는지가 그 속에 묻힌다.
     */
    expect(tile('포근하게')).not.toHaveAccessibleName(/국어/);
  });
});

describe('설정 화면 화면 탭', () => {
  it('탭을 누르면 이 화면이 나온다', async () => {
    const user = userEvent.setup();
    showSettings();

    await user.click(await screen.findByRole('tab', { name: '화면' }));

    /*
     * 이 저장소에서 세 번 겪은 함정이다. `SettingsPage`는 탭 목록과 그리는
     * 곳이 따로 놀아서, 목록에만 더하면 눌러도 빈 화면이고 그리는 줄만
     * 더하면 누를 데가 없다. 목록에 이름이 있는지가 아니라 **눌러서 나오는지**를 본다.
     */
    expect(await screen.findByRole('button', { name: /또렷하게/ })).toBeInTheDocument();
  });

  it('?tab=theme으로 바로 열린다', async () => {
    showSettings('/settings?tab=theme');

    // 홈이나 안내 문구가 이 탭을 곧장 가리킬 수 있어야 한다.
    expect(await screen.findByRole('button', { name: /또렷하게/ })).toBeInTheDocument();
  });
});

/**
 * 주석을 걷어 낸 CSS.
 *
 * 주석 처리한 선언은 지운 것과 같고, 주석에 적어 둔 선택자는 규칙이 아니다.
 * `index.css`의 테마 절은 선택자 이야기를 주석으로도 하고 있어서, 안 걷어 내면
 * 설명 한 줄 때문에 빨간불이 뜰 수 있다.
 */
function bareCss(): string {
  let out = readFileSync(CSS_PATH, 'utf8');
  for (;;) {
    const opened = out.indexOf('/*');
    if (opened === -1) break;
    const closed = out.indexOf('*/', opened);
    if (closed === -1) break;
    out = out.slice(0, opened) + out.slice(closed + 2);
  }
  return out;
}
