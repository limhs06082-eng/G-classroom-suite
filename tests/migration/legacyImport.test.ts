import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { validateAndRepair } from '../../src/shared/domain/invariants';
import type { SuiteData } from '../../src/shared/domain/types';
import { importLegacyRoster, LEGACY_KEYS, scanLegacy } from '../../src/shared/migration/legacyImport';

const NOW = '2026-03-02T09:00:00.000Z';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function storageWith(entries: Record<string, unknown>): MemoryStorage {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(entries)) {
    storage.setItem(key, JSON.stringify(value));
  }
  return storage;
}

function withClass(): SuiteData {
  return {
    ...createEmptySuiteData(),
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2027-02-28' },
        NOW,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, NOW)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

describe('scanLegacy', () => {
  it('원본 앱 자료가 없으면 빈 결과다', () => {
    expect(scanLegacy(new MemoryStorage())).toEqual({ sources: [], totalStudents: 0 });
  });

  it('원본 앱별로 학생 수를 센다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.seating]: { students: [{ number: 1, name: '김하나' }, { number: 2, name: '이두리' }] },
      [LEGACY_KEYS.duty]: { students: [{ order: 1, name: '김하나' }] },
    });

    const result = scanLegacy(storage);

    expect(result.totalStudents).toBe(3);
    expect(result.sources.map((s) => s.studentCount).sort()).toEqual([1, 2]);
  });

  it('훑기만 하고 원본을 건드리지 않는다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.seating]: { students: [{ number: 1, name: '김하나' }] },
    });

    scanLegacy(storage);

    expect(storage.getItem(LEGACY_KEYS.seating)).not.toBeNull();
  });

  it('깨진 JSON이 있어도 넘어간다', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEYS.seating, '{깨진 값');

    expect(() => scanLegacy(storage)).not.toThrow();
    expect(scanLegacy(storage).sources).toEqual([]);
  });
});

describe('importLegacyRoster', () => {
  it('학생이 가장 많은 원본을 기준으로 옮긴다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.duty]: { students: [{ order: 1, name: '김하나' }] },
      [LEGACY_KEYS.seating]: {
        students: [
          { number: 1, name: '김하나' },
          { number: 2, name: '이두리' },
          { number: 3, name: '박세찬' },
        ],
      },
    });

    const result = importLegacyRoster(withClass(), storage, {}, NOW);

    expect(result.importedStudents).toBe(3);
    expect(result.data.students.map((s) => s.name)).toEqual(['김하나', '이두리', '박세찬']);
  });

  it('학생마다 기능별 프로필을 함께 만든다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.seating]: { students: [{ number: 1, name: '김하나' }] },
    });

    const result = importLegacyRoster(withClass(), storage, {}, NOW);

    expect(result.data.seatingProfiles).toHaveLength(1);
    expect(result.data.dutyProfiles).toHaveLength(1);
    expect(result.data.rewardProfiles).toHaveLength(1);
  });

  it('학급이 없으면 만들어서 넣는다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.seating]: { students: [{ number: 1, name: '김하나' }] },
    });

    const result = importLegacyRoster(createEmptySuiteData(), storage, { className: '3학년 2반' }, NOW);

    expect(result.data.classRooms).toHaveLength(1);
    expect(result.data.classRooms[0]?.name).toBe('3학년 2반');
    expect(result.data.activeClassId).not.toBeNull();
  });

  it('이미 있는 학생은 다시 넣지 않는다', () => {
    const base = withClass();
    base.students = [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, NOW)];

    const storage = storageWith({
      [LEGACY_KEYS.seating]: {
        students: [
          { number: 1, name: '김하나' },
          { number: 2, name: '이두리' },
        ],
      },
    });

    const result = importLegacyRoster(base, storage, {}, NOW);

    expect(result.importedStudents).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.data.students).toHaveLength(2);
  });

  it('이름이 없는 항목은 건너뛰고 개수를 알린다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.seating]: { students: [{ number: 1, name: '김하나' }, { number: 2 }, { name: '   ' }] },
    });

    const result = importLegacyRoster(withClass(), storage, {}, NOW);

    expect(result.importedStudents).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it('번호가 겹치면 빈 번호로 밀어 넣는다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.seating]: {
        students: [
          { number: 1, name: '김하나' },
          { number: 1, name: '이두리' },
        ],
      },
    });

    const result = importLegacyRoster(withClass(), storage, {}, NOW);
    const numbers = result.data.students.map((s) => s.number);

    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('가져온 결과가 불변조건을 위반하지 않는다', () => {
    const storage = storageWith({
      [LEGACY_KEYS.seating]: {
        students: Array.from({ length: 25 }, (_, i) => ({ number: i + 1, name: `학생${i + 1}` })),
      },
    });

    const result = importLegacyRoster(withClass(), storage, {}, NOW);

    expect(validateAndRepair(result.data, NOW).repairs).toEqual([]);
  });

  it('원본 자료가 없으면 아무것도 바꾸지 않는다', () => {
    const base = withClass();
    const result = importLegacyRoster(base, new MemoryStorage(), {}, NOW);

    expect(result.importedStudents).toBe(0);
    expect(result.data).toBe(base);
  });

  it('원본 키를 지우지 않는다', () => {
    // 옮기기가 잘못돼도 되돌아갈 곳이 있어야 한다.
    const storage = storageWith({
      [LEGACY_KEYS.seating]: { students: [{ number: 1, name: '김하나' }] },
    });

    importLegacyRoster(withClass(), storage, {}, NOW);

    expect(storage.getItem(LEGACY_KEYS.seating)).not.toBeNull();
  });
});
