import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createClassRoom, createEmptySuiteData, createTerm } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { FileBackedStorage } from '../../src/shared/storage/FileBackedStorage';
import { LocalStorageAdapter } from '../../src/shared/storage/LocalStorageAdapter';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

const T0 = '2026-03-02T09:00:00.000Z';

function sample(name: string): SuiteData {
  return {
    ...createEmptySuiteData(),
    profile: { schoolName: name, teacherName: '임한솔', grade: '', classNo: '' },
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

let files: MemoryFileStore;
let storage: FileBackedStorage;
let adapter: LocalStorageAdapter;

beforeEach(async () => {
  vi.useFakeTimers();
  files = new MemoryFileStore();
  storage = await FileBackedStorage.open(files);
  adapter = new LocalStorageAdapter(storage, () => T0);
});

describe('파일 저장소를 끼운 LocalStorageAdapter', () => {
  it('아무것도 없으면 첫 실행으로 알린다', async () => {
    const result = await adapter.load();

    expect(result.isFirstRun).toBe(true);
  });

  it('저장한 것을 다시 불러온다', async () => {
    await adapter.save(sample('한빛초등학교'));

    const result = await adapter.load();
    expect(result.data.profile.schoolName).toBe('한빛초등학교');
  });

  it('앱을 다시 켜도 자료가 남아 있다', async () => {
    await adapter.save(sample('한빛초등학교'));
    await storage.flush();

    // 같은 파일 위에서 새로 연다. 앱을 껐다 켠 것과 같다.
    const reopened = await FileBackedStorage.open(files);
    const next = new LocalStorageAdapter(reopened, () => T0);

    const result = await next.load();
    expect(result.data.profile.schoolName).toBe('한빛초등학교');
    expect(result.isFirstRun).toBe(false);
  });

  it('data.json이 깨져 있으면 백업으로 되돌린다', async () => {
    await adapter.save(sample('한빛초등학교'));
    await adapter.createBackup('시험용', 'guard');
    await storage.flush();

    await files.writeAtomic('data.json', '{ 이건 JSON이 아니다');
    const reopened = await FileBackedStorage.open(files);
    const next = new LocalStorageAdapter(reopened, () => T0);

    const result = await next.load();
    // 물려받은 복구 논리가 파일 위에서도 그대로 돈다.
    expect(result.data.profile.schoolName).toBe('한빛초등학교');
    expect(result.repairs.length).toBeGreaterThan(0);
  });

  it('백업은 data.json이 아니라 backups.json으로 간다', async () => {
    await adapter.save(sample('한빛초등학교'));
    await adapter.createBackup('학기 전환 직전', 'guard');
    await storage.flush();

    expect(await files.read('backups.json')).not.toBeNull();
    // 선생님이 data.json만 복사해 가도 자료가 온전해야 한다.
    expect((await files.read('data.json')) ?? '').not.toContain('학기 전환 직전');
  });
});
