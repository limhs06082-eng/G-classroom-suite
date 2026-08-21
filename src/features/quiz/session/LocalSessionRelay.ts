import type { QuizSessionRelay } from './QuizSessionRelay';
import { createSessionCode } from './sessionCore';
import type {
  QuizResponse,
  QuizResponseInput,
  QuizSessionInit,
  QuizSessionPatch,
  QuizSessionView,
} from './types';

/**
 * 기본 구현. 같은 브라우저의 다른 탭까지만 닿는다.
 *
 * 학생 폰은 받을 수 없다(isAvailable = false). 그래도 흐름 전체가 동작하므로
 * Firebase 없이 검증하고 연수에서 시연할 수 있다.
 *
 * 창 사이 전달은 storage 이벤트를 쓴다. 창 간 동기화에서 이미 검증한 방식이다.
 * storage 이벤트는 자기 탭에서는 오지 않으므로 자기 탭 리스너는 쓰기 직후 직접 부른다.
 */

const STORAGE_KEY = 'teacher-toolkit:v1:quiz-sessions';

interface Stored {
  init: QuizSessionInit;
  open: boolean;
  /** `${questionId}__t${teamIndex}` → 응답 */
  responses: Record<string, QuizResponse>;
}

type Book = Record<string, Stored>;

export class LocalSessionRelay implements QuizSessionRelay {
  /** 같은 브라우저 안에서만 오간다. 학생 폰은 들어올 수 없다. */
  readonly isAvailable = false;

  private readonly sessionListeners = new Map<
    string,
    Set<(view: QuizSessionView | null) => void>
  >();
  private readonly responseListeners = new Map<string, Set<(rows: QuizResponse[]) => void>>();
  private stopStorage: (() => void) | null = null;

  constructor(
    private readonly storage: Storage = window.localStorage,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async open(init: QuizSessionInit): Promise<{ code: string }> {
    const book = this.read();
    const code = createSessionCode((candidate) => candidate in book);
    book[code] = { init, open: true, responses: {} };
    this.write(book);
    return { code };
  }

  async update(code: string, patch: QuizSessionPatch): Promise<void> {
    const book = this.read();
    const entry = book[code];
    if (entry === undefined) return;

    if (patch.openQuestionIds !== undefined) entry.init.openQuestionIds = patch.openQuestionIds;
    if (patch.teams !== undefined) entry.init.teams = patch.teams;
    if (patch.open !== undefined) entry.open = patch.open;
    this.write(book);
  }

  async close(code: string): Promise<void> {
    const book = this.read();
    delete book[code];
    this.write(book);
  }

  async sweepExpired(ownerKey: string): Promise<void> {
    const book = this.read();
    const now = this.clock();
    let changed = false;

    for (const [code, entry] of Object.entries(book)) {
      if (entry.init.ownerKey === ownerKey && entry.init.expiresAt <= now) {
        delete book[code];
        changed = true;
      }
    }
    if (changed) this.write(book);
  }

  watchSession(code: string, listener: (view: QuizSessionView | null) => void): () => void {
    return this.subscribe(this.sessionListeners, code, listener, () => this.viewOf(code));
  }

  watchResponses(code: string, listener: (rows: QuizResponse[]) => void): () => void {
    return this.subscribe(this.responseListeners, code, listener, () => this.rowsOf(code));
  }

  async submit(code: string, input: QuizResponseInput): Promise<void> {
    const book = this.read();
    const entry = book[code];
    if (entry === undefined || !entry.open) {
      throw new Error('받기가 끝난 세션입니다.');
    }

    entry.responses[`${input.questionId}__t${input.teamIndex}`] = {
      ...input,
      submittedAt: this.clock(),
    };
    this.write(book);
  }

  // ── 내부 ──────────────────────────────────────────────────

  private read(): Book {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw === null || raw === '') return {};
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Book)
        : {};
    } catch {
      // 깨져 있으면 세션이 없는 것으로 본다. 임시 자료라 잃어도 된다.
      return {};
    }
  }

  private write(book: Book): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(book));
    } catch {
      // 저장이 막혀도 앱이 멈추면 안 된다.
    }
    this.notifyAll();
  }

  private subscribe<T>(
    registry: Map<string, Set<(value: T) => void>>,
    code: string,
    listener: (value: T) => void,
    read: () => T,
  ): () => void {
    const set = registry.get(code) ?? new Set();
    set.add(listener);
    registry.set(code, set);
    this.ensureStorageListener();

    listener(read());

    return () => {
      set.delete(listener);
      if (set.size === 0) registry.delete(code);
      this.releaseStorageListener();
    };
  }

  private ensureStorageListener(): void {
    if (this.stopStorage !== null || typeof window === 'undefined') return;

    const handle = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY) return;
      this.notifyAll();
    };
    window.addEventListener('storage', handle);
    this.stopStorage = () => window.removeEventListener('storage', handle);
  }

  private releaseStorageListener(): void {
    if (this.sessionListeners.size > 0 || this.responseListeners.size > 0) return;
    this.stopStorage?.();
    this.stopStorage = null;
  }

  private viewOf(code: string): QuizSessionView | null {
    const entry = this.read()[code];
    if (entry === undefined) return null;

    return {
      code,
      title: entry.init.title,
      mode: entry.init.mode,
      openQuestionIds: [...entry.init.openQuestionIds],
      questions: entry.init.questions,
      teams: [...entry.init.teams],
      open: entry.open,
    };
  }

  private rowsOf(code: string): QuizResponse[] {
    return Object.values(this.read()[code]?.responses ?? {});
  }

  private notifyAll(): void {
    for (const [code, listeners] of this.sessionListeners) {
      const view = this.viewOf(code);
      for (const listener of listeners) listener(view);
    }
    for (const [code, listeners] of this.responseListeners) {
      const rows = this.rowsOf(code);
      for (const listener of listeners) listener(rows);
    }
  }
}
