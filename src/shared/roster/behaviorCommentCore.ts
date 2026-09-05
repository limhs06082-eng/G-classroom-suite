import { isCounted } from '../../features/reward/rewardCore';
import type { BehaviorComment, SuiteData } from '../domain/types';
import { createId } from '../ids';
import { summarizeStudent, type DateRange } from './studentSummary';

/**
 * 행동특성 및 종합의견.
 *
 * 학기말에 교사는 관찰 기록을 다시 읽으며 학생마다 몇 문장을 쓴다.
 * 여기서는 **쌓인 기록에서 초안**을 만들어 주고, 교사가 고친 글을 학급·학생마다
 * 하나씩 남긴다. AI를 부르지 않는다 — 규칙 몇 개면 되고, 그래야 어디서
 * 온 문장인지 교사가 안다.
 */

/** 나이스 행동특성 및 종합의견 글자 수 기준. 넘어도 막지 않고 알린다. */
export const NEIS_COMMENT_LIMIT = 500;

export function commentOf(
  comments: readonly BehaviorComment[],
  classId: string,
  studentId: string,
): string {
  return (
    comments.find((comment) => comment.classId === classId && comment.studentId === studentId)?.text ??
    ''
  );
}

/** 학급·학생마다 하나. 빈 글이면 항목을 지운다. */
export function upsertBehaviorComment(
  comments: readonly BehaviorComment[],
  input: { classId: string; studentId: string; text: string },
  now: string,
): BehaviorComment[] {
  const text = input.text.trim();
  const rest = comments.filter(
    (comment) => !(comment.classId === input.classId && comment.studentId === input.studentId),
  );
  if (text === '') return rest;

  const existing = comments.find(
    (comment) => comment.classId === input.classId && comment.studentId === input.studentId,
  );
  return [
    ...rest,
    {
      id: existing?.id ?? createId(),
      classId: input.classId,
      studentId: input.studentId,
      text,
      updatedAt: now,
    },
  ];
}

/**
 * 칭찬(양수) 기록을 사유별로 센다, 많은 순. 되돌린 것과 지도(음수)는 뺀다.
 * 규칙 초안과 AI 사실 모음이 같은 숫자를 봐야 한다.
 */
export function praiseCounts(
  data: SuiteData,
  studentId: string,
  inRange: (date: string) => boolean,
): { reason: string; count: number }[] {
  const praise = new Map<string, number>();
  for (const entry of data.scoreEntries) {
    if (
      entry.targetUnit !== 'student' ||
      entry.targetId !== studentId ||
      !isCounted(entry) ||
      entry.points <= 0 ||
      !inRange(entry.occurredAt)
    ) {
      continue;
    }
    const reason = entry.reason.trim();
    if (reason === '') continue;
    praise.set(reason, (praise.get(reason) ?? 0) + 1);
  }
  return [...praise.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .map(([reason, count]) => ({ reason, count }));
}

/** 끝맺음을 맞춘다. "친구를 도왔다" → "친구를 도왔다." 빈 글은 빈 글. */
function sentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  return /[.!?。]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * 기록에서 초안 한 단락.
 *
 * 순서: 개근 → 칭찬 상위 항목 → 당번 → 과제 → 관찰 기록(오래된 것부터).
 * 지도(음수) 기록은 넣지 않는다 — 넣을지는 교사가 정한다. 개근 문장은
 * 그 학급이 출결을 실제로 쓸 때만 — 한 번도 안 찍은 학급의 "개근"은
 * 사실이 아니라 공백이다.
 */
export function draftBehaviorComment(
  data: SuiteData,
  studentId: string,
  range?: DateRange,
): string {
  const student = data.students.find((item) => item.id === studentId);
  if (student === undefined) return '';
  const summary = summarizeStudent(data, studentId, range === undefined ? {} : { range });
  if (summary === null) return '';

  const inRange = (date: string): boolean =>
    range === undefined || (date.slice(0, 10) >= range.from && date.slice(0, 10) <= range.to);
  const parts: string[] = [];

  // 출결
  const classUsesAttendance = data.attendanceRecords.some(
    (record) => record.classId === student.classId && inRange(record.date),
  );
  if (classUsesAttendance && summary.attendance.marked === 0) {
    parts.push('결석·지각·조퇴 없이 개근함.');
  }

  // 칭찬 — 양수 기록을 사유별로 센다.
  const praise = praiseCounts(data, studentId, inRange);
  const praiseTotal = praise.reduce((sum, item) => sum + item.count, 0);
  if (praiseTotal > 0) {
    const top = praise
      .slice(0, 3)
      .map((item) => `${item.reason} ${item.count}회`)
      .join(', ');
    parts.push(`${top} 등 칭찬받은 일이 모두 ${praiseTotal}회임.`);
  }

  // 당번
  if (summary.dutyCount > 0) parts.push(`당번 활동을 ${summary.dutyCount}회 맡아 수행함.`);

  // 과제
  // "빠짐없이"는 정말 다 냈을 때만. 9/10에 빠짐없이라고 적으면 나이스에 거짓이 들어간다.
  const { total, submitted } = summary.assignments;
  if (total > 0) {
    parts.push(
      submitted === total
        ? `과제를 빠짐없이 성실히 제출함(${submitted}/${total}).`
        : submitted / total >= 0.9
          ? `과제를 대부분 성실히 제출함(${submitted}/${total}).`
          : `과제 ${total}건 중 ${submitted}건을 제출함.`,
    );
  }

  // 관찰 기록 — 교사의 글이라 끝맺음만 맞춘다. 오래된 것부터가 이야기 순서다.
  for (const observation of [...summary.observations].reverse()) {
    const line = sentence(observation.text);
    if (line !== '') parts.push(line);
  }

  return parts.join(' ');
}
