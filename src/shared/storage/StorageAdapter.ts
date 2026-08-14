import type { RepairLog } from '../domain/invariants';
import type { SuiteData } from '../domain/types';

/**
 * 저장 계층 인터페이스.
 *
 * 원본 앱 두 곳(dashboard의 StorageAdapter, seating의 IStorageService)에
 * 이미 어댑터 개념이 있었다. 그 둘을 합쳐 하나로 정의한다.
 *
 * 이 인터페이스가 존재하는 이유는 3단계에서 FirestoreAdapter를 추가할 때
 * feature 코드를 한 줄도 고치지 않기 위해서다. 모든 화면은 이 인터페이스만 안다.
 *
 * 설계 근거: 설계 문서 §7, §12
 */

export interface LoadResult {
  data: SuiteData;
  /** 불러오는 과정에서 자동으로 고친 내용. 비어 있지 않으면 교사에게 알린다. */
  repairs: RepairLog[];
  /** 저장된 데이터가 아예 없어 새로 시작하는 경우 */
  isFirstRun: boolean;
}

export type BackupKind =
  /** 저장할 때마다 남기는 일상 스냅샷 */
  | 'auto'
  /** 학기 전환·자동 배정·초기화 등 위험 작업 직전에 남기는 보호용 스냅샷 */
  | 'guard';

export interface BackupItem {
  id: string;
  createdAt: string;
  kind: BackupKind;
  /** '학기 전환 직전', '자동 저장' 등 교사가 읽을 사유 */
  reason: string;
  sizeBytes: number;
  /** 직렬화된 SuiteData */
  payload: string;
}

/** 목록 표시용. payload를 뺀 가벼운 형태다. */
export type BackupSummary = Omit<BackupItem, 'payload'>;

export interface ImportResult {
  ok: boolean;
  /** 성공 시 적용된 데이터 */
  data?: SuiteData;
  repairs: RepairLog[];
  /** 실패 사유 (한국어) */
  message?: string;
}

export interface RestoreResult {
  ok: boolean;
  data?: SuiteData;
  repairs: RepairLog[];
  message?: string;
}

export interface StorageAdapter {
  load(): Promise<LoadResult>;
  save(data: SuiteData): Promise<void>;

  /** 전체 데이터를 사람이 읽을 수 있는 JSON으로. API 키는 포함하지 않는다. */
  exportJson(): Promise<string>;
  /** 검증 후 적용. 실패하면 기존 데이터를 건드리지 않는다. */
  importJson(json: string): Promise<ImportResult>;
  /** 초기화. 되돌릴 수 있도록 직전 상태를 guard 백업으로 남긴다. */
  reset(): Promise<SuiteData>;

  listBackups(): Promise<BackupSummary[]>;
  createBackup(reason: string, kind: BackupKind, data?: SuiteData): Promise<BackupSummary | null>;
  restoreBackup(id: string): Promise<RestoreResult>;
  deleteBackup(id: string): Promise<boolean>;
  clearBackups(): Promise<void>;

  /** 마지막으로 수동 내보내기를 한 시각. 백업 권유 알림에 쓴다. */
  getLastExportedAt(): Promise<string | null>;

  /**
   * 다른 창·기기가 자료를 바꾸면 부른다. 해제 함수를 돌려준다.
   *
   * 칠판은 target="_blank"로 별도 앱 인스턴스로 뜬다. 이 통로가 없으면
   * 각 창이 자기 메모리 사본을 들고 문서 전체를 통째로 덮어써서,
   * 서로 다른 곳을 고쳐도 한쪽이 조용히 사라진다.
   *
   * FirestoreAdapter는 이것을 onSnapshot으로 채운다.
   * 설계 근거: docs/superpowers/specs/2026-08-13-cross-window-sync-design.md
   */
  subscribe(listener: (data: SuiteData) => void): () => void;
}
