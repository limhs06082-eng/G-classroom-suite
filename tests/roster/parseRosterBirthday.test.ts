import { describe, expect, it } from 'vitest';

import { parseRosterText } from '../../src/shared/roster/parseRosterText';

/*
 * NEIS 명단에는 생년월일 열이 흔하다. 그 열이 있어도 번호·이름을 전과 같이
 * 읽고, 생일은 따로 챙긴다. 없으면 없는 대로 — 옛 붙여넣기는 그대로 된다.
 */
describe('parseRosterText — 생년월일 열', () => {
  it('번호,이름,생년월일 (NEIS 엑셀 복사)', () => {
    const result = parseRosterText('번호\t이름\t생년월일\n1\t김하나\t2015-09-07\n2\t이두리\t2015.12.25\n3\t박세리\t20160229');

    expect(result.headerSkipped).toBe(true);
    expect(result.rows.map((row) => [row.number, row.name, row.birthday])).toEqual([
      [1, '김하나', '2015-09-07'],
      [2, '이두리', '2015-12-25'],
      [3, '박세리', '2016-02-29'],
    ]);
  });

  it('반,번호,이름,생년월일 네 열도 읽는다', () => {
    const row = parseRosterText('3학년 2반,7,최네오,2015년 3월 1일').rows[0];
    expect(row).toEqual({ line: 1, number: 7, name: '최네오', className: '3학년 2반', birthday: '2015-03-01' });
  });

  it('공백으로 나눈 줄 끝의 날짜도 뗀다', () => {
    const row = parseRosterText('1 김하나 2015-09-07').rows[0];
    expect(row?.name).toBe('김하나');
    expect(row?.birthday).toBe('2015-09-07');
  });

  it('날짜가 없으면 생일 칸 자체가 없고, 엉뚱한 날짜는 무시한다', () => {
    expect(parseRosterText('1,김하나').rows[0]).not.toHaveProperty('birthday');
    expect(parseRosterText('1,김하나,2015-13-40').rows[0]).not.toHaveProperty('birthday');
  });
});
