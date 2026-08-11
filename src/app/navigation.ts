import type { LucideIcon } from 'lucide-react';
import { ClipboardCheck, Home, Sparkles, Users, Wand2 } from 'lucide-react';

/** 기능 식별자. 라우트·색상 토큰·저장소 키가 모두 이 값을 공유한다. */
export type FeatureId = 'home' | 'seating' | 'duty' | 'reward' | 'assignment';

export interface FeatureNavItem {
  id: FeatureId;
  path: string;
  label: string;
  /** 전자칠판 화면(/board/:feature)을 지원하는 기능인지 */
  hasBoardView: boolean;
  icon: LucideIcon;
  /** index.css의 --color-{id}-500 토큰과 짝을 이룬다. home은 brand를 쓴다. */
  accentClass: string;
}

export const FEATURE_NAV: readonly FeatureNavItem[] = [
  {
    id: 'home',
    path: '/',
    label: '홈',
    hasBoardView: false,
    icon: Home,
    accentClass: 'text-brand-600',
  },
  {
    id: 'seating',
    path: '/seating',
    label: '자리·모둠',
    hasBoardView: true,
    icon: Users,
    accentClass: 'text-seating-500',
  },
  {
    id: 'duty',
    path: '/duty',
    label: '역할·당번',
    hasBoardView: true,
    icon: Wand2,
    accentClass: 'text-duty-500',
  },
  {
    id: 'reward',
    path: '/reward',
    label: '활동·보상',
    hasBoardView: true,
    icon: Sparkles,
    accentClass: 'text-reward-500',
  },
  {
    id: 'assignment',
    path: '/assignment',
    label: '과제 제출',
    hasBoardView: true,
    icon: ClipboardCheck,
    accentClass: 'text-assignment-500',
  },
] as const;

export function findFeature(id: string): FeatureNavItem | undefined {
  return FEATURE_NAV.find((item) => item.id === id);
}
