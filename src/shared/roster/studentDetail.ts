import { createDutyProfile, createRewardProfile, createSeatingProfile } from '../domain/factories';
import type { Gender, SuiteData } from '../domain/types';

/**
 * 학생 한 명의 부가 정보.
 *
 * 세 기능(자리·보상·당번)에 흩어져 저장되지만 교사에게는 전부
 * "이 학생의 정보"다. 명단을 한 번만 등록한다는 통합의 전제와 같은 논리로
 * 한 화면에서 함께 다룬다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-14-missing-input-screens-design.md §2
 */
export interface StudentDetail {
  gender: Gender;
  /** 자리 배치 조건에 쓰는 특성 태그 */
  tags: string[];
  /** 이웃에 앉히지 않을 학생 */
  avoidStudentIds: string[];
  nickname: string;
  fixedRoleId: string | null;
}

/** 앞뒤 공백을 없애고 빈 값과 중복을 뺀다. 중복은 배치 조건 계산을 어긋나게 한다. */
function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed !== '') seen.add(trimmed);
  }
  return [...seen];
}

export function readStudentDetail(data: SuiteData, studentId: string): StudentDetail {
  const seating = data.seatingProfiles.find((p) => p.studentId === studentId);
  const reward = data.rewardProfiles.find((p) => p.studentId === studentId);
  const duty = data.dutyProfiles.find((p) => p.studentId === studentId);

  return {
    gender: seating?.gender ?? 'none',
    tags: [...(seating?.tags ?? [])],
    avoidStudentIds: [...(seating?.avoidStudentIds ?? [])],
    nickname: reward?.nickname ?? '',
    fixedRoleId: duty?.fixedRoleId ?? null,
  };
}

/**
 * 세 프로필을 한 번에 갱신한다.
 *
 * update를 세 번 나눠 부르지 않는다. 중간에 실패하면 학생 정보가 반쪽이 된다.
 */
export function applyStudentDetail(
  data: SuiteData,
  studentId: string,
  patch: Partial<StudentDetail>,
): SuiteData {
  const student = data.students.find((s) => s.id === studentId);
  if (student === undefined) return data;

  /*
   * 고정 역할은 그 학생 학급의 역할이어야 한다.
   * 화면에서 못 고르게 막지만 가져오기 같은 다른 경로로도 들어올 수 있고,
   * 참조가 깨지면 불변조건 검사가 조용히 되돌린다. 여기서 먼저 막는다.
   */
  let fixedRoleId = patch.fixedRoleId;
  if (fixedRoleId !== undefined && fixedRoleId !== null) {
    const role = data.dutyRoles.find((r) => r.id === fixedRoleId);
    if (role === undefined || role.classId !== student.classId) fixedRoleId = null;
  }

  // 명단 가져오기 경로에 따라 프로필이 없을 수 있다. 없으면 만들어 넣는다.
  const seatingProfiles = data.seatingProfiles.some((p) => p.studentId === studentId)
    ? data.seatingProfiles
    : [...data.seatingProfiles, createSeatingProfile(studentId)];
  const rewardProfiles = data.rewardProfiles.some((p) => p.studentId === studentId)
    ? data.rewardProfiles
    : [...data.rewardProfiles, createRewardProfile(studentId)];
  const dutyProfiles = data.dutyProfiles.some((p) => p.studentId === studentId)
    ? data.dutyProfiles
    : [...data.dutyProfiles, createDutyProfile(studentId, student.number)];

  return {
    ...data,
    seatingProfiles: seatingProfiles.map((p) =>
      p.studentId !== studentId
        ? p
        : {
            ...p,
            gender: patch.gender ?? p.gender,
            tags: patch.tags === undefined ? p.tags : cleanTags(patch.tags),
            // 자기 자신·다른 반은 여기서 거른다. 불변조건 검사도 한 번 더 본다.
            avoidStudentIds:
              patch.avoidStudentIds === undefined
                ? p.avoidStudentIds
                : [...new Set(patch.avoidStudentIds)].filter((id) => {
                    const other = data.students.find((s) => s.id === id);
                    return id !== studentId && other?.classId === student.classId;
                  }),
          },
    ),
    rewardProfiles: rewardProfiles.map((p) =>
      p.studentId !== studentId ? p : { ...p, nickname: patch.nickname ?? p.nickname },
    ),
    dutyProfiles: dutyProfiles.map((p) => {
      if (p.studentId !== studentId) return p;
      // patch에서 undefined는 "안 넘김"이다. 넘기지 않았으면 그대로 둔다.
      if (fixedRoleId === undefined) return p;

      /*
       * DutyProfile.fixedRoleId는 optional이다. "없음"을 null이 아니라
       * 키를 빼서 표현한다. null을 넣으면 저장 자료에 "fixedRoleId": null이 남고,
       * undefined만 예상하는 다른 코드가 틀린다.
       */
      if (fixedRoleId === null) {
        const { fixedRoleId: _dropped, ...rest } = p;
        return rest;
      }
      return { ...p, fixedRoleId };
    }),
  };
}

/** 그 학급에서 이미 쓴 태그. 새로 칠 때 고를 수 있게 보여 준다. */
export function collectTags(data: SuiteData, classId: string): string[] {
  const ids = new Set(data.students.filter((s) => s.classId === classId).map((s) => s.id));
  const tags = new Set<string>();

  for (const profile of data.seatingProfiles) {
    if (!ids.has(profile.studentId)) continue;
    for (const tag of profile.tags) tags.add(tag);
  }

  return [...tags].sort((a, b) => a.localeCompare(b, 'ko'));
}
