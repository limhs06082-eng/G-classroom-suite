import type { FirebaseApp } from 'firebase/app';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

import { createEmptySuiteData } from '../domain/factories';
import type { SuiteData } from '../domain/types';
import { measureDataSize } from './dataSize';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { parseSuiteData, serializeSuiteData } from './schema';
import type {
  BackupKind,
  BackupSummary,
  ImportResult,
  LoadResult,
  RestoreResult,
  StorageAdapter,
} from './StorageAdapter';

/**
 * Firestore 저장소.
 *
 * 교사 한 명의 자료 전체가 `teachers/{uid}/suite/data` 문서 하나에 들어간다.
 * 학급·학생·점수가 서로 얽혀 있어 쪼개면 한 번의 저장이 여러 문서에 걸치고,
 * 그러면 중간에 실패했을 때 자료가 반쯤 바뀐 채로 남는다.
 *
 * ## 두 가지 함정
 *
 * 1. **자료를 객체 그대로 넣지 않는다.** SuiteData에는 `officeCode?: string`처럼
 *    값이 없을 수 있는 칸이 있는데, Firestore는 `undefined`를 받으면 저장을
 *    거부한다. 배열 안에 배열이 들어가는 것도 막는다. 그래서 문서에는
 *    `json` 글자 하나로 넣는다. 스키마 검사는 어차피 parseSuiteData가 한다.
 *
 * 2. **백업은 이 기기에 남긴다.** 백업 10개를 같이 올리면 문서 하나가
 *    바로 1MB를 넘는다. 백업·마지막 내보내기 시각은 LocalStorageAdapter에
 *    맡기고, 이 클래스는 본 자료만 원격에 둔다.
 *
 * ## 이 기기 사본
 *
 * 원격에서 읽어 온 자료는 곧바로 이 기기에도 적어 둔다. 인터넷이 끊겨도
 * 마지막 상태가 남고, 백업·내보내기를 로컬에 맡길 수 있는 근거가 된다.
 */
export class FirestoreAdapter implements StorageAdapter {
  private readonly db: Firestore;
  private readonly uid: string;
  /** 백업·내보내기 시각·이 기기 사본을 맡는다. */
  private readonly local: LocalStorageAdapter;
  private readonly onWarning: (message: string) => void;
  private readonly clock: () => string;

  constructor(
    app: FirebaseApp,
    uid: string,
    options?: {
      local?: LocalStorageAdapter;
      /** 문서가 한도에 가까워졌을 때 교사에게 알릴 통로 */
      onWarning?: (message: string) => void;
      clock?: () => string;
    },
  ) {
    this.db = getFirestore(app);
    this.uid = uid;
    this.local = options?.local ?? new LocalStorageAdapter();
    this.onWarning = options?.onWarning ?? ((message) => console.warn(message));
    this.clock = options?.clock ?? (() => new Date().toISOString());
  }

  private docRef() {
    return doc(this.db, 'teachers', this.uid, 'suite', 'data');
  }

  // ── 불러오기 / 저장 ─────────────────────────────────────────

  /**
   * 원격을 먼저 본다.
   *
   * 원격이 비어 있으면 이 브라우저에 있던 자료를 그대로 올린다. 이걸 빠뜨리면
   * 몇 달 쓰던 교사가 로그인하자마자 빈 화면을 본다. 반대로 원격에 자료가
   * 있으면 그쪽이 옳다 — 다른 기기에서 쓴 최신 자료일 수 있다.
   */
  async load(): Promise<LoadResult> {
    const snapshot = await getDoc(this.docRef());
    const remoteJson = snapshot.exists() ? (snapshot.get('json') as unknown) : null;

    if (typeof remoteJson === 'string' && remoteJson !== '') {
      const { data, repairs } = parseSuiteData(safeParse(remoteJson), this.clock());
      await this.local.save(data);
      return { data, repairs, isFirstRun: false };
    }

    // 원격이 비었다. 이 기기 자료를 그대로 올려 준다.
    const localResult = await this.local.load();
    await this.writeRemote(localResult.data);

    return localResult;
  }

  async save(data: SuiteData): Promise<void> {
    await this.writeRemote(data);
    await this.local.save(data);
  }

  private async writeRemote(data: SuiteData): Promise<void> {
    const json = serializeSuiteData(data);

    /*
     * 저장 직전에 크기를 잰다. 넘겼다고 막지는 않는다 — 여기서 멈추면
     * 교사가 방금 입력한 점수가 사라진다. 알리되 저장은 진행한다.
     */
    const report = measureDataSize(data);
    if (report.level === 'warn') {
      const biggest = report.slices[0];
      this.onWarning(
        `자료가 한도의 ${Math.round(report.ratio * 100)}%입니다.` +
          (biggest ? ` ${biggest.label}이(가) 가장 큽니다.` : '') +
          ' 설정 → 백업·복원에서 정리해 주세요.',
      );
    }

    await setDoc(this.docRef(), { json, updatedAt: this.clock() });
  }

  // ── 내보내기 / 가져오기 / 초기화 ────────────────────────────

  /** 이 기기 사본이 항상 최신이라 로컬에 맡긴다. 내보내기 시각도 함께 기록된다. */
  async exportJson(): Promise<string> {
    return this.local.exportJson();
  }

  async importJson(json: string): Promise<ImportResult> {
    // 되돌릴 수 있게 로컬에 guard 백업을 남기는 것까지 로컬이 해 준다.
    const result = await this.local.importJson(json);
    if (result.ok && result.data) {
      await this.writeRemote(result.data);
    }

    return result;
  }

  async reset(): Promise<SuiteData> {
    const data = await this.local.reset();
    await this.writeRemote(data);
    return data;
  }

  // ── 백업 (이 기기에만 둔다) ─────────────────────────────────

  async listBackups(): Promise<BackupSummary[]> {
    return this.local.listBackups();
  }

  async createBackup(
    reason: string,
    kind: BackupKind,
    data?: SuiteData,
  ): Promise<BackupSummary | null> {
    return this.local.createBackup(reason, kind, data);
  }

  async restoreBackup(id: string): Promise<RestoreResult> {
    const result = await this.local.restoreBackup(id);
    if (result.ok && result.data) {
      await this.writeRemote(result.data);
    }

    return result;
  }

  async deleteBackup(id: string): Promise<boolean> {
    return this.local.deleteBackup(id);
  }

  async clearBackups(): Promise<void> {
    return this.local.clearBackups();
  }

  async getLastExportedAt(): Promise<string | null> {
    return this.local.getLastExportedAt();
  }

  // ── 다른 기기·창의 변경 ─────────────────────────────────────

  /**
   * onSnapshot이 이 통로를 채운다.
   *
   * 내가 방금 쓴 것도 되돌아온다. 그대로 흘리면 저장할 때마다 화면이
   * 한 번씩 덜컥거리므로, 직전에 보낸 글자와 같으면 버린다.
   */
  subscribe(listener: (data: SuiteData) => void): () => void {
    let lastSeen: string | null = null;

    return onSnapshot(
      this.docRef(),
      (snapshot) => {
        const json = snapshot.exists() ? (snapshot.get('json') as unknown) : null;
        if (typeof json !== 'string' || json === '' || json === lastSeen) return;

        lastSeen = json;
        const { data } = parseSuiteData(safeParse(json), this.clock());
        void this.local.save(data);
        listener(data);
      },
      (error) => {
        this.onWarning(
          `자료를 실시간으로 받아 오지 못했습니다: ${error.message}. 이 기기에 저장된 자료로 계속 씁니다.`,
        );
      },
    );
  }
}

/** 원격 글자가 깨져 있어도 앱을 멈추지 않는다. parseSuiteData가 빈 자료를 채워 준다. */
function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return createEmptySuiteData();
  }
}
