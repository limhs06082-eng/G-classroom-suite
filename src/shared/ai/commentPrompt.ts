import type { SuiteData } from '../domain/types';
import { praiseCounts } from '../roster/behaviorCommentCore';
import { summarizeStudent, type DateRange } from '../roster/studentSummary';
import type { AiPrompt } from './providers';

/**
 * AI에 보낼 사실 — **이름·번호가 없다.**
 *
 * 바깥 회사 서버로 나가는 것은 이 구조체를 글로 편 것이 전부다. 학생을
 * 가리키는 것은 하나도 넣지 않는다. 관찰 기록 원문은 들어간다 — 그것이
 * 글의 재료라서. 화면이 이 사실을 교사에게 알린다.
 */
export interface CommentFacts {
  /** perfect: 이 학급이 출결을 쓰고 이 학생은 기록 없음 · absent: 기록 있음 · unknown: 학급이 출결을 안 씀 */
  attendance: 'perfect' | 'absent' | 'unknown';
  absentDays: number;
  lateDays: number;
  earlyDays: number;
  fieldTripDays: number;
  /** 칭찬(양수) 기록, 많은 순. 지도(음수)는 넣지 않는다. */
  praise: { reason: string; count: number }[];
  dutyCount: number;
  assignments: { total: number; submitted: number };
  /** 오래된 것부터 */
  observations: { date: string; text: string }[];
}

export function collectCommentFacts(
  data: SuiteData,
  studentId: string,
  range?: DateRange,
): CommentFacts | null {
  const student = data.students.find((item) => item.id === studentId);
  if (student === undefined) return null;
  const summary = summarizeStudent(data, studentId, range === undefined ? {} : { range });
  if (summary === null) return null;

  const inRange = (date: string): boolean =>
    range === undefined || (date.slice(0, 10) >= range.from && date.slice(0, 10) <= range.to);
  const classUsesAttendance = data.attendanceRecords.some(
    (record) => record.classId === student.classId && inRange(record.date),
  );

  return {
    attendance: !classUsesAttendance ? 'unknown' : summary.attendance.marked === 0 ? 'perfect' : 'absent',
    absentDays: summary.attendance.byStatus.absent,
    lateDays: summary.attendance.byStatus.late,
    earlyDays: summary.attendance.byStatus.early,
    fieldTripDays: summary.attendance.byStatus.fieldTrip,
    praise: praiseCounts(data, studentId, inRange).slice(0, 5),
    dutyCount: summary.dutyCount,
    assignments: { total: summary.assignments.total, submitted: summary.assignments.submitted },
    observations: [...summary.observations]
      .reverse()
      .map((entry) => ({ date: entry.date, text: entry.text.trim() }))
      .filter((entry) => entry.text !== ''),
  };
}

const SYSTEM_PROMPT = [
  '당신은 한국 초·중·고 담임교사를 돕는 조수입니다. 주어진 사실만으로 학교생활기록부의 "행동특성 및 종합의견"을 씁니다.',
  '규칙:',
  '1. 한 단락으로, 공백 포함 500자 이내로 씁니다.',
  '2. 문장은 "-함", "-임", "-보임"처럼 명사형으로 끝맺는 개조식 문체를 씁니다.',
  '3. 학생의 이름·번호·"이 학생" 같은 지칭을 쓰지 않고 주어를 생략합니다.',
  '4. 주어진 사실에 없는 내용을 지어내지 않습니다. 사실을 근거로 긍정적 특성과 성장 가능성을 씁니다.',
  '5. 감점·지도 기록은 주어지지 않습니다. 부정적 표현이나 평가 점수를 쓰지 않습니다.',
  '6. 결과 글만 출력합니다. 머리말·따옴표·설명·번호를 붙이지 않습니다.',
].join('\n');

function attendanceLine(facts: CommentFacts): string {
  if (facts.attendance === 'unknown') return '출결: 기록 없음';
  if (facts.attendance === 'perfect') return '출결: 개근';
  const parts = [
    facts.absentDays > 0 ? `결석 ${facts.absentDays}일` : '',
    facts.lateDays > 0 ? `지각 ${facts.lateDays}일` : '',
    facts.earlyDays > 0 ? `조퇴 ${facts.earlyDays}일` : '',
    facts.fieldTripDays > 0 ? `체험학습 ${facts.fieldTripDays}일` : '',
  ].filter((part) => part !== '');
  return `출결: ${parts.join(', ')}`;
}

export function buildCommentPrompt(facts: CommentFacts): AiPrompt {
  const lines = ['다음 사실로 행동특성 및 종합의견을 써 주세요.', '', attendanceLine(facts)];

  lines.push(
    facts.praise.length === 0
      ? '칭찬 기록: 없음'
      : `칭찬 기록: ${facts.praise.map((item) => `${item.reason} ${item.count}회`).join(', ')}`,
  );
  lines.push(`당번 활동: ${facts.dutyCount}회`);
  lines.push(
    facts.assignments.total === 0
      ? '과제: 기록 없음'
      : `과제: ${facts.assignments.total}건 중 ${facts.assignments.submitted}건 제출`,
  );
  lines.push('관찰 기록:');
  if (facts.observations.length === 0) {
    lines.push('- 없음');
  } else {
    for (const entry of facts.observations) lines.push(`- ${entry.date}: ${entry.text}`);
  }

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}
