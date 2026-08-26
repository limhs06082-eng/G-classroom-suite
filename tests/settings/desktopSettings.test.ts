import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SettingsPage from '../../src/features/settings/SettingsPage';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * SettingsPage.tsx의 isDesktop() 분기 — '계정·동기화'·'기존 앱에서 가져오기'
 * 탭을 설치형에서 빼고, 백업 카드와 교사 잠금 화면의 문구를 바꾸는 것 —
 * 가 상수 목록이 아니라 실제 컴포넌트에 이어져 있는지를, 시험이 도는 웹
 * 대상 기준으로 증명한다.
 *
 * tests/app/desktopRoutes.test.ts와 같은 취지다. 그 시험이 desktopHiddenPaths라는,
 * 라우터가 읽지 않아 조건을 되돌려도 계속 통과하던 배열의 재발을 실제
 * router 객체를 훑어서 막듯이, 여기서는 SettingsPage를 실제로 렌더해 나온
 * DOM을 본다. 시험은 늘 웹 대상으로 돈다(VITE_TARGET을 안 준 채로) — 이
 * 파일은 그 웹 갈래가 지금 이 모습 그대로임(탭 둘이 있고, 문구가 브라우저를
 * 말한다)을 못 박아 둔다. isDesktop() 분기가 되돌아가거나 실수로 웹까지
 * 가지치면 여기서 바로 빨간불이 켜진다.
 *
 * 파일 확장자가 .tsx가 아니라 .ts다. JSX 문법은 .ts에서 못 쓰므로 createElement를
 * 직접 불러 렌더 트리를 만든다.
 */

function renderSettings(): void {
  render(
    createElement(ToastProvider, {
      children: createElement(SuiteDataProvider, {
        adapter: stubAdapter(),
        children: createElement(SettingsPage),
      }),
    }),
  );
}

describe('SettingsPage — 웹 대상에서는 설치형에서 빠지는 것들이 그대로 있다', () => {
  it('계정·동기화, 기존 앱에서 가져오기 탭이 둘 다 있다', () => {
    renderSettings();

    expect(screen.getByRole('tab', { name: '계정·동기화' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '기존 앱에서 가져오기' })).toBeTruthy();
  });

  it('백업 탭이 "이 브라우저에만 저장합니다"라고 말한다', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('tab', { name: '백업·복원' }));

    expect(await screen.findByText(/이 브라우저에만 저장합니다/)).toBeTruthy();
  });

  it('교사 잠금 탭이 "PIN은 이 브라우저에 그대로"라고 말한다', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('tab', { name: '교사 잠금' }));

    expect(await screen.findByText(/PIN은 이 브라우저에 그대로/)).toBeTruthy();
  });

  it('학교 정보 탭이 급식만 말하고 시간표는 안 말한다', async () => {
    renderSettings();

    /*
     * 이 화면에는 시간표 탭이 있다(2-나-1). 그러니 같은 화면에서 "시간표는
     * 설치형에서만 된다"고 말하면 앞뒤가 안 맞는다 — 웹으로 쓰는 선생님이
     * 옆 탭에 있는 기능을 못 쓰는 줄 알고 지나간다. 시간표는 손으로 짜는
     * 것이라 NEIS와 상관이 없고, 브라우저 제약을 받는 것은 급식뿐이다.
     */
    const notice = await screen.findByText(/설치형 G-board에서만 받아 옵니다/);

    expect(notice.textContent).toContain('급식은');
    expect(notice.textContent).not.toContain('시간표');
    expect(screen.getByRole('tab', { name: '시간표' })).toBeTruthy();
  });
});
