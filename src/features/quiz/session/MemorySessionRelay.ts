import type { QuizSessionRelay } from './QuizSessionRelay';
import { createSessionCode } from './sessionCore';
import type {
  QuizResponse,
  QuizResponseInput,
  QuizSessionInit,
  QuizSessionPatch,
  QuizSessionView,
} from './types';

interface Entry {
  init: QuizSessionInit;
  open: boolean;
  /** `${questionId}__t${teamIndex}` → 응답 */
  responses: Map<string, QuizResponse>;
}

/** 테스트용. 프로세스 메모리에만 산다. */
export class MemorySessionRelay implements QuizSessionRelay {
  readonly isAvailable = true;

  private readonly entries = new Map<string, Entry>();
  private readonly sessionListeners = new Map<
    string,
    Set<(view: QuizSessionView | null) => void>
  >();
  private readonly responseListeners = new Map<string, Set<(rows: QuizResponse[]) => void>>();

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  async open(init: QuizSessionInit): Promise<{ code: string }> {
    const code = createSessionCode((candidate) => this.entries.has(candidate));
    this.entries.set(code, { init, open: true, responses: new Map() });
    this.notify(code);
    return { code };
  }

  async update(code: string, patch: QuizSessionPatch): Promise<void> {
    const entry = this.entries.get(code);
    if (entry === undefined) return;

    if (patch.openQuestionIds !== undefined) entry.init.openQuestionIds = patch.openQuestionIds;
    if (patch.teams !== undefined) entry.init.teams = patch.teams;
    if (patch.open !== undefined) entry.open = patch.open;
    this.notify(code);
  }

  async close(code: string): Promise<void> {
    this.entries.delete(code);
    this.notify(code);
  }

  async sweepExpired(ownerKey: string): Promise<void> {
    const now = this.clock();
    for (const [code, entry] of [...this.entries]) {
      if (entry.init.ownerKey === ownerKey && entry.init.expiresAt <= now) {
        this.entries.delete(code);
        this.notify(code);
      }
    }
  }

  watchSession(code: string, listener: (view: QuizSessionView | null) => void): () => void {
    return this.subscribe(this.sessionListeners, code, listener, () => this.viewOf(code));
  }

  watchResponses(code: string, listener: (rows: QuizResponse[]) => void): () => void {
    return this.subscribe(this.responseListeners, code, listener, () => this.rowsOf(code));
  }

  async submit(code: string, input: QuizResponseInput): Promise<void> {
    const entry = this.entries.get(code);
    if (entry === undefined || !entry.open) {
      throw new Error('받기가 끝난 세션입니다.');
    }

    // 문서 id가 (문제, 모둠)이므로 마지막 제출이 그대로 덮어쓴다.
    entry.responses.set(`${input.questionId}__t${input.teamIndex}`, {
      ...input,
      submittedAt: this.clock(),
    });
    this.notify(code);
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

    listener(read());

    return () => {
      set.delete(listener);
    };
  }

  private viewOf(code: string): QuizSessionView | null {
    const entry = this.entries.get(code);
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
    return [...(this.entries.get(code)?.responses.values() ?? [])];
  }

  private notify(code: string): void {
    for (const listener of this.sessionListeners.get(code) ?? []) listener(this.viewOf(code));
    for (const listener of this.responseListeners.get(code) ?? []) listener(this.rowsOf(code));
  }
}
