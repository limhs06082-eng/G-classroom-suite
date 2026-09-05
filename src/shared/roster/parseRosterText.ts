/**
 * 학생 명단 붙여넣기·CSV 파서.
 *
 * 원본 3개 앱이 서로 다른 형식을 기대했다. 교사가 이미 익숙한 형식을 모두 받는다.
 *
 *   번호,이름     ← assignment (CSV, 헤더 있어도 됨)
 *   번호<탭>이름  ← 엑셀에서 복사
 *   1 김민준      ← seating
 *   김가람        ← duty (이름만)
 *   반,번호,이름  ← 여러 학급을 한 번에
 *
 * 원본 파서와의 가장 큰 차이: **읽지 못한 줄을 조용히 버리지 않는다.**
 * 25명을 붙여넣었는데 23명만 들어가면 교사는 그 사실을 알 방법이 없었다.
 */

export interface ParsedRosterRow {
  /** 1부터 세는 원본 줄 번호. 문제를 보고할 때 쓴다. */
  line: number;
  number: number;
  name: string;
  /** 여러 학급을 한 번에 붙여넣은 경우 */
  className?: string;
  /** 생년월일 열이 있었으면 YYYY-MM-DD */
  birthday?: string;
}

export interface RosterParseIssue {
  line: number;
  text: string;
  /** 교사가 읽을 한국어 설명 */
  reason: string;
}

export interface RosterParseResult {
  rows: ParsedRosterRow[];
  issues: RosterParseIssue[];
  /** 번호가 없어 자동으로 매긴 학생 수 */
  autoNumberedCount: number;
  /** 같은 번호가 둘 이상인 번호 목록 */
  duplicateNumbers: number[];
  /** 같은 이름이 둘 이상인 이름 목록 (동명이인일 수 있으므로 오류가 아니라 확인 대상) */
  duplicateNames: string[];
  /** 헤더 줄을 건너뛰었는지 */
  headerSkipped: boolean;
}

const HEADER_HINTS = ['번호', '이름', '성명', '반', 'name', 'number', 'no', 'class', '생년월일', '생일'];

const DATE_FORMS = [
  /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/,
  /^(\d{4})(\d{2})(\d{2})$/,
  /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/,
];

/** 날짜 꼴이면 `{ valid }`, 아니면 null. 꼴은 맞는데 값이 엉뚱하면 `valid: null` — 열은 걷어내되 생일은 없다. */
function readDate(token: string): { valid: string | null } | null {
  for (const form of DATE_FORMS) {
    const match = form.exec(token.trim());
    if (match === null) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return { valid: null };
    return { valid: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }
  return null;
}

/**
 * 생년월일로 보이는 칸을 떼어낸다. NEIS 명단에 흔한 열이라 번호·이름 해석을
 * 건드리지 않고 먼저 걷어낸다. 공백 분리 줄("1 김하나 2015-09-07")은 이름 칸
 * 끝에 날짜가 붙어 오므로 마지막 토막도 본다. 값이 엉뚱한 날짜는 열만 걷어낸다.
 */
function pickBirthday(fields: string[]): { rest: string[]; birthday?: string } {
  for (const [index, field] of fields.entries()) {
    const whole = readDate(field);
    if (whole !== null) {
      return {
        rest: fields.filter((_, i) => i !== index),
        ...(whole.valid === null ? {} : { birthday: whole.valid }),
      };
    }
    const tokens = field.trim().split(/\s+/);
    if (tokens.length > 1) {
      const last = readDate(tokens[tokens.length - 1] ?? '');
      if (last !== null) {
        const rest = [...fields];
        rest[index] = tokens.slice(0, -1).join(' ');
        return { rest, ...(last.valid === null ? {} : { birthday: last.valid }) };
      }
    }
  }
  return { rest: fields };
}

/** 학생 이름으로 쓸 수 없는 길이. 붙여넣기 사고(문단 통째로)를 걸러낸다. */
const MAX_NAME_LENGTH = 30;

function looksLikeHeader(line: string): boolean {
  const lowered = line.toLowerCase();
  // 숫자로 시작하면 데이터다. '1,김민준'을 헤더로 오인하면 첫 학생이 사라진다.
  if (/^\s*\d/.test(line)) return false;
  return HEADER_HINTS.some((hint) => lowered.includes(hint));
}

function toInteger(value: string): number | null {
  if (!/^\d{1,4}$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

interface RawFields {
  fields: string[];
  /** 구분자가 명시적(쉼표·탭)이었는지. 공백 분리는 이름에 공백이 있을 수 있어 조심해야 한다. */
  explicit: boolean;
}

function splitFields(line: string): RawFields {
  if (line.includes(',')) {
    return { fields: line.split(',').map((f) => f.trim()), explicit: true };
  }
  if (line.includes('\t')) {
    return { fields: line.split('\t').map((f) => f.trim()), explicit: true };
  }

  /*
   * 공백 분리는 최대 2조각까지만 한다.
   * '김 하나'처럼 이름에 공백이 있으면 통째로 이름이어야 하고,
   * '1 김민준'처럼 앞이 숫자일 때만 번호로 떼어낸다.
   */
  const match = /^(\S+)\s+(.+)$/.exec(line);
  if (match && toInteger(match[1] ?? '') !== null) {
    return { fields: [match[1] ?? '', match[2] ?? ''], explicit: false };
  }
  return { fields: [line], explicit: false };
}

interface Pending {
  line: number;
  text: string;
  number: number | null;
  name: string;
  className?: string;
  birthday?: string;
}

function interpret(line: string, lineNo: number): Pending | RosterParseIssue {
  const { fields: rawFields, explicit } = splitFields(line);
  const { rest: fields, birthday } = pickBirthday(rawFields);
  const nonEmpty = fields.filter((f) => f !== '');

  if (nonEmpty.length === 0) {
    return { line: lineNo, text: line, reason: '내용이 없습니다.' };
  }

  const reject = (reason: string): RosterParseIssue => ({ line: lineNo, text: line, reason });

  const finish = (number: number | null, name: string, className?: string): Pending | RosterParseIssue => {
    if (name === '') return reject('이름이 비어 있습니다.');
    if (name.length > MAX_NAME_LENGTH) {
      return reject(`이름이 너무 깁니다(${name.length}자). 줄이 잘못 붙여넣어졌는지 확인해 주세요.`);
    }
    return {
      line: lineNo,
      text: line,
      number,
      name,
      ...(className === undefined || className === '' ? {} : { className }),
      ...(birthday === undefined ? {} : { birthday }),
    };
  };

  // 이름만
  if (nonEmpty.length === 1) {
    const only = nonEmpty[0] ?? '';
    // 숫자만 있는 줄은 이름이 빠진 것이다.
    if (toInteger(only) !== null) return reject('번호만 있고 이름이 없습니다.');
    return finish(null, only);
  }

  // 번호 + 이름
  if (nonEmpty.length === 2) {
    const first = nonEmpty[0] ?? '';
    const second = nonEmpty[1] ?? '';
    const number = toInteger(first);
    if (number !== null) return finish(number, second);

    // 쉼표·탭으로 나뉘었는데 앞이 번호가 아니면 '반,이름'으로 본다.
    if (explicit) {
      // '3학년 2반,1,' 처럼 이름 칸만 비면 남은 두 칸이 반·번호다.
      // 그대로 두면 '1'이라는 이름의 학생이 생긴다.
      if (toInteger(second) !== null) {
        return reject('이름이 비어 있습니다. "반,번호,이름" 순서인지 확인해 주세요.');
      }
      return finish(null, second, first);
    }
    return reject('번호를 읽을 수 없습니다. "1 김민준" 또는 "김민준" 형식으로 적어 주세요.');
  }

  // 반 + 번호 + 이름
  const className = nonEmpty[0] ?? '';
  const number = toInteger(nonEmpty[1] ?? '');
  if (number === null) {
    return reject('번호를 읽을 수 없습니다. "반,번호,이름" 순서인지 확인해 주세요.');
  }
  return finish(number, nonEmpty[2] ?? '', className);
}

function isIssue(value: Pending | RosterParseIssue): value is RosterParseIssue {
  return 'reason' in value;
}

export function parseRosterText(text: string): RosterParseResult {
  const lines = text.split(/\r?\n/);

  const pending: Pending[] = [];
  const issues: RosterParseIssue[] = [];
  let headerSkipped = false;
  let seenFirstContentLine = false;

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;

    if (!seenFirstContentLine) {
      seenFirstContentLine = true;
      if (looksLikeHeader(line)) {
        headerSkipped = true;
        return;
      }
    }

    const result = interpret(line, index + 1);
    if (isIssue(result)) issues.push(result);
    else pending.push(result);
  });

  /*
   * 번호 채우기.
   * 일부만 번호가 있으면 그 번호는 존중하고, 없는 학생에게 빈 번호를 채워 준다.
   * 아무도 번호가 없으면 붙여넣은 순서대로 1부터 매긴다.
   */
  const taken = new Set<number>();
  for (const row of pending) {
    if (row.number !== null) taken.add(row.number);
  }

  let autoNumberedCount = 0;
  let cursor = 1;
  const rows: ParsedRosterRow[] = pending.map((row) => {
    let number = row.number;
    if (number === null) {
      while (taken.has(cursor)) cursor += 1;
      number = cursor;
      taken.add(number);
      autoNumberedCount += 1;
    }
    return {
      line: row.line,
      number,
      name: row.name,
      ...(row.className === undefined ? {} : { className: row.className }),
      ...(row.birthday === undefined ? {} : { birthday: row.birthday }),
    };
  });

  // 중복은 버리지 않고 알린다. 판단은 교사가 한다.
  const numberCounts = new Map<number, number>();
  const nameCounts = new Map<string, number>();
  for (const row of rows) {
    numberCounts.set(row.number, (numberCounts.get(row.number) ?? 0) + 1);
    nameCounts.set(row.name, (nameCounts.get(row.name) ?? 0) + 1);
  }

  const duplicateNumbers = [...numberCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((a, b) => a - b);

  const duplicateNames = [...nameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'ko'));

  return { rows, issues, autoNumberedCount, duplicateNumbers, duplicateNames, headerSkipped };
}
