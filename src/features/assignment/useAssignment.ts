import { useCallback, useMemo } from 'react';

import { createAssignment } from '../../shared/domain/factories';
import type {
  Assignment,
  AssignmentStatus,
  Student,
  Submission,
  SubmissionStatus,
} from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import {
  archivedAssignments,
  byDueDate,
  nextStatus,
  statusOf,
  submissionIndex,
  summarize,
  summarizeStudent,
  visibleAssignments,
  type AssignmentProgress,
  type StudentProgress,
} from './assignmentCore';

/** 과제 제출 현황 화면과 저장소를 잇는 훅. */
export interface AssignmentView {
  classId: string | null;
  today: string;
  roster: Student[];
  /** 보관하지 않은 과제. 화면 셋이 전부 이것을 본다. */
  assignments: Assignment[];
  /** 보관한 과제. 보관함에서만 쓴다. */
  archived: Assignment[];
  submissions: Submission[];
  progress: AssignmentProgress[];
  /** 마감이 가까운 순으로 진행 중인 과제 */
  upcoming: AssignmentProgress[];
  /** 학생별 집계. 표 보기·학생별 보기가 쓴다. */
  studentProgress: StudentProgress[];
  /** `assignmentId|studentId` → 상태. 표 보기가 칸마다 배열을 훑지 않게 한다. */
  statusIndex: ReadonlyMap<string, SubmissionStatus>;

  addAssignment: (input: { title: string; description: string; dueDate: string }) => void;
  updateAssignment: (assignmentId: string, patch: Partial<Assignment>) => void;
  /** 마감·보관·다시 열기. 기록은 아무것도 지우지 않는다. */
  setAssignmentStatus: (assignmentId: string, status: AssignmentStatus) => void;
  deleteAssignment: (assignmentId: string) => Promise<void>;
  statusFor: (assignmentId: string, studentId: string) => SubmissionStatus;
  cycleStatus: (assignmentId: string, studentId: string) => SubmissionStatus;
  setStatus: (assignmentId: string, studentId: string, status: SubmissionStatus) => void;
  setAll: (assignmentId: string, status: SubmissionStatus) => void;
  setNote: (assignmentId: string, studentId: string, note: string) => void;
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useAssignment(): AssignmentView {
  const { data, update, guard } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();

  const classId = activeClass?.id ?? null;
  const today = todayString();

  const ofClass = useMemo(
    () =>
      classId === null
        ? []
        : data.assignments.filter((item) => item.classId === classId).sort(byDueDate),
    [data.assignments, classId],
  );

  /*
   * 보관을 빼는 것이 여기 한 곳이다.
   * progress·submissions·statusIndex·studentProgress가 전부 이것에서 나오므로
   * 과제별·표 보기·학생별 세 화면이 자동으로 따라온다.
   */
  const assignments = useMemo(() => visibleAssignments(ofClass), [ofClass]);
  const archived = useMemo(() => archivedAssignments(ofClass), [ofClass]);

  const assignmentIds = useMemo(() => new Set(assignments.map((item) => item.id)), [assignments]);

  const submissions = useMemo(
    () => data.submissions.filter((item) => assignmentIds.has(item.assignmentId)),
    [data.submissions, assignmentIds],
  );

  const progress = useMemo(
    () => assignments.map((assignment) => summarize(assignment, roster, submissions, today)),
    [assignments, roster, submissions, today],
  );

  const upcoming = useMemo(
    () => progress.filter((entry) => entry.assignment.status === 'active'),
    [progress],
  );

  const statusIndex = useMemo(() => submissionIndex(submissions), [submissions]);

  const studentProgress = useMemo(
    () => roster.map((student) => summarizeStudent(student, assignments, submissions, today)),
    [roster, assignments, submissions, today],
  );

  const addAssignment = useCallback(
    (input: { title: string; description: string; dueDate: string }): void => {
      if (classId === null) return;
      const assignment = createAssignment({ classId, ...input });
      update((current) => ({ ...current, assignments: [...current.assignments, assignment] }));
    },
    [classId, update],
  );

  const updateAssignment = useCallback(
    (assignmentId: string, patch: Partial<Assignment>): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        assignments: current.assignments.map((item) =>
          item.id === assignmentId ? { ...item, ...patch, updatedAt: now } : item,
        ),
      }));
    },
    [update],
  );

  const setAssignmentStatus = useCallback(
    (assignmentId: string, status: AssignmentStatus): void => {
      // 삭제와 다르다. 제출 기록은 그대로 둔다. 보관을 풀면 그대로 돌아온다.
      updateAssignment(assignmentId, { status });
    },
    [updateAssignment],
  );

  const deleteAssignment = useCallback(
    async (assignmentId: string): Promise<void> => {
      // 과제를 지우면 그 과제의 제출 기록도 함께 사라진다.
      await guard('과제 삭제 직전');
      update((current) => ({
        ...current,
        assignments: current.assignments.filter((item) => item.id !== assignmentId),
        submissions: current.submissions.filter((item) => item.assignmentId !== assignmentId),
      }));
    },
    [guard, update],
  );

  const statusFor = useCallback(
    (assignmentId: string, studentId: string): SubmissionStatus =>
      statusOf(submissions, assignmentId, studentId),
    [submissions],
  );

  const setStatus = useCallback(
    (assignmentId: string, studentId: string, status: SubmissionStatus): void => {
      const now = new Date().toISOString();

      update((current) => {
        const existing = current.submissions.find(
          (item) => item.assignmentId === assignmentId && item.studentId === studentId,
        );

        // 미제출은 기본값이므로 기록을 남기지 않는다. 저장 용량과 정리 부담이 준다.
        if (status === 'unsubmitted') {
          if (existing === undefined || existing.note === '') {
            return {
              ...current,
              submissions: current.submissions.filter(
                (item) => !(item.assignmentId === assignmentId && item.studentId === studentId),
              ),
            };
          }
        }

        if (existing === undefined) {
          return {
            ...current,
            submissions: [
              ...current.submissions,
              { assignmentId, studentId, status, note: '', updatedAt: now },
            ],
          };
        }

        return {
          ...current,
          submissions: current.submissions.map((item) =>
            item.assignmentId === assignmentId && item.studentId === studentId
              ? { ...item, status, updatedAt: now }
              : item,
          ),
        };
      });
    },
    [update],
  );

  const cycleStatus = useCallback(
    (assignmentId: string, studentId: string): SubmissionStatus => {
      const next = nextStatus(statusOf(submissions, assignmentId, studentId));
      setStatus(assignmentId, studentId, next);
      return next;
    },
    [submissions, setStatus],
  );

  const setAll = useCallback(
    (assignmentId: string, status: SubmissionStatus): void => {
      const now = new Date().toISOString();
      const targets = roster.map((student) => student.id);

      update((current) => {
        const others = current.submissions.filter((item) => item.assignmentId !== assignmentId);
        const kept = current.submissions.filter((item) => item.assignmentId === assignmentId);

        if (status === 'unsubmitted') {
          // 메모가 있는 기록은 남긴다. 지우면 보완 사유가 사라진다.
          return {
            ...current,
            submissions: [
              ...others,
              ...kept
                .filter((item) => item.note !== '')
                .map((item) => ({ ...item, status, updatedAt: now })),
            ],
          };
        }

        const noteByStudent = new Map(kept.map((item) => [item.studentId, item.note]));
        return {
          ...current,
          submissions: [
            ...others,
            ...targets.map((studentId) => ({
              assignmentId,
              studentId,
              status,
              note: noteByStudent.get(studentId) ?? '',
              updatedAt: now,
            })),
          ],
        };
      });
    },
    [roster, update],
  );

  const setNote = useCallback(
    (assignmentId: string, studentId: string, note: string): void => {
      const now = new Date().toISOString();

      update((current) => {
        const existing = current.submissions.find(
          (item) => item.assignmentId === assignmentId && item.studentId === studentId,
        );

        if (existing === undefined) {
          return {
            ...current,
            submissions: [
              ...current.submissions,
              { assignmentId, studentId, status: 'unsubmitted' as const, note, updatedAt: now },
            ],
          };
        }

        return {
          ...current,
          submissions: current.submissions.map((item) =>
            item.assignmentId === assignmentId && item.studentId === studentId
              ? { ...item, note, updatedAt: now }
              : item,
          ),
        };
      });
    },
    [update],
  );

  return {
    classId,
    today,
    roster,
    assignments,
    archived,
    submissions,
    progress,
    upcoming,
    studentProgress,
    statusIndex,
    addAssignment,
    updateAssignment,
    setAssignmentStatus,
    deleteAssignment,
    statusFor,
    cycleStatus,
    setStatus,
    setAll,
    setNote,
  };
}
