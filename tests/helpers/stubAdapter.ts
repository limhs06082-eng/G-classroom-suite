import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { StorageAdapter } from '../../src/shared/storage/StorageAdapter';

/**
 * 테스트용 StorageAdapter 스텁.
 *
 * 클래스 인스턴스를 `{...adapter}`로 펼치면 프로토타입 메서드가 복사되지 않아
 * 겉보기에만 어댑터인 객체가 만들어진다. 여기서 전체 구현을 갖춘 스텁을 만든다.
 */
export function stubAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    load: async () => ({ data: createEmptySuiteData(), repairs: [], isFirstRun: true }),
    save: async () => {},
    exportJson: async () => '{}',
    importJson: async () => ({ ok: true, repairs: [] }),
    reset: async () => createEmptySuiteData(),
    listBackups: async () => [],
    createBackup: async () => null,
    restoreBackup: async () => ({ ok: true, repairs: [] }),
    deleteBackup: async () => true,
    clearBackups: async () => {},
    getLastExportedAt: async () => null,
    ...overrides,
  };
}
