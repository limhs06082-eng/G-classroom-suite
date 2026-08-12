import {
  createClassRoom,
  createDutyProfile,
  createRewardProfile,
  createSeatingProfile,
  createStudent,
  createTerm,
} from '../domain/factories';
import type { SuiteData } from '../domain/types';

/**
 * 원본 앱에서 쓰던 데이터 가져오기.
 *
 * 연수 전에 원본 앱을 이미 써 본 교사를 위한 1회성 통로다.
 * 원본 5개 앱은 같은 브라우저의 다른 키에 자료를 남겨 두었으므로,
 * 그 키를 읽어 통합본 형식으로 옮긴다.
 *
 * 원칙:
 *   - **원본 키는 절대 지우지 않는다.** 옮기기가 잘못돼도 되돌아갈 곳이 있어야 한다.
 *   - 학생은 (번호, 이름)으로 같은 사람인지 본다. 애매하면 새 학생으로 만든다.
 *   - 읽지 못한 항목은 개수를 세어 보고한다.
 */

export const LEGACY_KEYS = {
  dashboard: 'class_master_dashboard_data_v1',
  seating: 'SEATING_HELPER_APP_DATA_V1',
  duty: 'class_duty_manager_app_data_v2',
  reward: 'class_activity_manager_v1_data',
  assignmentStudents: 'student_tracker_students_v1',
  assignmentClasses: 'student_tracker_classes_v1',
} as const;

export interface LegacySource {
  key: string;
  /** 화면에 보여 줄 앱 이름 */
  label: string;
  studentCount: number;
}

export interface LegacyScanResult {
  sources: LegacySource[];
  totalStudents: number;
}

interface RawStudent {
  number?: unknown;
  name?: unknown;
  order?: unknown;
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 원본마다 학생 목록이 놓인 자리가 다르다. 알려진 자리를 차례로 뒤진다. */
function extractStudents(value: unknown): RawStudent[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as RawStudent[];
  }
  if (!isRecord(value)) return [];

  for (const key of ['students', 'studentList', 'roster']) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord) as RawStudent[];
  }
  return [];
}

function toName(raw: RawStudent): string {
  return typeof raw.name === 'string' ? raw.name.trim() : '';
}

function toNumber(raw: RawStudent, fallback: number): number {
  if (typeof raw.number === 'number' && Number.isFinite(raw.number)) return raw.number;
  if (typeof raw.order === 'number' && Number.isFinite(raw.order)) return raw.order;
  return fallback;
}

/** 이 브라우저에 원본 앱 자료가 있는지 훑는다. 아무것도 바꾸지 않는다. */
export function scanLegacy(storage: Storage): LegacyScanResult {
  const labels: Record<string, string> = {
    [LEGACY_KEYS.seating]: '자리배치·모둠 편성 도우미',
    [LEGACY_KEYS.duty]: '학급 역할·당번 관리판',
    [LEGACY_KEYS.reward]: '학급 활동·보상 관리판',
    [LEGACY_KEYS.assignmentStudents]: '학생 자료·과제 제출 현황',
    [LEGACY_KEYS.dashboard]: '우리 반 종합 대시보드',
  };

  const sources: LegacySource[] = [];

  for (const [key, label] of Object.entries(labels)) {
    const value = readJson(storage, key);
    if (value === null) continue;

    const students = extractStudents(value);
    sources.push({ key, label, studentCount: students.length });
  }

  return {
    sources,
    totalStudents: sources.reduce((sum, source) => sum + source.studentCount, 0),
  };
}

export interface LegacyImportResult {
  data: SuiteData;
  importedStudents: number;
  skipped: number;
  /** 어느 앱에서 몇 명을 가져왔는지 */
  fromSources: Array<{ label: string; count: number }>;
}

/**
 * 원본 자료에서 학생 명단을 만들어 넣는다.
 *
 * 명단만 옮긴다. 자리 배치·점수·당번 이력은 원본마다 구조가 크게 달라
 * 잘못 옮기면 조용히 틀린 기록이 생긴다. 그보다는 명단을 정확히 옮기고
 * 나머지는 새로 시작하는 편이 안전하다.
 */
export function importLegacyRoster(
  data: SuiteData,
  storage: Storage,
  options: { termName?: string; className?: string } = {},
  now: string = new Date().toISOString(),
): LegacyImportResult {
  const scan = scanLegacy(storage);

  // 학생이 가장 많은 원본을 기준으로 삼는다. 가장 최근까지 쓴 앱일 가능성이 높다.
  const primary = [...scan.sources].sort((a, b) => b.studentCount - a.studentCount)[0];
  if (primary === undefined || primary.studentCount === 0) {
    return { data, importedStudents: 0, skipped: 0, fromSources: [] };
  }

  const rawStudents = extractStudents(readJson(storage, primary.key));

  // 넣을 학급을 준비한다. 이미 활성 학급이 있으면 거기에 넣는다.
  let next = data;
  let classId = data.activeClassId;

  if (classId === null) {
    const year = String(new Date(now).getFullYear());
    const term = createTerm(
      {
        schoolYear: year,
        semester: '1학기',
        ...(options.termName === undefined ? {} : { name: options.termName }),
        startDate: `${year}-03-02`,
        endDate: `${Number(year) + 1}-02-28`,
      },
      now,
    );
    const room = createClassRoom({ termId: term.id, name: options.className ?? '우리 반' }, now);

    classId = room.id;
    next = {
      ...next,
      terms: [...next.terms, term],
      classRooms: [...next.classRooms, room],
      activeTermId: term.id,
      activeClassId: room.id,
    };
  }

  const existing = next.students.filter((student) => student.classId === classId);
  const existingKeys = new Set(existing.map((student) => `${student.number}:${student.name}`));

  const created: SuiteData['students'] = [];
  let skipped = 0;
  const usedNumbers = new Set(existing.map((student) => student.number));

  rawStudents.forEach((raw, index) => {
    const name = toName(raw);
    if (name === '') {
      skipped += 1;
      return;
    }

    let number = toNumber(raw, index + 1);
    if (existingKeys.has(`${number}:${name}`)) {
      // 이미 같은 사람이 있다. 중복으로 넣지 않는다.
      skipped += 1;
      return;
    }
    while (usedNumbers.has(number)) number += 1;
    usedNumbers.add(number);

    created.push(createStudent({ classId: classId as string, number, name }, now));
  });

  next = {
    ...next,
    students: [...next.students, ...created],
    seatingProfiles: [
      ...next.seatingProfiles,
      ...created.map((student) => createSeatingProfile(student.id)),
    ],
    dutyProfiles: [
      ...next.dutyProfiles,
      ...created.map((student) => createDutyProfile(student.id, student.number)),
    ],
    rewardProfiles: [
      ...next.rewardProfiles,
      ...created.map((student) => createRewardProfile(student.id)),
    ],
  };

  return {
    data: next,
    importedStudents: created.length,
    skipped,
    fromSources: [{ label: primary.label, count: created.length }],
  };
}
