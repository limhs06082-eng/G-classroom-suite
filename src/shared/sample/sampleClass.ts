import { setNote, setReason, setStatus } from '../../features/attendance/attendanceCore';
import { setItems } from '../../features/notice/noticeCore';
import { createDefaultGroups } from '../../features/seating/groupingCore';
import {
  createAssignment,
  createBehaviorPreset,
  createClassEvent,
  createClassRoom,
  createDutyRole,
  createObservation,
  createRewardItem,
  createScoreEntry,
  createSeatingState,
  createSubmission,
  createTerm,
  STARTER_PRESETS,
  STARTER_REWARD_ITEMS,
  STARTER_ROLES,
} from '../domain/factories';
import type { SuiteData, TimetableEntry } from '../domain/types';
import { createId } from '../ids';
import { removeClassData } from '../roster/classOps';
import type { ParsedRosterRow } from '../roster/parseRosterText';
import { applyRosterImport } from '../roster/rosterOps';

/**
 * 샘플 학급 — 연수 자리의 첫 30초.
 *
 * 빈 앱은 어느 화면을 눌러도 "학급을 먼저 만드세요"다. 가짜 이름 24명과
 * 시간표·일정·칭찬·관찰·출결·과제·모둠·자리·당번·알림장·쿠폰을 한 벌로 세워,
 * 눌러 보는 사람이 매 화면에서 무언가를 본다. `isSample` 표시로 한 번에
 * 지운다. 모든 날짜는 `today` 기준 상대값이라 언제 만들어도 "오늘 생일"이 있다.
 */

export const SAMPLE_CLASS_NAME = '샘플 3학년 2반';

const NAMES = [
  '김서준', '이서연', '박도윤', '최지우', '정하준', '강하은', '조시우', '윤서아',
  '장예준', '임하윤', '한지호', '오수아', '서준우', '신지아', '권민준', '황채원',
  '안유준', '송지민', '류건우', '홍다은', '문시윤', '배소율', '백은우', '노예린',
];

/** YYYY-MM-DD + days. 달을 넘겨도 Date가 되감는다. */
function shift(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const moved = new Date(year, month - 1, day + days);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`;
}

const WEEK: readonly (readonly string[])[] = [
  ['국어', '수학', '영어', '과학', '체육'],
  ['수학', '국어', '사회', '음악', '미술', '창체'],
  ['영어', '국어', '수학', '체육', '도덕'],
  ['국어', '과학', '사회', '수학', '실과', '창체'],
  ['수학', '영어', '국어', '음악', '체육'],
];

export function hasSampleClass(data: SuiteData): boolean {
  return data.classRooms.some((room) => room.isSample === true);
}

/** 이미 있으면 그대로(같은 객체). 없으면 한 벌을 세우고 그 학급을 본다. */
export function createSampleClass(data: SuiteData, today: string, now: string): SuiteData {
  if (hasSampleClass(data)) return data;

  const [todayYear = 2026, todayMonth = 3] = today.split('-').map(Number);

  // 학기: 보고 있는 학기가 있으면 거기에, 없으면 샘플 학기를 만든다.
  const existingTerm =
    data.terms.find((term) => term.id === data.activeTermId) ?? data.terms[0] ?? null;
  const schoolYear = todayMonth < 3 ? todayYear - 1 : todayYear;
  const sampleTerm =
    existingTerm ??
    createTerm(
      {
        schoolYear: String(schoolYear),
        semester: todayMonth >= 3 && todayMonth <= 8 ? '1학기' : '2학기',
        startDate: `${schoolYear}-03-02`,
        endDate: `${schoolYear + 1}-02-28`,
        isSample: true,
      },
      now,
    );
  const room = createClassRoom(
    { termId: sampleTerm.id, name: SAMPLE_CLASS_NAME, grade: 3, classNo: 2, isSample: true },
    now,
  );
  const classId = room.id;

  let next: SuiteData = {
    ...data,
    terms: existingTerm === null ? [...data.terms, sampleTerm] : data.terms,
    classRooms: [...data.classRooms, room],
    activeTermId: sampleTerm.id,
    activeClassId: classId,
  };

  // 학생 24명 — 명단 붙여넣기와 같은 길로 넣어 프로필까지 같이 선다.
  const rows: ParsedRosterRow[] = NAMES.map((name, index) => {
    const offset = index === 0 ? 0 : index === 1 ? 3 : index * 13 - 150;
    const birthday = `${todayYear - 9}${shift(today, offset).slice(4)}`;
    return { line: index + 1, number: index + 1, name, birthday };
  });
  next = applyRosterImport(next, classId, rows, 'replace', now);
  const students = next.students.filter((student) => student.classId === classId);
  const ids = students.map((student) => student.id);
  next = {
    ...next,
    seatingProfiles: next.seatingProfiles.map((profile) => {
      const index = ids.indexOf(profile.studentId);
      return index === -1 ? profile : { ...profile, gender: index % 2 === 0 ? 'male' : 'female' };
    }),
  };

  // 시간표
  const timetableEntries: TimetableEntry[] = WEEK.flatMap((subjects, dayIndex) =>
    subjects.map((subject, periodIndex) => ({
      classId,
      weekday: dayIndex + 1,
      period: periodIndex + 1,
      subject,
    })),
  );

  // 일정
  const classEvents = [
    createClassEvent({ classId, date: shift(today, 3), title: '수학 수행평가', note: '3단원' }, now),
    createClassEvent({ classId, date: shift(today, 9), title: '현장체험학습', note: '도시락·물 챙기기' }, now),
    createClassEvent({ classId, date: shift(today, 20), title: '학부모 상담 주간', note: '' }, now),
  ];

  // 칭찬 항목과 기록 — 최근 열흘. 지도(감점)도 둘 있어 "초안에 안 들어감"을 보여 준다.
  const presets = STARTER_PRESETS.map((preset, index) =>
    createBehaviorPreset({ classId, ...preset, order: index }, now),
  );
  const studentPresets = presets.filter((preset) => preset.targetUnit === 'student' && preset.defaultPoints > 0);
  const minus = presets.find((preset) => preset.defaultPoints < 0);
  const scoreEntries = ids.flatMap((studentId, index) => {
    const entries = [];
    const picks = [index % 3 === 0 ? 0 : -1, index % 4 === 0 ? 1 : -1, index % 5 === 0 ? 2 : -1, index % 2 === 0 ? 0 : -1]
      .filter((pick) => pick >= 0);
    for (const [k, pick] of picks.entries()) {
      const preset = studentPresets[pick];
      if (preset === undefined) continue;
      entries.push(
        createScoreEntry(
          {
            classId,
            targetUnit: 'student',
            targetId: studentId,
            points: preset.defaultPoints,
            reason: preset.name,
            presetId: preset.id,
            occurredAt: `${shift(today, -1 - ((index + k * 3) % 10))}T01:00:00.000Z`,
          },
          now,
        ),
      );
    }
    if (minus !== undefined && (index === 4 || index === 17)) {
      entries.push(
        createScoreEntry(
          {
            classId,
            targetUnit: 'student',
            targetId: studentId,
            points: minus.defaultPoints,
            reason: minus.name,
            presetId: minus.id,
            occurredAt: `${shift(today, -2)}T02:00:00.000Z`,
          },
          now,
        ),
      );
    }
    return entries;
  });

  // 관찰 기록
  const notes: [number, number, string][] = [
    [0, -12, '모둠 활동에서 친구의 의견을 끝까지 듣고 정리해 발표함'],
    [1, -10, '급식 후 자기 자리 주변을 스스로 정리함'],
    [2, -8, '수학 문제를 다른 방법으로도 풀어 보려고 함'],
    [5, -6, '전학 온 친구에게 먼저 다가가 규칙을 알려 줌'],
    [9, -4, '독서 시간에 책을 고르고 끝까지 읽는 습관이 생김'],
    [13, -2, '체육 시간에 팀을 격려하는 말을 자주 함'],
  ];
  const observations = notes.flatMap(([index, offset, text]) => {
    const studentId = ids[index];
    return studentId === undefined
      ? []
      : [createObservation({ classId, studentId, text, date: shift(today, offset) }, now)];
  });

  // 출결 — 지난주 결석 둘, 지각 하나. 사유와 분류까지.
  let attendanceRecords = next.attendanceRecords;
  const mark = (index: number, offset: number, status: 'absent' | 'late', note: string, reason: 'illness' | 'other' | 'authorized') => {
    const studentId = ids[index];
    if (studentId === undefined) return;
    const date = shift(today, offset);
    attendanceRecords = setStatus(attendanceRecords, classId, date, studentId, status);
    attendanceRecords = setNote(attendanceRecords, classId, date, studentId, note);
    attendanceRecords = setReason(attendanceRecords, classId, date, studentId, reason);
  };
  mark(5, -6, 'absent', '감기', 'illness');
  mark(12, -4, 'late', '병원 진료', 'other');
  mark(18, -2, 'absent', '가족 행사', 'authorized');

  // 과제 둘 — 하나는 마감 지남(대부분 제출), 하나는 모레 마감(절반 제출).
  const reading = createAssignment({ classId, title: '독서록 3권', dueDate: shift(today, -2), status: 'active' }, now);
  const math = createAssignment({ classId, title: '수학 익힘책 24~27쪽', dueDate: shift(today, 2), status: 'active' }, now);
  const submissions = [
    ...ids.slice(0, 20).map((studentId, index) => createSubmission(reading.id, studentId, index % 7 === 0 ? 'supplement' : 'submitted', now)),
    ...ids.slice(0, 10).map((studentId) => createSubmission(math.id, studentId, 'submitted', now)),
  ];

  // 모둠 넷, 번호순으로 돌아가며.
  const groups = createDefaultGroups(4, classId, now).map((group, groupIndex) => {
    const studentIds = ids.filter((_, index) => index % 4 === groupIndex);
    return { ...group, studentIds, leaderId: studentIds[0] ?? null };
  });

  // 자리 5×6, 번호순.
  const seating = {
    ...createSeatingState(classId, now),
    positions: ids.map((studentId, index) => ({
      studentId,
      seatId: `r${Math.floor(index / 6) + 1}c${(index % 6) + 1}`,
    })),
  };

  const dutyRoles = STARTER_ROLES.map((preset) => createDutyRole({ classId, ...preset }, now));
  const rewardItems = STARTER_REWARD_ITEMS.map((item, index) =>
    createRewardItem({ classId, ...item, order: index }, now),
  );

  const notices = setItems(next.notices, classId, today, [
    { id: createId(), text: '내일 수학 익힘책 24~27쪽 검사' },
    { id: createId(), text: '우유갑 접어서 정리하기' },
    { id: createId(), text: '금요일 현장체험학습 안내문 부모님께 드리기' },
  ]);

  return {
    ...next,
    timetableEntries: [...next.timetableEntries, ...timetableEntries],
    classEvents: [...next.classEvents, ...classEvents],
    behaviorPresets: [...next.behaviorPresets, ...presets],
    scoreEntries: [...next.scoreEntries, ...scoreEntries],
    observations: [...next.observations, ...observations],
    attendanceRecords,
    assignments: [...next.assignments, reading, math],
    submissions: [...next.submissions, ...submissions],
    groups: [...next.groups, ...groups],
    seatingStates: [...next.seatingStates, seating],
    dutyRoles: [...next.dutyRoles, ...dutyRoles],
    rewardItems: [...next.rewardItems, ...rewardItems],
    notices,
  };
}

/** 샘플 학급과, 샘플을 위해 만든 학기를 지운다. 마지막 학급이어도 지운다. */
export function removeSampleClass(data: SuiteData): SuiteData {
  let next = data;
  for (const room of data.classRooms.filter((item) => item.isSample === true)) {
    next = removeClassData(next, room.id);
  }

  const orphanSampleTerms = new Set(
    next.terms
      .filter((term) => term.isSample === true && !next.classRooms.some((room) => room.termId === term.id))
      .map((term) => term.id),
  );
  if (orphanSampleTerms.size === 0) return next;

  const terms = next.terms.filter((term) => !orphanSampleTerms.has(term.id));
  const activeTermId =
    next.activeTermId !== null && orphanSampleTerms.has(next.activeTermId)
      ? (terms[0]?.id ?? null)
      : next.activeTermId;
  return { ...next, terms, activeTermId };
}
