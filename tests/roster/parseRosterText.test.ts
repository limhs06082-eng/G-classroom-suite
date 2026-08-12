import { describe, expect, it } from 'vitest';

import { parseRosterText } from '../../src/shared/roster/parseRosterText';

/** 자주 쓰는 축약: 이름 목록만 뽑는다 */
const names = (text: string): string[] => parseRosterText(text).rows.map((r) => r.name);
const numbers = (text: string): number[] => parseRosterText(text).rows.map((r) => r.number);

describe('parseRosterText — 원본 3개 앱의 입력 형식을 모두 받는다', () => {
  it('이름만 있는 목록 (duty 형식)', () => {
    const result = parseRosterText('김가람\n이나래\n박다온');

    expect(result.rows).toEqual([
      { line: 1, number: 1, name: '김가람' },
      { line: 2, number: 2, name: '이나래' },
      { line: 3, number: 3, name: '박다온' },
    ]);
    expect(result.autoNumberedCount).toBe(3);
    expect(result.issues).toEqual([]);
  });

  it('번호와 이름을 공백으로 나눈 형식 (seating)', () => {
    const result = parseRosterText('1 김민준\n2 이서연\n3 박지호');

    expect(numbers('1 김민준\n2 이서연\n3 박지호')).toEqual([1, 2, 3]);
    expect(result.rows.map((r) => r.name)).toEqual(['김민준', '이서연', '박지호']);
    expect(result.autoNumberedCount).toBe(0);
  });

  it('쉼표 CSV (assignment)', () => {
    expect(names('1,김민준\n2,이서연')).toEqual(['김민준', '이서연']);
  });

  it('엑셀에서 복사한 탭 구분', () => {
    expect(names('1\t김민준\n2\t이서연')).toEqual(['김민준', '이서연']);
  });

  it('반·번호·이름 3열이면 학급을 함께 읽는다', () => {
    const result = parseRosterText('3학년 2반,1,김민준\n3학년 3반,1,이서연');

    expect(result.rows[0]).toEqual({ line: 1, number: 1, name: '김민준', className: '3학년 2반' });
    expect(result.rows[1]?.className).toBe('3학년 3반');
  });
});

describe('parseRosterText — 헤더', () => {
  it('헤더 줄을 건너뛴다', () => {
    const result = parseRosterText('번호,이름\n1,김민준\n2,이서연');

    expect(result.headerSkipped).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it('영문 헤더도 인식한다', () => {
    expect(parseRosterText('number,name\n1,Kim').headerSkipped).toBe(true);
  });

  it('숫자로 시작하면 헤더가 아니다', () => {
    // '1,이름없음' 같은 데이터를 헤더로 오인하면 첫 학생이 사라진다.
    const result = parseRosterText('1,이름순이\n2,김민준');

    expect(result.headerSkipped).toBe(false);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.name).toBe('이름순이');
  });

  it('헤더처럼 보이는 이름이 둘째 줄부터면 건너뛰지 않는다', () => {
    const result = parseRosterText('김민준\n이름다운');

    expect(result.headerSkipped).toBe(false);
    expect(result.rows).toHaveLength(2);
  });
});

describe('parseRosterText — 이름에 공백이 있는 경우', () => {
  it('앞이 숫자가 아니면 줄 전체가 이름이다', () => {
    // 원본 파서는 공백으로 무조건 쪼개서 '김 하나'를 망가뜨렸다.
    const result = parseRosterText('김 하나\n이 두리');

    expect(result.rows.map((r) => r.name)).toEqual(['김 하나', '이 두리']);
    expect(result.issues).toEqual([]);
  });

  it('번호가 앞에 있으면 나머지 전체가 이름이다', () => {
    expect(names('1 김 하나')).toEqual(['김 하나']);
  });

  it('쉼표 형식에서도 이름의 공백을 지킨다', () => {
    expect(names('1,김 하나')).toEqual(['김 하나']);
  });
});

describe('parseRosterText — 읽지 못한 줄을 반드시 알린다', () => {
  it('번호만 있고 이름이 없으면 문제로 보고한다', () => {
    const result = parseRosterText('1,김민준\n2\n3,박지호');

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.line).toBe(2);
    expect(result.issues[0]?.reason).toContain('이름이 없습니다');
  });

  it('번호 뒤에 이름 칸만 비어도 알린다', () => {
    const result = parseRosterText('1,김민준\n2,\n3,박지호');

    expect(result.rows).toHaveLength(2);
    expect(result.issues[0]?.reason).toContain('이름이 없습니다');
  });

  it('반·번호는 있는데 이름 칸이 비면 이름 없는 학생을 만들지 않는다', () => {
    // 그대로 두면 '1'이라는 이름의 학생이 생긴다.
    const result = parseRosterText('3학년 2반,1,김민준\n3학년 2반,2,');

    expect(result.rows).toHaveLength(1);
    expect(result.rows.map((r) => r.name)).toEqual(['김민준']);
    expect(result.issues[0]?.reason).toContain('이름이 비어');
  });

  it('문단을 통째로 붙여넣으면 걸러내고 알린다', () => {
    const long = '가'.repeat(80);
    const result = parseRosterText(`1,김민준\n${long}`);

    expect(result.rows).toHaveLength(1);
    expect(result.issues[0]?.reason).toContain('너무 깁니다');
  });

  it('문제 줄에는 원본 텍스트와 줄 번호가 함께 담긴다', () => {
    const result = parseRosterText('김민준\n\n\n2');

    expect(result.issues[0]).toMatchObject({ line: 4, text: '2' });
  });

  it('빈 줄은 문제로 세지 않는다', () => {
    const result = parseRosterText('김민준\n\n\n이서연\n   \n');

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toEqual([]);
  });
});

describe('parseRosterText — 번호 채우기', () => {
  it('아무도 번호가 없으면 순서대로 1부터 매긴다', () => {
    expect(numbers('가\n나\n다')).toEqual([1, 2, 3]);
  });

  it('일부만 번호가 있으면 그 번호를 존중하고 빈 번호를 채운다', () => {
    const result = parseRosterText('5,김민준\n이서연\n3,박지호\n최유진');

    expect(result.rows.map((r) => [r.name, r.number])).toEqual([
      ['김민준', 5],
      ['이서연', 1],
      ['박지호', 3],
      ['최유진', 2],
    ]);
    expect(result.autoNumberedCount).toBe(2);
  });

  it('자동으로 매긴 번호는 기존 번호와 겹치지 않는다', () => {
    const result = parseRosterText('1,가\n2,나\n다\n라');

    expect(result.duplicateNumbers).toEqual([]);
    expect(new Set(result.rows.map((r) => r.number)).size).toBe(4);
  });
});

describe('parseRosterText — 중복은 버리지 않고 알린다', () => {
  it('번호가 겹치면 그대로 두고 목록으로 보고한다', () => {
    const result = parseRosterText('1,김민준\n1,이서연\n2,박지호');

    expect(result.rows).toHaveLength(3);
    expect(result.duplicateNumbers).toEqual([1]);
  });

  it('같은 이름은 동명이인일 수 있으므로 확인 대상으로만 알린다', () => {
    const result = parseRosterText('1,김민준\n2,김민준');

    expect(result.rows).toHaveLength(2);
    expect(result.duplicateNames).toEqual(['김민준']);
    expect(result.issues).toEqual([]);
  });
});

describe('parseRosterText — 가장자리', () => {
  it('빈 문자열은 빈 결과다', () => {
    const result = parseRosterText('');

    expect(result.rows).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('공백뿐인 입력도 빈 결과다', () => {
    expect(parseRosterText('   \n\t\n  ').rows).toEqual([]);
  });

  it('헤더만 있으면 학생이 없다', () => {
    const result = parseRosterText('번호,이름');

    expect(result.headerSkipped).toBe(true);
    expect(result.rows).toEqual([]);
  });

  it('윈도우 줄바꿈(CRLF)을 처리한다', () => {
    expect(names('1,김민준\r\n2,이서연')).toEqual(['김민준', '이서연']);
  });

  it('각 줄 앞뒤 공백을 정리한다', () => {
    expect(names('  1 , 김민준  \n  2 , 이서연 ')).toEqual(['김민준', '이서연']);
  });
});
