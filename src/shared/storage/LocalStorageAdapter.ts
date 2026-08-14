import { createEmptySuiteData, createId } from '../domain/factories';
import type { RepairLog } from '../domain/invariants';
import type { SuiteData } from '../domain/types';
import { applyRetention, byteLength } from './backup';
import { parseSuiteData, serializeSuiteData } from './schema';
import type {
  BackupItem,
  BackupKind,
  BackupSummary,
  ImportResult,
  LoadResult,
  RestoreResult,
  StorageAdapter,
} from './StorageAdapter';

/**
 * localStorage 기반 저장소.
 *
 * 원본 앱들은 키 규칙이 제각각이었고 특히 formative-quiz는 'settings' 같은
 * 접두사 없는 키를 썼다. 통합본은 접두사를 강제해 다른 앱·확장과 충돌하지 않게 한다.
 */

export const STORAGE_KEYS = {
  data: 'classroom-suite:v1:data',
  backups: 'classroom-suite:v1:backups',
  meta: 'classroom-suite:v1:meta',
  /** NEIS API 키. 내보내기에 절대 포함하지 않는다. */
  neisKey: 'classroom-suite:v1:neis-key',
} as const;

/**
 * 자동 백업 최소 간격.
 *
 * 보상 점수 입력은 수업 중 분당 수 회 일어난다. 저장할 때마다 스냅샷을 뜨면
 * localStorage가 금방 찬다. 간격을 두되, 하루가 바뀌면 즉시 한 번 남긴다.
 */
const AUTO_BACKUP_INTERVAL_MS = 10 * 60 * 1000;

interface StoredMeta {
  lastSavedAt?: string;
  lastExportedAt?: string;
  lastAutoBackupAt?: string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly storage: Storage;
  private readonly clock: () => string;

  constructor(storage?: Storage, clock?: () => string) {
    this.storage = storage ?? window.localStorage;
    this.clock = clock ?? (() => new Date().toISOString());
  }

  // ── 원시 접근 ───────────────────────────────────────────────

  private read(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      // 사파리 프라이빗 모드 등에서 접근 자체가 던질 수 있다.
      return null;
    }
  }

  private write(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  private readMeta(): StoredMeta {
    const raw = this.read(STORAGE_KEYS.meta);
    if (raw === null) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as StoredMeta) : {};
    } catch {
      return {};
    }
  }

  /**
   * 메타데이터는 부가 정보다. 여기서 실패해도 본 작업을 막아서는 안 된다.
   * (저장 공간이 빠듯할 때 메타 기록이 먼저 터져 저장 자체가 죽는 버그가 있었다.)
   */
  private writeMeta(patch: StoredMeta): void {
    try {
      this.write(STORAGE_KEYS.meta, JSON.stringify({ ...this.readMeta(), ...patch }));
    } catch {
      // 무시한다
    }
  }

  private readBackups(): BackupItem[] {
    const raw = this.read(STORAGE_KEYS.backups);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is BackupItem => {
        if (typeof item !== 'object' || item === null) return false;
        const candidate = item as Partial<BackupItem>;
        return typeof candidate.id === 'string' && typeof candidate.payload === 'string';
      });
    } catch {
      // 백업 목록이 깨졌다고 본 데이터까지 못 열면 안 된다.
      return [];
    }
  }

  private writeBackups(items: readonly BackupItem[]): void {
    this.write(STORAGE_KEYS.backups, JSON.stringify(items));
  }

  private toSummary(item: BackupItem): BackupSummary {
    const { payload: _payload, ...summary } = item;
    return summary;
  }

  // ── 불러오기 / 저장 ─────────────────────────────────────────

  async load(): Promise<LoadResult> {
    const raw = this.read(STORAGE_KEYS.data);

    if (raw === null) {
      return { data: createEmptySuiteData(), repairs: [], isFirstRun: true };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      // 본 데이터가 깨졌다. 가장 최근 백업으로 자동 제안한다.
      const fallback = this.readBackups().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

      if (fallback) {
        const recovered = this.tryParsePayload(fallback.payload);
        if (recovered) {
          return {
            data: recovered.data,
            isFirstRun: false,
            repairs: [
              {
                code: 'MISSING_SECTION',
                severity: 'warning',
                entityIds: [],
                message: `저장된 데이터가 손상되어 ${fallback.createdAt.slice(0, 16).replace('T', ' ')}에 만든 백업으로 되돌렸습니다. 최근 변경 내용이 빠졌을 수 있으니 확인해 주세요.`,
              },
              ...recovered.repairs,
            ],
          };
        }
      }

      return {
        data: createEmptySuiteData(),
        isFirstRun: false,
        repairs: [
          {
            code: 'MISSING_SECTION',
            severity: 'warning',
            entityIds: [],
            message:
              '저장된 데이터가 손상되었고 사용할 수 있는 백업도 없어 빈 상태로 시작합니다. 내보내 둔 JSON 파일이 있다면 설정에서 가져오기로 복원할 수 있습니다.',
          },
        ],
      };
    }

    const { data, repairs } = parseSuiteData(parsedJson, this.clock());
    return { data, repairs, isFirstRun: false };
  }

  private tryParsePayload(payload: string): { data: SuiteData; repairs: RepairLog[] } | null {
    try {
      return parseSuiteData(JSON.parse(payload), this.clock());
    } catch {
      return null;
    }
  }

  async save(data: SuiteData): Promise<void> {
    const now = this.clock();

    // 순서가 중요하다. 교사의 데이터를 저장하는 것이 본 작업이고,
    // 백업은 부가 작업이다. 백업을 먼저 하면 그 쓰기가 공간을 잡아먹어
    // 정작 본 저장이 실패할 수 있다. 반드시 본 저장을 먼저 성사시킨다.
    const previous = this.read(STORAGE_KEYS.data);

    this.writeWithQuotaRecovery(STORAGE_KEYS.data, serializeSuiteData(data));
    this.writeMeta({ lastSavedAt: now });

    if (previous !== null) {
      this.maybeAutoBackup(previous, now);
    }
  }

  /**
   * 저장 공간이 부족하면 오래된 백업부터 버리고 다시 시도한다.
   * 백업을 다 버려도 안 되면 그때는 사용자에게 알린다.
   */
  private writeWithQuotaRecovery(key: string, value: string): void {
    try {
      this.write(key, value);
      return;
    } catch (error) {
      // 오래된 백업부터 버리며 재시도한다.
      // 주의: 줄어든 목록을 쓰는 것조차 공간 부족으로 실패할 수 있다.
      // 그 경우엔 백업 키를 통째로 비워서라도 본 데이터를 살린다.
      const oldestFirst = [...this.readBackups()].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );

      for (let dropCount = 1; dropCount <= oldestFirst.length; dropCount += 1) {
        try {
          this.writeBackups(oldestFirst.slice(dropCount));
        } catch {
          this.dropAllBackups();
        }

        try {
          this.write(key, value);
          return;
        } catch {
          // 더 줄여 본다
        }
      }

      // 마지막 수단: 백업을 전부 버린다.
      this.dropAllBackups();
      try {
        this.write(key, value);
        return;
      } catch {
        // 백업을 다 비워도 안 되면 사용자가 직접 정리해야 한다.
      }

      throw new Error(
        '브라우저 저장 공간이 부족해 저장하지 못했습니다. 설정에서 데이터를 내보내 백업한 뒤, 사용하지 않는 학기를 정리해 주세요.',
        { cause: error },
      );
    }
  }

  private dropAllBackups(): void {
    try {
      this.storage.removeItem(STORAGE_KEYS.backups);
    } catch {
      // 지우는 것조차 막혀 있으면 더 할 수 있는 게 없다
    }
  }

  /**
   * 직전 상태를 자동 스냅샷으로 남긴다.
   *
   * 보상 점수 입력은 수업 중 분당 수 회 일어나므로 매번 뜨지 않고 간격을 둔다.
   * 실패해도 조용히 넘어간다 — 백업 때문에 저장이 죽으면 본말전도다.
   */
  private maybeAutoBackup(previous: string, now: string): void {
    const { lastAutoBackupAt } = this.readMeta();
    if (lastAutoBackupAt !== undefined) {
      const elapsed = Date.parse(now) - Date.parse(lastAutoBackupAt);
      const sameDay = lastAutoBackupAt.slice(0, 10) === now.slice(0, 10);
      if (Number.isFinite(elapsed) && elapsed < AUTO_BACKUP_INTERVAL_MS && sameDay) return;
    }

    this.pushBackup(previous, '자동 저장', 'auto', now);
    this.writeMeta({ lastAutoBackupAt: now });
  }

  private pushBackup(payload: string, reason: string, kind: BackupKind, now: string): BackupItem {
    const item: BackupItem = {
      id: createId(),
      createdAt: now,
      kind,
      reason,
      sizeBytes: byteLength(payload),
      payload,
    };

    const { kept } = applyRetention([item, ...this.readBackups()]);
    try {
      this.writeBackups(kept);
    } catch {
      // 백업 저장 실패가 본 작업을 막아서는 안 된다. 조용히 넘어간다.
    }
    return item;
  }

  // ── 내보내기 / 가져오기 / 초기화 ────────────────────────────

  async exportJson(): Promise<string> {
    const { data } = await this.load();
    this.writeMeta({ lastExportedAt: this.clock() });
    return serializeSuiteData(data);
  }

  async importJson(json: string): Promise<ImportResult> {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return {
        ok: false,
        repairs: [],
        message: '파일 형식이 올바르지 않습니다. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.',
      };
    }

    const { data, repairs } = parseSuiteData(raw, this.clock());

    // 가져오기는 되돌릴 수 없는 작업이다. 직전 상태를 반드시 남긴다.
    const previous = this.read(STORAGE_KEYS.data);
    if (previous !== null) {
      this.pushBackup(previous, '가져오기 직전', 'guard', this.clock());
    }

    this.writeWithQuotaRecovery(STORAGE_KEYS.data, serializeSuiteData(data));
    this.writeMeta({ lastSavedAt: this.clock() });

    return { ok: true, data, repairs };
  }

  async reset(): Promise<SuiteData> {
    const previous = this.read(STORAGE_KEYS.data);
    if (previous !== null) {
      this.pushBackup(previous, '전체 초기화 직전', 'guard', this.clock());
    }

    const empty = createEmptySuiteData();
    this.writeWithQuotaRecovery(STORAGE_KEYS.data, serializeSuiteData(empty));
    this.writeMeta({ lastSavedAt: this.clock() });
    return empty;
  }

  // ── 백업 ───────────────────────────────────────────────────

  async listBackups(): Promise<BackupSummary[]> {
    return this.readBackups()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => this.toSummary(item));
  }

  async createBackup(
    reason: string,
    kind: BackupKind,
    data?: SuiteData,
  ): Promise<BackupSummary | null> {
    const payload = data ? serializeSuiteData(data) : this.read(STORAGE_KEYS.data);
    if (payload === null) return null;

    const item = this.pushBackup(payload, reason, kind, this.clock());
    return this.toSummary(item);
  }

  async restoreBackup(id: string): Promise<RestoreResult> {
    const target = this.readBackups().find((item) => item.id === id);
    if (!target) {
      return { ok: false, repairs: [], message: '해당 백업을 찾을 수 없습니다.' };
    }

    const parsed = this.tryParsePayload(target.payload);
    if (!parsed) {
      return { ok: false, repairs: [], message: '백업 내용이 손상되어 복원할 수 없습니다.' };
    }

    // 복원 자체도 되돌릴 수 있어야 한다.
    const previous = this.read(STORAGE_KEYS.data);
    if (previous !== null) {
      this.pushBackup(previous, '백업 복원 직전', 'guard', this.clock());
    }

    this.writeWithQuotaRecovery(STORAGE_KEYS.data, serializeSuiteData(parsed.data));
    this.writeMeta({ lastSavedAt: this.clock() });

    return { ok: true, data: parsed.data, repairs: parsed.repairs };
  }

  async deleteBackup(id: string): Promise<boolean> {
    const backups = this.readBackups();
    const next = backups.filter((item) => item.id !== id);
    if (next.length === backups.length) return false;

    this.writeBackups(next);
    return true;
  }

  async clearBackups(): Promise<void> {
    this.writeBackups([]);
  }

  async getLastExportedAt(): Promise<string | null> {
    return this.readMeta().lastExportedAt ?? null;
  }

  /**
   * 다른 탭의 저장을 받는다.
   *
   * storage 이벤트는 자기 탭에서는 발생하지 않는다.
   * 그래서 "내가 쓴 것을 내가 다시 받는" 문제를 따로 거를 필요가 없다.
   */
  subscribe(listener: (data: SuiteData) => void): () => void {
    const handle = (event: StorageEvent): void => {
      // 데이터 키만 본다. 백업·메타가 바뀔 때 화면을 갈아 끼울 이유가 없다.
      if (event.key !== STORAGE_KEYS.data) return;

      // 다른 창이 키를 지웠다(전체 초기화). 그 창이 스스로 새로고침하므로
      // 이쪽 창까지 빈 화면으로 만들지 않는다.
      if (event.newValue === null) return;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(event.newValue);
      } catch {
        // 멀쩡한 화면을 망가진 데이터로 덮지 않는다.
        return;
      }

      /*
       * 고친 내용(repairs)은 알리지 않는다. 저장한 쪽에서 이미 겪고 알린 것이고,
       * 같은 안내를 창마다 띄우면 소음이 된다.
       */
      listener(parseSuiteData(parsedJson, this.clock()).data);
    };

    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
  }
}
