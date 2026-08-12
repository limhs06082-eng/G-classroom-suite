import { cx } from '../../shared/ui';

/**
 * 모둠 색 id를 실제 클래스로 바꾼다.
 *
 * Group.color에는 'sky' 같은 id만 저장한다. 색값을 저장하면 나중에
 * 디자인을 바꿀 때 이미 저장된 데이터가 옛 색을 붙들고 있게 된다.
 */

interface GroupColorStyle {
  /** 카드 테두리와 배경 */
  card: string;
  /** 모둠 이름 등 강조 글자 */
  text: string;
  /** 색 동그라미 */
  dot: string;
}

const STYLES: Record<string, GroupColorStyle> = {
  sky: { card: 'border-sky-300 bg-sky-50', text: 'text-sky-800', dot: 'bg-sky-500' },
  teal: { card: 'border-teal-300 bg-teal-50', text: 'text-teal-800', dot: 'bg-teal-500' },
  emerald: { card: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  amber: { card: 'border-amber-300 bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
  orange: { card: 'border-orange-300 bg-orange-50', text: 'text-orange-800', dot: 'bg-orange-500' },
  purple: { card: 'border-purple-300 bg-purple-50', text: 'text-purple-800', dot: 'bg-purple-500' },
  pink: { card: 'border-pink-300 bg-pink-50', text: 'text-pink-800', dot: 'bg-pink-500' },
  slate: { card: 'border-slate-300 bg-slate-50', text: 'text-slate-800', dot: 'bg-slate-500' },
};

const FALLBACK: GroupColorStyle = STYLES['slate'] as GroupColorStyle;

export function groupColorStyle(colorId: string): GroupColorStyle {
  return STYLES[colorId] ?? FALLBACK;
}

export function groupCardClass(colorId: string, extra?: string): string {
  return cx(groupColorStyle(colorId).card, extra);
}
