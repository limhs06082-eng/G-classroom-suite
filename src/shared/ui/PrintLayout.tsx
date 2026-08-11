import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * 인쇄 프레임.
 *
 * 원본 3개 앱(seating, duty, assignment)이 각자 PrintModal을 만들어
 * 화면 어딘가에 숨긴 인쇄용 DOM을 두고 window.print()를 불렀다.
 * 통합본은 #print-root 포털 하나로 통일한다.
 *
 * index.css의 @media print 규칙이 #root를 감추고 #print-root만 보이게 한다.
 * 따라서 어느 화면에서 인쇄하든 결과물이 일관된다.
 */

interface Props {
  /** 인쇄물 상단 제목. 예: '3학년 2반 자리 배치표' */
  title: string;
  /** 제목 아래 한 줄. 예: '2026학년도 1학기 · 2026-03-02' */
  subtitle?: string;
  /** 각 페이지 아래에 남길 안내. 기본은 학교·교사명이 들어갈 자리다. */
  footer?: ReactNode;
  children: ReactNode;
}

function getPrintRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const existing = document.getElementById('print-root');
  if (existing) return existing;

  // index.html에 없더라도(테스트 등) 동작하도록 만들어 준다.
  const created = document.createElement('div');
  created.id = 'print-root';
  document.body.appendChild(created);
  return created;
}

export function PrintLayout({ title, subtitle, footer, children }: Props) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(getPrintRoot());
  }, []);

  if (root === null) return null;

  return createPortal(
    <article className="print-document">
      <header className="print-keep mb-4 border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle === undefined ? null : <p className="mt-1 text-sm">{subtitle}</p>}
      </header>

      {children}

      {footer === undefined ? null : (
        <footer className="print-keep mt-6 border-t border-black pt-2 text-xs">{footer}</footer>
      )}
    </article>,
    root,
  );
}

/**
 * 인쇄 실행.
 *
 * PrintLayout이 이미 마운트돼 있어야 한다. 렌더 직후 곧바로 print()를 부르면
 * 브라우저가 아직 그리지 않은 상태에서 인쇄창이 떠 빈 종이가 나올 수 있어,
 * 한 프레임 뒤로 미룬다.
 */
export function usePrint(): () => void {
  return useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }, []);
}
