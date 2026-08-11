import { beforeEach, describe, expect, it } from 'vitest';

import { createClassRoom, createEmptySuiteData, createStudent, createTerm } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { LocalStorageAdapter, STORAGE_KEYS } from '../../src/shared/storage/LocalStorageAdapter';
import { parseSuiteData } from '../../src/shared/storage/schema';

/** 용량 상한을 흉내 낼 수 있는 Storage 구현 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  maxBytes = Number.POSITIVE_INFINITY;

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
    const next = new Map(this.map);
    next.set(key, value);
    const total = [...next].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
    if (total > this.maxBytes) {
      const error = new Error('저장 공간 부족');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.map = next;
  }
}

/** 테스트에서 시각을 마음대로 옮기는 시계 */
class FakeClock {
  constructor(private current: string) {}
  now = (): string => this.current;
  set(iso: string): void {
    this.current = iso;
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(Date.parse(this.current) + minutes * 60_000).toISOString();
  }
}

const T0 = '2026-03-02T09:00:00.000Z';

function sampleData(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    T0,
  );
  const classRoom = createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0);

  return {
    ...createEmptySuiteData(),
    profile: { schoolName: '한빛초등학교', teacherName: '임한솔' },
    terms: [term],
    classRooms: [classRoom],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, T0),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, T0),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

let storage: MemoryStorage;
let clock: FakeClock;
let adapter: LocalStorageAdapter;

beforeEach(() => {
  storage = new MemoryStorage();
  clock = new FakeClock(T0);
  adapter = new LocalStorageAdapter(storage, clock.now);
});

describe('LocalStorageAdapter — 저장과 불러오기', () => {
  it('아무것도 없으면 첫 실행으로 알린다', async () => {
    const result = await adapter.load();

    expect(result.isFirstRun).toBe(true);
    expect(result.repairs).toEqual([]);
    expect(result.data.students).toEqual([]);
  });

  it('저장한 내용을 그대로 다시 읽는다', async () => {
    const data = sampleData();
    await adapter.save(data);

    const result = await adapter.load();

    expect(result.isFirstRun).toBe(false);
    expect(result.repairs).toEqual([]);
    expect(result.data.profile.schoolName).toBe('한빛초등학교');
    expect(result.data.students.map((s) => s.name)).toEqual(['김하나', '이두리']);
  });

  it('접두사가 붙은 키에만 쓴다', async () => {
    await adapter.save(sampleData());

    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) {
      expect(key).toMatch(/^classroom-suite:v1:/);
    }
  });
});

describe('LocalStorageAdapter — 손상 복구', () => {
  it('본 데이터가 깨지면 가장 최근 백업으로 되돌린다', async () => {
    await adapter.save(sampleData());

    // 백업이 생기도록 시간을 넘긴 뒤 한 번 더 저장
    clock.advanceMinutes(30);
    await adapter.save({ ...sampleData(), profile: { schoolName: '두번째', teacherName: '임한솔' } });
    expect((await adapter.listBackups()).length).toBeGreaterThan(0);

    // 본 데이터만 깨뜨린다
    storage.setItem(STORAGE_KEYS.data, '{이건 JSON이 아님');

    const result = await adapter.load();

    expect(result.repairs.some((r) => r.message.includes('백업으로 되돌렸습니다'))).toBe(true);
    expect(result.data.students).toHaveLength(2);
  });

  it('백업도 없이 깨지면 빈 상태로 열되 반드시 알린다', async () => {
    storage.setItem(STORAGE_KEYS.data, 'not json at all');

    const result = await adapter.load();

    expect(result.data.students).toEqual([]);
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0]?.severity).toBe('warning');
  });

  it('백업 목록이 깨져도 본 데이터는 정상적으로 연다', async () => {
    await adapter.save(sampleData());
    storage.setItem(STORAGE_KEYS.backups, '깨진 백업 목록');

    const result = await adapter.load();

    expect(result.data.students).toHaveLength(2);
  });
});

describe('parseSuiteData — 형태가 어긋난 입력', () => {
  it('객체가 아니면 빈 데이터로 시작하고 알린다', () => {
    const { data, repairs } = parseSuiteData('학생 명단', T0);

    expect(data.students).toEqual([]);
    expect(repairs[0]?.code).toBe('MISSING_SECTION');
  });

  it('손상된 레코드만 버리고 나머지는 살린다', () => {
    const { data, repairs } = parseSuiteData(
      {
        schemaVersion: 1,
        terms: [{ id: 'term-1', schoolYear: '2026', semester: '1학기' }],
        classRooms: [{ id: 'class-1', termId: 'term-1', name: '3학년 2반' }],
        students: [
          { id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' },
          { classId: 'class-1', number: 2, name: 'id가 없어서 버려짐' },
          null,
          '문자열',
        ],
      },
      T0,
    );

    expect(data.students).toHaveLength(1);
    expect(data.students[0]?.name).toBe('김하나');
    expect(repairs.some((r) => r.code === 'MALFORMED_RECORD')).toBe(true);
  });

  it('배열이어야 할 곳에 다른 값이 와도 견딘다', () => {
    const { data } = parseSuiteData({ schemaVersion: 1, students: '학생들', terms: 42 }, T0);

    expect(data.students).toEqual([]);
    expect(data.terms).toEqual([]);
  });

  it('더 새로운 스키마 버전이면 경고한다', () => {
    const { repairs } = parseSuiteData({ schemaVersion: 99 }, T0);

    expect(repairs.some((r) => r.code === 'SCHEMA_VERSION_AHEAD')).toBe(true);
  });

  it('빠진 필드는 기본값으로 채운다', () => {
    const { data } = parseSuiteData({ schemaVersion: 1 }, T0);

    expect(data.profile.schoolName).toBe('');
    expect(data.scoreCycle.weeklyStartDay).toBe(1);
    expect(data.activeClassId).toBeNull();
  });
});

describe('LocalStorageAdapter — 내보내기와 가져오기', () => {
  it('내보낸 JSON에 NEIS 키가 들어가지 않는다', async () => {
    storage.setItem(STORAGE_KEYS.neisKey, 'SECRET-NEIS-KEY');
    await adapter.save(sampleData());

    const json = await adapter.exportJson();

    expect(json).not.toContain('SECRET-NEIS-KEY');
    expect(json).toContain('한빛초등학교');
  });

  it('내보내기 시각을 기록한다', async () => {
    await adapter.save(sampleData());
    expect(await adapter.getLastExportedAt()).toBeNull();

    await adapter.exportJson();

    expect(await adapter.getLastExportedAt()).toBe(T0);
  });

  it('잘못된 JSON은 거부하고 기존 데이터를 건드리지 않는다', async () => {
    await adapter.save(sampleData());

    const result = await adapter.importJson('{이건 JSON이 아님');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('형식');
    expect((await adapter.load()).data.students).toHaveLength(2);
  });

  it('가져오기 직전 상태를 되돌릴 수 있게 남긴다', async () => {
    await adapter.save(sampleData());
    clock.advanceMinutes(30);

    const incoming = { ...createEmptySuiteData(), profile: { schoolName: '새 학교', teacherName: '새 교사' } };
    const result = await adapter.importJson(JSON.stringify(incoming));

    expect(result.ok).toBe(true);
    expect((await adapter.load()).data.profile.schoolName).toBe('새 학교');

    const guard = (await adapter.listBackups()).find((b) => b.reason === '가져오기 직전');
    expect(guard).toBeDefined();
    expect(guard?.kind).toBe('guard');
  });
});

describe('LocalStorageAdapter — 백업과 복원', () => {
  it('자동 백업은 간격 안에서 중복 생성하지 않는다', async () => {
    await adapter.save(sampleData()); // 이전 데이터가 없으므로 백업 없음
    expect(await adapter.listBackups()).toHaveLength(0);

    clock.advanceMinutes(1);
    await adapter.save(sampleData()); // 첫 백업
    expect(await adapter.listBackups()).toHaveLength(1);

    clock.advanceMinutes(2);
    await adapter.save(sampleData()); // 간격 안 — 늘지 않아야 한다
    expect(await adapter.listBackups()).toHaveLength(1);

    clock.advanceMinutes(30);
    await adapter.save(sampleData()); // 간격 지남
    expect(await adapter.listBackups()).toHaveLength(2);
  });

  it('복원하면 그 시점 데이터로 돌아가고 복원 직전 상태도 남는다', async () => {
    await adapter.save(sampleData());
    clock.advanceMinutes(30);

    const changed: SuiteData = { ...sampleData(), students: [] };
    await adapter.save(changed);
    expect((await adapter.load()).data.students).toHaveLength(0);

    const backup = (await adapter.listBackups()).find((b) => b.kind === 'auto');
    expect(backup).toBeDefined();

    clock.advanceMinutes(30);
    const restored = await adapter.restoreBackup(backup!.id);

    expect(restored.ok).toBe(true);
    expect((await adapter.load()).data.students).toHaveLength(2);
    expect((await adapter.listBackups()).some((b) => b.reason === '백업 복원 직전')).toBe(true);
  });

  it('없는 백업을 복원하면 실패를 알린다', async () => {
    const result = await adapter.restoreBackup('없는-id');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('찾을 수 없습니다');
  });

  it('초기화 직전 상태를 남긴다', async () => {
    await adapter.save(sampleData());
    clock.advanceMinutes(30);

    const empty = await adapter.reset();

    expect(empty.students).toEqual([]);
    expect((await adapter.load()).data.students).toEqual([]);
    expect((await adapter.listBackups()).some((b) => b.reason === '전체 초기화 직전')).toBe(true);
  });

  it('백업을 개별 삭제하고 전체 비울 수 있다', async () => {
    await adapter.save(sampleData());
    clock.advanceMinutes(30);
    await adapter.save(sampleData());

    const [first] = await adapter.listBackups();
    expect(await adapter.deleteBackup(first!.id)).toBe(true);
    expect(await adapter.deleteBackup(first!.id)).toBe(false);

    clock.advanceMinutes(30);
    await adapter.save(sampleData());
    expect((await adapter.listBackups()).length).toBeGreaterThan(0);

    await adapter.clearBackups();
    expect(await adapter.listBackups()).toEqual([]);
  });

  it('목록에는 payload를 실어 보내지 않는다', async () => {
    await adapter.save(sampleData());
    clock.advanceMinutes(30);
    await adapter.save(sampleData());

    const [summary] = await adapter.listBackups();

    expect(summary).toBeDefined();
    expect('payload' in summary!).toBe(false);
    expect(summary!.sizeBytes).toBeGreaterThan(0);
  });
});

describe('LocalStorageAdapter — 저장 공간 부족', () => {
  it('공간이 모자라면 오래된 백업을 버리고 저장을 성사시킨다', async () => {
    await adapter.save(sampleData());
    for (let i = 0; i < 4; i += 1) {
      clock.advanceMinutes(30);
      await adapter.save(sampleData());
    }
    expect((await adapter.listBackups()).length).toBeGreaterThan(1);

    // 지금 쓰인 양보다 약간만 여유를 준다
    const used = Array.from({ length: storage.length }, (_, i) => storage.key(i))
      .map((k) => (k === null ? 0 : k.length + (storage.getItem(k)?.length ?? 0)))
      .reduce((a, b) => a + b, 0);
    storage.maxBytes = Math.floor(used * 0.55);

    clock.advanceMinutes(30);
    await expect(adapter.save(sampleData())).resolves.toBeUndefined();

    expect((await adapter.load()).data.students).toHaveLength(2);
  });

  it('백업을 다 버려도 안 되면 사람이 읽을 오류를 던진다', async () => {
    storage.maxBytes = 50;

    await expect(adapter.save(sampleData())).rejects.toThrow(/저장 공간이 부족/);
  });
});
