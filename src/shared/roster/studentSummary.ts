import type {
  Assignment,
  AttendanceStatus,
  ObservationEntry,
  Redemption,
  ScoreEntry,
  SuiteData,
} from '../domain/types';
import { countPastAssignments } from '../../features/duty/dutyCore';
import { isCounted } from '../../features/reward/rewardCore';
import {
  statusOf as submissionStatusOf,
  visibleAssignments,
} from '../../features/assignment/assignmentCore';
import { observationsOf } from './observationCore';

/**
 * 학생 한눈에 — 흩어진 기록을 한 학생 기준으로 모은다.
 *
 * 출결·점수·과제·당번·관찰·쿠폰은 각자 제 화면에 산다. 학부모 상담이나
 * 생활기록부를 쓸 때 교사는 그 여섯 화면을 오가며 한 학생을 찾아야 했다.
 * 여기서는 저장된 자료를 **읽기만** 한다 — 새 자료를 만들지 않으므로
 * 여섯 화면과 어긋날 수 없다.
 *
 * 시계를 부르지 않는다.
 */

export interface StudentSummary {
  attendance: {
    byStatus: Record<AttendanceStatus, number>;
    /** 기록된 날 수(결석·지각·조퇴·체험학습 합) */
    marked: number;
    /** 날짜 내림차순 */
    dates: Array<{ date: string; status: AttendanceStatus; note: string }>;
  };
  reward: {
    /** 통산 획득(되돌린 것 제외) */
    earned: number;
    /** 통산 사용 */
    spent: number;
    balance: number;
    /** 최근 기록, 최신부터 */
    recent: ScoreEntry[];
    redemptions: Redemption[];
  };
  assignments: {
    total: number;
    submitted: number;
    /** 미제출인 진행 중 과제 */
    missing: Assignment[];
  };
  dutyCount: number;
  observations: ObservationEntry[];
}

export function summarizeStudent(
  data: SuiteData,
  studentId: string,
  options: { recentLimit?: number } = {},
): StudentSummary | null {
  const student = data.students.find((item) => item.id === studentId);
  if (student === undefined) return null;
  const classId = student.classId;
  const recentLimit = options.recentLimit ?? 10;

  // ── 출결 ──
  const byStatus: Record<AttendanceStatus, number> = { absent: 0, late: 0, early: 0, fieldTrip: 0 };
  const dates: StudentSummary['attendance']['dates'] = [];
  for (const record of data.attendanceRecords) {
    if (record.classId !== classId) continue;
    const entry = record.entries.find((item) => item.studentId === studentId);
    if (entry === undefined) continue;
    byStatus[entry.status] += 1;
    dates.push({ date: record.date, status: entry.status, note: entry.note });
  }
  dates.sort((a, b) => b.date.localeCompare(a.date));

  // ── 점수·쿠폰 ──
  const mine = data.scoreEntries.filter(
    (entry) => entry.targetUnit === 'student' && entry.targetId === studentId,
  );
  const earned = mine.filter(isCounted).reduce((sum, entry) => sum + entry.points, 0);
  const redemptions = data.redemptions
    .filter((item) => item.targetUnit === 'student' && item.targetId === studentId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const spent = redemptions
    .filter((item) => item.revokedAt === undefined)
    .reduce((sum, item) => sum + item.cost, 0);
  const recent = [...mine]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, recentLimit);

  // ── 과제 ──
  const assignments = visibleAssignments(
    data.assignments.filter((item) => item.classId === classId),
  );
  let submitted = 0;
  const missing: Assignment[] = [];
  for (const assignment of assignments) {
    const status = submissionStatusOf(data.submissions, assignment.id, studentId);
    if (status === 'unsubmitted') {
      if (assignment.status === 'active') missing.push(assignment);
    } else {
      submitted += 1;
    }
  }

  // ── 당번 ──
  const dutyCount =
    countPastAssignments(data.dutyRounds.filter((round) => round.classId === classId)).get(
      studentId,
    ) ?? 0;

  return {
    attendance: { byStatus, marked: dates.length, dates },
    reward: { earned, spent, balance: earned - spent, recent, redemptions },
    assignments: { total: assignments.length, submitted, missing },
    dutyCount,
    observations: observationsOf(data.observations, studentId),
  };
}
