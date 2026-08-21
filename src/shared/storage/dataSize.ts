import type { SuiteData } from '../domain/types';
import { byteLength } from './backup';

/**
 * 저장 자료가 얼마나 찼는지.
 *
 * **왜 재나:** 이 앱은 자료 전체를 한 덩어리로 저장한다. Firebase를 붙이면
 * Firestore 문서 하나가 되는데 그 상한이 1MB다. 점수 기록 한 건이 285바이트라
 * 활동·보상을 열심히 쓰면 한 해를 못 채우고 저장이 실패한다.
 *
 * 교사가 그것을 **저장이 실패하는 날 처음 알면 안 된다.**
 *
 * 붙이지 않았으면 브라우저 저장소(5MB 안팎)라 훨씬 여유롭다. 그래서 기본은
 * 조용히 두고, 좁은 쪽 한도에 가까워질 때만 목소리를 낸다.
 *
 * 설계 근거: docs/firebase-guide.md — '진짜 한도는 저장 용량이 아니라 문서 하나의 크기입니다'
 */

/** Firestore 문서 하나의 상한. 둘 중 좁은 쪽이라 이것을 기준으로 잰다. */
export const DOCUMENT_LIMIT_BYTES = 1024 * 1024;

/** 이보다 작으면 아무 말도 하지 않는다. */
const WATCH_BYTES = 500 * 1024;
/** 이보다 크면 지금 정리해야 한다. */
const WARN_BYTES = 900 * 1024;

export type DataSizeLevel = 'ok' | 'watch' | 'warn';

export interface SizeSlice {
  label: string;
  bytes: number;
  /** 전체에서 차지하는 몫 0~1 */
  share: number;
}

export interface DataSizeReport {
  bytes: number;
  /** 문서 한도 대비 0~1. 넘으면 1을 넘는다. */
  ratio: number;
  level: DataSizeLevel;
  /** 자리를 많이 차지하는 순서. 무엇을 정리할지 알려 준다. */
  slices: SizeSlice[];
}

/** 무엇이 자리를 차지하는지. 교사가 정리할 수 있는 단위로 묶는다. */
const GROUPS: ReadonlyArray<{ label: string; pick: (data: SuiteData) => unknown }> = [
  { label: '점수 기록', pick: (d) => d.scoreEntries },
  { label: '과제 제출', pick: (d) => d.submissions },
  { label: '당번 수행', pick: (d) => d.dutyCompletions },
  { label: '당번 배정', pick: (d) => d.dutyRounds },
  { label: '퀴즈 결과', pick: (d) => d.quizResults },
  { label: '문제 세트', pick: (d) => d.quizSets },
  { label: '자리표', pick: (d) => [d.seatingStates, d.savedLayouts] },
  { label: '학생·학급', pick: (d) => [d.students, d.classRooms, d.groups] },
  { label: '수업 흐름', pick: (d) => d.lessonTemplates },
  { label: '업무·문구', pick: (d) => [d.tasks, d.messageTemplates] },
];

function levelOf(bytes: number): DataSizeLevel {
  if (bytes >= WARN_BYTES) return 'warn';
  if (bytes >= WATCH_BYTES) return 'watch';

  return 'ok';
}

export function measureDataSize(data: SuiteData): DataSizeReport {
  const bytes = byteLength(JSON.stringify(data));

  const slices = GROUPS.map((group) => ({
    label: group.label,
    bytes: byteLength(JSON.stringify(group.pick(data))),
  }))
    // 비어 있는 것은 보여 줄 이유가 없다. 목록만 길어진다.
    .filter((slice) => slice.bytes > 2)
    .map((slice) => ({ ...slice, share: bytes === 0 ? 0 : slice.bytes / bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  return { bytes, ratio: bytes / DOCUMENT_LIMIT_BYTES, level: levelOf(bytes), slices };
}

/** 사람이 읽는 크기. 소수점은 KB에서만 쓴다 — MB로 넘어가면 자릿수가 뜻을 잃는다. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
