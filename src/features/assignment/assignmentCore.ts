import type { Assignment, Student, Submission, SubmissionStatus } from '../../shared/domain/types';

/**
 * 과제 제출 현황 계산.
 *
 * 원본은 제출 레코드를 항상 미리 만들어 두었다(과제 × 학생 전부).
 * 여기서는 **기록이 없으면 미제출**로 본다. 학생이 늘거나 줄어도
 * 기록을 다시 맞출 필요가 없고, 저장 용량도 학생 수만큼 줄어든다.
 */

export const SUBMISSION_LABELS: Record<SubmissionStatus, string> = {
  unsubmitted: '미제출',
  submitted: '제출',
  supplement: '보완',
  completed: '완료',
};

/** 체크할 때 도는 순서. 교사가 같은 자리를 계속 눌러 상태를 넘긴다. */
export const SUBMISSION_CYCLE: SubmissionStatus[] = [
  'unsubmitted',
  'submitted',
  'supplement',
  'completed',
];

export function nextStatus(current: SubmissionStatus): SubmissionStatus {
  const index = SUBMISSION_CYCLE.indexOf(current);
  return SUBMISSION_CYCLE[(index + 1) % SUBMISSION_CYCLE.length] ?? 'unsubmitted';
}

export function statusOf(
  submissions: readonly Submission[],
  assignmentId: string,
  studentId: string,
): SubmissionStatus {
  return (
    submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId)?.status ??
    'unsubmitted'
  );
}

export interface AssignmentProgress {
  assignment: Assignment;
  counts: Record<SubmissionStatus, number>;
  total: number;
  /** 제출·완료로 끝난 학생 비율 0~1 */
  doneRatio: number;
  /** 기한이 지났는데 아직 안 낸 학생이 있는가 */
  isOverdue: boolean;
  /** 오늘 기준 남은 일수. 기한이 없으면 null */
  daysLeft: number | null;
}

/** 'YYYY-MM-DD' 사이의 일수. 지역 시간 기준으로 센다. */
export function daysBetween(from: string, to: string): number | null {
  const parse = (value: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };

  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;

  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function summarize(
  assignment: Assignment,
  roster: readonly Student[],
  submissions: readonly Submission[],
  today: string,
): AssignmentProgress {
  const counts: Record<SubmissionStatus, number> = {
    unsubmitted: 0,
    submitted: 0,
    supplement: 0,
    completed: 0,
  };

  for (const student of roster) {
    counts[statusOf(submissions, assignment.id, student.id)] += 1;
  }

  const total = roster.length;
  // 보완은 아직 끝난 것이 아니다. 제출·완료만 끝난 것으로 센다.
  const done = counts.submitted + counts.completed;
  const daysLeft = assignment.dueDate === '' ? null : daysBetween(today, assignment.dueDate);

  return {
    assignment,
    counts,
    total,
    doneRatio: total === 0 ? 0 : done / total,
    isOverdue: daysLeft !== null && daysLeft < 0 && counts.unsubmitted + counts.supplement > 0,
    daysLeft,
  };
}

/** 마감이 가까운 순. 기한 없는 과제는 뒤로 보낸다. */
export function byDueDate(a: Assignment, b: Assignment): number {
  if (a.dueDate === '' && b.dueDate === '') return a.createdAt.localeCompare(b.createdAt);
  if (a.dueDate === '') return 1;
  if (b.dueDate === '') return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

// ── 학생 쪽에서 보기 ──────────────────────────────────────────
// 위쪽은 과제 하나를 세로로 센다. 아래쪽은 학생 하나를 가로로 센다.

/** 표 보기 칸에 쓰는 한 글자. 과제 20개를 한 화면에 넣으려면 세 글자가 안 들어간다. */
export const SUBMISSION_SHORT: Record<SubmissionStatus, string> = {
  unsubmitted: '미',
  submitted: '제',
  supplement: '보',
  completed: '완',
};

/**
 * `assignmentId|studentId` → 상태.
 *
 * 표 보기는 학생 24명 × 과제 20개면 칸이 480개다. 칸마다 statusOf를 부르면
 * 배열을 480번 훑는다. 지금 학급 크기에서 느려지지는 않지만,
 * 이런 것은 나중에 원인을 찾기 어렵다.
 */
export function submissionIndex(
  submissions: readonly Submission[],
): Map<string, SubmissionStatus> {
  const index = new Map<string, SubmissionStatus>();

  for (const item of submissions) {
    const key = `${item.assignmentId}|${item.studentId}`;
    // 중복은 불변조건 검사가 막지만, 여기서도 먼저 것을 쓴다고 정해 둔다.
    if (!index.has(key)) index.set(key, item.status);
  }

  return index;
}

export function statusFromIndex(
  index: ReadonlyMap<string, SubmissionStatus>,
  assignmentId: string,
  studentId: string,
): SubmissionStatus {
  return index.get(`${assignmentId}|${studentId}`) ?? 'unsubmitted';
}

export interface StudentProgress {
  student: Student;
  counts: Record<SubmissionStatus, number>;
  total: number;
  /** 제출·완료로 끝난 과제 비율 0~1 */
  doneRatio: number;
  /** 기한이 지났는데 아직 안 낸 과제 수 */
  overdueCount: number;
}

/**
 * summarize를 학생 쪽으로 뒤집은 것.
 *
 * 같은 자료를 가로로 세느냐 세로로 세느냐의 차이라 셈법도 같게 맞춘다.
 * 보완은 끝난 것으로 세지 않는다.
 */
export function summarizeStudent(
  student: Student,
  assignments: readonly Assignment[],
  submissions: readonly Submission[],
  today: string,
): StudentProgress {
  const index = submissionIndex(submissions);

  const counts: Record<SubmissionStatus, number> = {
    unsubmitted: 0,
    submitted: 0,
    supplement: 0,
    completed: 0,
  };

  let overdueCount = 0;

  for (const assignment of assignments) {
    const status = statusFromIndex(index, assignment.id, student.id);
    counts[status] += 1;

    if (status === 'unsubmitted' || status === 'supplement') {
      const daysLeft = assignment.dueDate === '' ? null : daysBetween(today, assignment.dueDate);
      if (daysLeft !== null && daysLeft < 0) overdueCount += 1;
    }
  }

  const total = assignments.length;
  const done = counts.submitted + counts.completed;

  return {
    student,
    counts,
    total,
    doneRatio: total === 0 ? 0 : done / total,
    overdueCount,
  };
}
