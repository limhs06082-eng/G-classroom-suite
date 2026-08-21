import { describe, expect, it } from 'vitest';

import { moveStage, nextIndex, prevIndex, progressOf, totalMinutes } from '../../src/features/lesson/lessonCore';
import { createLessonTemplate, createStage } from '../../src/shared/domain/factories';
import type { LessonStage } from '../../src/shared/domain/types';

const NOW = '2026-08-12T09:00:00.000Z';

function stages(count: number): LessonStage[] {
  return Array.from({ length: count }, (_, i) =>
    createStage({ id: `s-${i + 1}`, phase: 'activity', title: `단계${i + 1}`, minutes: 5 }),
  );
}

const template = (count: number) =>
  createLessonTemplate({ id: 'l-1', title: '수업', stages: stages(count) }, NOW);

describe('totalMinutes', () => {
  it('단계 시간을 모두 더한다', () => {
    expect(totalMinutes(template(4))).toBe(20);
  });

  it('단계가 없으면 0분', () => {
    expect(totalMinutes(template(0))).toBe(0);
  });
});

describe('progressOf', () => {
  it('현재와 다음 단계를 알려 준다', () => {
    const progress = progressOf(template(3), 0, []);

    expect(progress.current?.id).toBe('s-1');
    expect(progress.next?.id).toBe('s-2');
    expect(progress.isLast).toBe(false);
  });

  it('마지막 단계에서는 다음이 없다', () => {
    const progress = progressOf(template(3), 2, []);

    expect(progress.next).toBeNull();
    expect(progress.isLast).toBe(true);
  });

  it('저장된 번호가 범위를 벗어나도 화면이 깨지지 않는다', () => {
    // 수업 단계를 줄이면 저장된 번호가 남아 있을 수 있다.
    const progress = progressOf(template(2), 99, []);

    expect(progress.index).toBe(1);
    expect(progress.current?.id).toBe('s-2');
  });

  it('완료 체크한 단계로 진행률을 센다', () => {
    const progress = progressOf(template(4), 0, ['s-1', 's-2']);

    expect(progress.doneCount).toBe(2);
    expect(progress.ratio).toBe(0.5);
  });

  it('없는 단계 id가 완료 목록에 있어도 세지 않는다', () => {
    const progress = progressOf(template(2), 0, ['s-1', '없는단계']);

    expect(progress.doneCount).toBe(1);
  });

  it('단계가 없어도 나눗셈이 깨지지 않는다', () => {
    const progress = progressOf(template(0), 0, []);

    expect(progress.current).toBeNull();
    expect(progress.ratio).toBe(0);
    expect(Number.isNaN(progress.ratio)).toBe(false);
    expect(progress.isLast).toBe(true);
  });
});

describe('nextIndex / prevIndex', () => {
  it('앞뒤로 옮긴다', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(prevIndex(2)).toBe(1);
  });

  it('마지막에서 다음을 눌러도 넘어가지 않는다', () => {
    // 넘어가면 빈 화면이 뜬다.
    expect(nextIndex(2, 3)).toBe(2);
  });

  it('첫 단계에서 이전을 눌러도 음수가 되지 않는다', () => {
    expect(prevIndex(0)).toBe(0);
  });

  it('단계가 없으면 0에 머문다', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});

describe('moveStage', () => {
  it('단계를 아래로 옮긴다', () => {
    const result = moveStage(stages(3), 0, 2);

    expect(result.map((s) => s.id)).toEqual(['s-2', 's-3', 's-1']);
  });

  it('단계를 위로 옮긴다', () => {
    const result = moveStage(stages(3), 2, 0);

    expect(result.map((s) => s.id)).toEqual(['s-3', 's-1', 's-2']);
  });

  it('범위를 벗어나면 그대로 둔다', () => {
    const original = stages(3);

    expect(moveStage(original, 0, 5).map((s) => s.id)).toEqual(['s-1', 's-2', 's-3']);
    expect(moveStage(original, -1, 0).map((s) => s.id)).toEqual(['s-1', 's-2', 's-3']);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const original = stages(3);
    moveStage(original, 0, 2);

    expect(original.map((s) => s.id)).toEqual(['s-1', 's-2', 's-3']);
  });
});
