import { useCallback, useEffect, useState } from 'react';

import { asThemeId, DEFAULT_THEME, type ThemeId } from './themes';

/**
 * 고른 테마를 **이 컴퓨터에** 기억한다.
 *
 * **`SuiteData`에 안 담는다.** 테마는 그 컴퓨터의 취향이지 학급 자료가
 * 아니다. 백업 파일에 들어가면, 교실 컴퓨터에서 만든 백업을 집 노트북에
 * 복원했을 때 화면이 통째로 바뀐다 — 자기가 안 건드린 것이 바뀌는 셈이다.
 * 반대로 교실 컴퓨터의 프로젝터용 '또렷하게'는 그 컴퓨터에 남아야지
 * 백업을 타고 노트북까지 따라가면 안 된다.
 *
 * 그래서 여기서만 `localStorage`를 직접 부른다. **학급 자료는 반드시
 * `StorageAdapter`를 거친다는 규칙은 그대로 살아 있다.** 그 규칙이 지키는
 * 것은 "학급 자료가 화면마다 제각기 담기지 않는다"이고, 어댑터를 거쳐야
 * 설치형에서 파일로도 가고 백업에도 실린다. 테마는 애초에 그 자료가
 * 아니라서 규칙 밖에 있는 것이지, 규칙이 느슨해진 것이 아니다. 여기서
 * 된다고 학생 명단·자리·당번을 이렇게 담으면 안 된다.
 *
 * 같은 까닭으로 이미 규칙 밖에 나와 있는 것들이 있다 — `refineClient.ts`의
 * Gemini 열쇠, `JoinPage.tsx`의 학생 모둠 선택. 전부 그 기기에서만 뜻이
 * 있는 값이다. 가르는 기준은 "기능 코드냐"가 아니라 **"학급 자료냐"**다.
 */
const STORAGE_KEY = 'gboard:theme';

/**
 * 속성을 안 붙이고 그리는 테마.
 *
 * `index.css`의 `:root` 기본값이 곧 밝은 테마라 `[data-theme='light']`
 * 블록이 아예 없다. 붙여 봐야 아무것도 안 걸리는 속성이 남을 뿐이고,
 * 그 속성이 남아 있으면 다음 사람이 "블록이 있어야 하나 보다" 하고 같은
 * 색을 두 벌 적게 된다 — 한 벌만 고쳐 놓고 왜 안 바뀌나 하는 자리다.
 *
 * `DEFAULT_THEME`과 지금 값이 같지만 뜻이 다르다. 저건 "아무것도 안
 * 골랐을 때 쓸 테마"고 이건 "CSS 블록이 없는 테마"다. 언젠가 기본을
 * 포근하게로 바꾸면 저것만 바뀌어야 한다 — 여기까지 따라 바뀌면 포근하게가
 * 속성 없이 그려져 그냥 밝게가 된다.
 */
const ROOT_DEFAULT_THEME: ThemeId = 'light';

/**
 * 담아 둔 테마를 읽는다. 못 읽으면 기본 테마.
 *
 * 사생활 보호 창이나 저장소를 꺼 둔 환경에서는 `localStorage`에 닿는
 * 것만으로 던진다. 테마를 못 읽었다고 앱이 안 뜨면 안 된다 — 못 읽으면
 * 밝게 뜨면 될 일이다.
 *
 * 읽은 글자는 반드시 `asThemeId`를 거친다. 저장소는 앱 밖이고, 손으로
 * 고칠 수도 있고, 언젠가 지운 테마 이름이 남아 있을 수도 있다.
 */
function readStoredTheme(): ThemeId {
  try {
    return asThemeId(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * 고른 테마를 담는다. 못 담아도 조용히 넘어간다.
 *
 * 담는 데 실패한 것이지 고르는 데 실패한 것이 아니다. 지금 화면은 이미
 * 바뀌었고, 다음에 켤 때 기억이 안 날 뿐이다. 여기서 던지면 테마를 누른
 * 선생님에게 화면이 통째로 깨져 보인다.
 */
function writeStoredTheme(id: ThemeId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 저장소가 꺼졌거나 꽉 찼다. 화면은 이미 바뀌었으므로 여기서 할 일이 없다.
  }
}

/** `<html>`에 표를 남긴다. 색은 전부 CSS가 이 속성 하나를 보고 고른다. */
function applyTheme(id: ThemeId): void {
  const root = document.documentElement;

  if (id === ROOT_DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
}

/**
 * 앱이 뜰 때 한 번. **그리기 전에** 부른다.
 *
 * 갈고리가 아니라 그냥 함수인 까닭은 부르는 자리가 `main.tsx`이기
 * 때문이다. 전자칠판(`/board/*`)은 `AppShell` 밖에 있어서 셸에 붙이면
 * 칠판 창만 밝게 남는데, 프로젝터에 띄우는 '또렷하게'가 정작 프로젝터
 * 화면에서 안 걸리면 그 테마는 있으나 마나다. 설치형의 칠판 창도 웹의
 * 칠판 탭도 이 진입점을 처음부터 다시 밟으므로, 여기서 붙이면 창이
 * 몇 개든 각자 제 색으로 뜬다.
 *
 * 그리기 전이어야 하는 까닭은 첫 그림이다. 효과에서 붙이면 밝은 화면이
 * 한 번 번쩍인 뒤 어두워진다 — 불 끄고 영상 보려고 어둡게를 골라 둔
 * 교실에서 흰 화면이 한 번 튀는 것이 정확히 그 테마를 고른 이유를
 * 무르는 일이다.
 */
export function applyStoredTheme(): void {
  applyTheme(readStoredTheme());
}

/**
 * 고른 테마와 바꾸는 손잡이.
 *
 * `<html>`에 붙이는 일은 효과 한 곳에서만 한다. `setTheme` 안에서도 붙이면
 * 같은 속성을 두 곳이 쓰게 되고, 그러면 어느 쪽이 이겼는지를 나중에
 * 따지게 된다.
 *
 * **정리(cleanup)를 두지 않는다.** 갈고리를 쓰는 화면(설정의 '화면' 탭)을
 * 떠나면 속성을 지우게 되는데, 그러면 탭을 닫는 순간 테마가 풀린다.
 * 이 속성의 수명은 컴포넌트가 아니라 창이다.
 */
export function useTheme(): { theme: ThemeId; setTheme: (id: ThemeId) => void } {
  // 그릴 때마다 저장소를 읽지 않는다. 처음 한 번이면 된다.
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId): void => {
    // 화면부터 바꾸고 담는다. 담는 데 실패해도 고른 것은 고른 것이다.
    setThemeState(id);
    writeStoredTheme(id);
  }, []);

  return { theme, setTheme };
}
