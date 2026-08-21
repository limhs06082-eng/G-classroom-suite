import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { LocalStorageAdapter } from '../../src/shared/storage/LocalStorageAdapter';
import { serializeSuiteData } from '../../src/shared/storage/schema';

/*
 * Firestore를 흉내 낸다.
 *
 * 실제 서버에 붙이면 테스트가 인터넷과 요금제에 매인다. 여기서 확인할 것은
 * 통신이 되는지가 아니라 '어느 쪽 자료를 택하는가'라는 판단이다. 특히
 * 첫 로그인 때 이 기기 자료를 올리는지 — 이걸 빠뜨리면 몇 달 쓰던 교사가
 * 로그인하자마자 빈 화면을 본다.
 */
const remote = {
  doc: null as { json?: string; updatedAt?: string } | null,
  writes: [] as { json?: string; updatedAt?: string }[],
  listener: null as ((snap: unknown) => void) | null,
};

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: () =>
    Promise.resolve({
      exists: () => remote.doc !== null,
      get: (field: string) => (remote.doc as Record<string, unknown> | null)?.[field],
    }),
  setDoc: (_ref: unknown, value: { json?: string; updatedAt?: string }) => {
    remote.doc = value;
    remote.writes.push(value);
    return Promise.resolve();
  },
  onSnapshot: (_ref: unknown, next: (snap: unknown) => void) => {
    remote.listener = next;
    return () => {
      remote.listener = null;
    };
  },
}));

const { FirestoreAdapter } = await import('../../src/shared/storage/FirestoreAdapter');

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

const T0 = '2026-03-02T09:00:00.000Z';

function sampleData(schoolName: string, studentName: string): SuiteData {
  return {
    ...createEmptySuiteData(),
    profile: { schoolName, teacherName: '임한솔', grade: '', classNo: '' },
    terms: [
      createTerm(
        {
          id: 'term-1',
          schoolYear: '2026',
          semester: '1학기',
          startDate: '2026-03-02',
          endDate: '2026-07-20',
        },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    students: [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: studentName }, T0)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

let storage: MemoryStorage;
let local: LocalStorageAdapter;
let adapter: InstanceType<typeof FirestoreAdapter>;
let warnings: string[];

beforeEach(() => {
  remote.doc = null;
  remote.writes = [];
  remote.listener = null;

  storage = new MemoryStorage();
  local = new LocalStorageAdapter(storage, () => T0);
  warnings = [];
  adapter = new FirestoreAdapter({} as never, 'uid-1', {
    local,
    onWarning: (message) => warnings.push(message),
    clock: () => T0,
  });
});

describe('FirestoreAdapter — 첫 로그인', () => {
  it('원격이 비어 있으면 이 기기 자료를 그대로 올린다', async () => {
    // 이 교사는 몇 달째 로그인 없이 써 왔다.
    await local.save(sampleData('한빛초등학교', '김하나'));

    const result = await adapter.load();

    expect(result.data.students[0]?.name).toBe('김하나');
    expect(remote.writes).toHaveLength(1);
    expect(JSON.parse(remote.writes[0]?.json ?? '{}').students[0].name).toBe('김하나');
  });

  it('원격에 자료가 있으면 그쪽을 쓰고 덮어쓰지 않는다', async () => {
    await local.save(sampleData('한빛초등학교', '이 기기'));
    remote.doc = { json: serializeSuiteData(sampleData('한빛초등학교', '원격 학생')) };

    const result = await adapter.load();

    expect(result.data.students[0]?.name).toBe('원격 학생');
    expect(remote.writes).toHaveLength(0);
  });

  it('원격 자료를 이 기기에도 적어 둔다', async () => {
    remote.doc = { json: serializeSuiteData(sampleData('한빛초등학교', '원격 학생')) };

    await adapter.load();

    const cached = await local.load();
    expect(cached.data.students[0]?.name).toBe('원격 학생');
  });

  it('둘 다 비어 있으면 첫 실행으로 알린다', async () => {
    const result = await adapter.load();

    expect(result.isFirstRun).toBe(true);
  });
});

describe('FirestoreAdapter — 저장', () => {
  it('원격 문서에는 객체가 아니라 글자를 넣는다', async () => {
    /*
     * SuiteData에는 officeCode처럼 값이 없을 수 있는 칸이 있다. 객체 그대로
     * 넣으면 Firestore가 undefined를 거부한다. 글자 하나로 담아야 한다.
     */
    await adapter.save(sampleData('한빛초등학교', '김하나'));

    expect(typeof remote.writes[0]?.json).toBe('string');
    expect(remote.writes[0]).not.toHaveProperty('students');
  });

  it('이 기기에도 함께 남긴다', async () => {
    await adapter.save(sampleData('한빛초등학교', '김하나'));

    const cached = await local.load();
    expect(cached.data.profile.schoolName).toBe('한빛초등학교');
  });

  it('자료가 900KB를 넘으면 알리지만 저장은 진행한다', async () => {
    const big = sampleData('한빛초등학교', '김하나');
    // 한 건이 208바이트다. 4,600건이면 939KB — 경고 문턱(900KB)을 넘는다.
    big.scoreEntries = Array.from({ length: 4600 }, (_, index) => ({
      id: `entry-${index}`,
      classId: 'class-1',
      occurredAt: T0,
      targetUnit: 'student' as const,
      targetId: 'stu-1',
      points: 1,
      reason: '수업 태도가 좋았습니다. 발표도 열심히 했습니다.',
    }));

    await adapter.save(big);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('한도의');
    // 알리고 끝내면 방금 준 점수가 사라진다. 저장은 반드시 된다.
    expect(remote.writes).toHaveLength(1);
  });
});

describe('FirestoreAdapter — 다른 기기의 변경', () => {
  it('원격이 바뀌면 알려 준다', () => {
    const seen: SuiteData[] = [];
    adapter.subscribe((data) => seen.push(data));

    remote.listener?.({
      exists: () => true,
      get: () => serializeSuiteData(sampleData('한빛초등학교', '다른 기기 학생')),
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.students[0]?.name).toBe('다른 기기 학생');
  });

  it('같은 내용이 또 오면 흘리지 않는다', () => {
    const seen: SuiteData[] = [];
    adapter.subscribe((data) => seen.push(data));

    const json = serializeSuiteData(sampleData('한빛초등학교', '김하나'));
    const snap = { exists: () => true, get: () => json };
    remote.listener?.(snap);
    remote.listener?.(snap);

    // 내가 쓴 것이 되돌아올 때마다 화면을 다시 그리면 저장할 때마다 덜컥거린다.
    expect(seen).toHaveLength(1);
  });

  it('해제하면 더 받지 않는다', () => {
    const stop = adapter.subscribe(() => {});
    stop();

    expect(remote.listener).toBeNull();
  });
});

describe('FirestoreAdapter — 백업은 이 기기에 둔다', () => {
  it('백업을 만들어도 원격 문서는 커지지 않는다', async () => {
    await adapter.save(sampleData('한빛초등학교', '김하나'));
    const writesAfterSave = remote.writes.length;

    await adapter.createBackup('학기 전환 직전', 'guard');

    expect(remote.writes).toHaveLength(writesAfterSave);
    expect(await adapter.listBackups()).toHaveLength(1);
  });

  it('백업으로 되돌리면 원격에도 반영한다', async () => {
    await adapter.save(sampleData('한빛초등학교', '되돌릴 학생'));
    const backup = await adapter.createBackup('되돌리기 시험', 'guard');
    await adapter.save(sampleData('한빛초등학교', '나중 학생'));

    const result = await adapter.restoreBackup(backup?.id ?? '');

    expect(result.ok).toBe(true);
    const lastWrite = remote.writes[remote.writes.length - 1];
    expect(JSON.parse(lastWrite?.json ?? '{}').students[0].name).toBe('되돌릴 학생');
  });
});
