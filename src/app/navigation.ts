import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  Home,
  ListChecks,
  Megaphone,
  MessageSquareText,
  Presentation,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';

/** 기능 식별자. 라우트·색상 토큰·저장소 키가 모두 이 값을 공유한다. */
export type FeatureId =
  | 'home'
  // 학급 자료를 다루는 기능
  | 'attendance'
  | 'seating'
  | 'duty'
  | 'reward'
  | 'assignment'
  | 'notice'
  // 수업·업무를 돕는 기능. 학급에 매이지 않는다.
  | 'lesson'
  | 'quiz'
  | 'task'
  | 'message';

export interface FeatureNavItem {
  id: FeatureId;
  path: string;
  label: string;
  /** 전자칠판 화면(/board/:feature)을 지원하는 기능인지 */
  hasBoardView: boolean;
  icon: LucideIcon;
  /** index.css의 --color-{id}-500 토큰과 짝을 이룬다. home은 brand를 쓴다. */
  accentClass: string;
  /** 홈 카드 배경. --color-{id}-50과 짝을 이룬다. */
  tintClass: string;
}

export const FEATURE_NAV: readonly FeatureNavItem[] = [
  {
    id: 'home',
    path: '/',
    label: '홈',
    hasBoardView: false,
    icon: Home,
    accentClass: 'text-brand-700',
    tintClass: 'bg-brand-50',
  },
  {
    /*
     * 홈 바로 다음이다. 아침에 제일 먼저 여는 화면이라 맨 앞에 손이
     * 닿아야 한다. 전자칠판이 없다 — 결석자 명단은 교실 화면에 띄울
     * 것이 아니다.
     */
    id: 'attendance',
    path: '/attendance',
    label: '출결',
    hasBoardView: false,
    icon: CalendarCheck,
    accentClass: 'text-attendance-500',
    tintClass: 'bg-attendance-50',
  },
  {
    id: 'seating',
    path: '/seating',
    label: '자리·모둠',
    hasBoardView: true,
    icon: Users,
    accentClass: 'text-seating-500',
    tintClass: 'bg-seating-50',
  },
  {
    id: 'duty',
    path: '/duty',
    label: '역할·당번',
    hasBoardView: true,
    icon: Wand2,
    accentClass: 'text-duty-500',
    tintClass: 'bg-duty-50',
  },
  {
    id: 'reward',
    path: '/reward',
    label: '활동·보상',
    hasBoardView: true,
    icon: Sparkles,
    accentClass: 'text-reward-500',
    tintClass: 'bg-reward-50',
  },
  {
    id: 'assignment',
    path: '/assignment',
    label: '과제 제출',
    hasBoardView: true,
    icon: ClipboardCheck,
    accentClass: 'text-assignment-500',
    tintClass: 'bg-assignment-50',
  },
  {
    /*
     * 과제 다음이다. 종례의 순서(과제 확인 → 알림장)를 따른다.
     * 칠판이 핵심 화면이고, 내일까지인 과제가 자동으로 함께 나온다.
     */
    id: 'notice',
    path: '/notice',
    label: '알림장',
    hasBoardView: true,
    icon: Megaphone,
    accentClass: 'text-notice-500',
    tintClass: 'bg-notice-50',
  },
    {
      id: 'lesson',
      path: '/lesson',
      label: '수업 진행',
      hasBoardView: true,
      icon: Presentation,
      accentClass: 'text-lesson-500',
      tintClass: 'bg-lesson-50',
    },
    {
      id: 'quiz',
      path: '/quiz',
      label: '형성평가',
      hasBoardView: true,
      icon: CheckSquare,
      accentClass: 'text-quiz-500',
      tintClass: 'bg-quiz-50',
    },
    {
      id: 'task',
      path: '/task',
      label: '업무 체크',
      hasBoardView: false,
      icon: ListChecks,
      accentClass: 'text-task-500',
      tintClass: 'bg-task-50',
    },
    {
      id: 'message',
      path: '/message',
      label: '문구 템플릿',
      hasBoardView: false,
      icon: MessageSquareText,
      accentClass: 'text-message-500',
      tintClass: 'bg-message-50',
    },
] as const;

export function findFeature(id: string): FeatureNavItem | undefined {
  return FEATURE_NAV.find((item) => item.id === id);
}
