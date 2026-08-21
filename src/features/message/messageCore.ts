import type { MessageTemplate, SchoolProfile } from '../../shared/domain/types';

/**
 * 문구 치환.
 *
 * 원본 G-school-message-templates에서 치환이 화면 안에 있었다.
 * "치환되지 않은 자리표시자가 그대로 학부모에게 나가는" 사고를 막으려면
 * 남은 자리표시자를 셀 수 있어야 한다.
 */

export interface MessageContext {
  profile: SchoolProfile;
  /** YYYY-MM-DD. 비우면 오늘 */
  date?: string;
  place?: string;
  /** 그 밖의 임시 값. 키는 자리표시자 이름과 같다. */
  extras?: Record<string, string>;
}

export const PLACEHOLDERS = ['학교', '학년', '반', '교사', '날짜', '장소'] as const;

function formatKoreanDate(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;

  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

function valuesFor(context: MessageContext): Record<string, string> {
  const { profile } = context;

  return {
    학교: profile.schoolName,
    학년: profile.grade,
    반: profile.classNo,
    교사: profile.teacherName,
    날짜: context.date === undefined || context.date === '' ? '' : formatKoreanDate(context.date),
    장소: context.place ?? '',
    ...context.extras,
  };
}

export interface RenderResult {
  text: string;
  /** 값이 비어 채우지 못한 자리표시자. 그대로 내보내면 사고다. */
  missing: string[];
}

/**
 * {학교} 같은 자리표시자를 채운다.
 *
 * 값이 비어 있으면 자리표시자를 그대로 남긴다. 빈 문자열로 지워 버리면
 * "3학년 반 학부모님께"처럼 어색한 문장이 조용히 나간다.
 */
export function renderMessage(body: string, context: MessageContext): RenderResult {
  const values = valuesFor(context);
  const missing = new Set<string>();

  const text = body.replace(/\{([^{}]+)\}/g, (whole, rawKey: string) => {
    const key = rawKey.trim();
    const value = values[key];

    if (value === undefined || value.trim() === '') {
      missing.add(key);
      return whole;
    }
    return value;
  });

  return { text, missing: [...missing].sort() };
}

/** 본문에 쓰인 자리표시자 목록. 미리보기에서 무엇을 채워야 하는지 보여 준다. */
export function placeholdersIn(body: string): string[] {
  const found = new Set<string>();

  for (const match of body.matchAll(/\{([^{}]+)\}/g)) {
    const key = match[1]?.trim();
    if (key !== undefined && key !== '') found.add(key);
  }
  return [...found].sort();
}

/**
 * 개인정보가 들어갔는지 훑는다.
 *
 * 문구 템플릿에 학생 이름·연락처를 적어 두면 다른 학부모에게 잘못 나갈 수 있다.
 * 막지는 않고 알리기만 한다. 교사가 판단할 일이다.
 */
export function privacyWarnings(text: string): string[] {
  const warnings: string[] = [];

  if (/01[016-9][-\s]?\d{3,4}[-\s]?\d{4}/.test(text)) {
    warnings.push('휴대전화 번호로 보이는 문자열이 있습니다.');
  }
  if (/\d{6}\s?-\s?\d{7}/.test(text)) {
    warnings.push('주민등록번호로 보이는 문자열이 있습니다.');
  }
  return warnings;
}

// ── 기본 문구 ─────────────────────────────────────────────────

interface BuiltIn {
  id: string;
  category: MessageTemplate['category'];
  title: string;
  body: string;
}

/**
 * 기본 제공 문구.
 *
 * 빈 화면에서 문구를 처음부터 쓰게 하면 이 도구를 쓸 이유가 없다.
 * 실제로 자주 보내는 것만 골랐다. 교사가 고쳐서 자기 문구로 저장할 수 있다.
 */
export const BUILT_IN_TEMPLATES: readonly BuiltIn[] = [
  {
    id: 'builtin-supplies',
    category: '준비물 안내',
    title: '준비물 안내',
    body:
      '안녕하세요. {학교} {학년}학년 {반}반 담임 {교사}입니다.\n' +
      '{날짜} 수업에 필요한 준비물을 안내드립니다.\n\n' +
      '· 준비물: {준비물}\n\n' +
      '아이 편에 챙겨 보내 주시면 감사하겠습니다.',
  },
  {
    id: 'builtin-absence',
    category: '결석·미제출',
    title: '과제 미제출 안내',
    body:
      '안녕하세요. {학교} {학년}학년 {반}반 담임 {교사}입니다.\n' +
      '{날짜} 기준으로 제출되지 않은 과제가 있어 안내드립니다.\n\n' +
      '· 과제: {과제명}\n\n' +
      '확인 후 챙겨 주시면 감사하겠습니다.',
  },
  {
    id: 'builtin-consult',
    category: '상담 안내',
    title: '학부모 상담 안내',
    body:
      '안녕하세요. {학교} {학년}학년 {반}반 담임 {교사}입니다.\n' +
      '학부모 상담 주간을 맞아 상담 일정을 안내드립니다.\n\n' +
      '· 일시: {날짜}\n' +
      '· 장소: {장소}\n\n' +
      '가능하신 시간을 회신해 주시면 조정하겠습니다.',
  },
  {
    id: 'builtin-event',
    category: '행사 안내',
    title: '행사 안내',
    body:
      '안녕하세요. {학교} {학년}학년 {반}반 담임 {교사}입니다.\n' +
      '{행사명} 안내드립니다.\n\n' +
      '· 일시: {날짜}\n' +
      '· 장소: {장소}\n' +
      '· 준비물: {준비물}\n\n' +
      '자세한 내용은 가정통신문을 확인해 주세요.',
  },
  {
    id: 'builtin-staff',
    category: '교직원 공지',
    title: '회의 안내',
    body:
      '선생님들께 안내드립니다.\n\n' +
      '· 일시: {날짜}\n' +
      '· 장소: {장소}\n' +
      '· 안건: {안건}\n\n' +
      '참석 부탁드립니다. 감사합니다.',
  },
  {
    id: 'builtin-thanks',
    category: '감사 인사',
    title: '학기말 감사 인사',
    body:
      '안녕하세요. {학교} {학년}학년 {반}반 담임 {교사}입니다.\n' +
      '한 학기 동안 아이들을 믿고 맡겨 주셔서 감사합니다.\n' +
      '가정에서 보내 주신 관심과 협조 덕분에 잘 마무리할 수 있었습니다.\n\n' +
      '건강하고 즐거운 방학 보내시기 바랍니다.',
  },
];
