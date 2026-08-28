export type ThemeId = 'light' | 'warm' | 'dark' | 'contrast';

export interface Theme {
  id: ThemeId;
  /** 고를 때 보이는 이름 */
  name: string;
  /** 언제 쓰는 것인지 한 줄로 */
  when: string;
}

/**
 * 테마 넷.
 *
 * 스무 가지를 취향으로 늘어놓지 않는다. **상황으로 넷**이다 — 교실
 * 컴퓨터는 하루에도 조명이 바뀌고, 같은 화면이 프로젝터로도 나간다.
 * 고르는 가짓수가 많아지면 고르는 일 자체가 일이 된다.
 */
export const THEMES: readonly Theme[] = [
  { id: 'light', name: '밝게', when: '교실 불을 켜 둔 보통 때' },
  { id: 'warm', name: '포근하게', when: '종일 켜 두는 화면. 눈이 덜 시립니다' },
  { id: 'dark', name: '어둡게', when: '불 끄고 영상 볼 때, 이른 아침' },
  { id: 'contrast', name: '또렷하게', when: '프로젝터·전자칠판. 대비를 최대로' },
] as const;

export const DEFAULT_THEME: ThemeId = 'light';

/** 모르는 값이 오면 기본으로. 저장된 글자는 밖에서 온 값이다. */
export function asThemeId(value: string | null): ThemeId {
  return THEMES.some((theme) => theme.id === value) ? (value as ThemeId) : DEFAULT_THEME;
}
