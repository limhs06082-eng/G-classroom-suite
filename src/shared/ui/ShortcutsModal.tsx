import { Modal } from './Modal';

type Scope = 'app' | 'board';

interface Shortcut {
  keys: readonly string[];
  what: string;
}

interface Group {
  title: string;
  scope: readonly Scope[];
  items: readonly Shortcut[];
}

/*
 * 앱에 실제로 있는 단축키만 적는다. 여기 적고 코드에 없는 것은 거짓말이고,
 * 코드에 있고 여기 없는 것은 아무도 못 찾는 기능이다 — 둘 다 이 표를 고친다.
 *
 * 범위: 'board'는 전자칠판 창(AppShell 밖)에서 여는 것이라 그 창에 있는
 * 것만 보여 준다. 잠금 화면 PIN을 칠판 창에서 가르칠 이유가 없다.
 */
const GROUPS: readonly Group[] = [
  {
    title: '어디서나',
    scope: ['app', 'board'],
    items: [
      { keys: ['?'], what: '이 도움 열기' },
      { keys: ['Esc'], what: '대화상자·칠판·가리개 닫기' },
      { keys: ['Tab'], what: '대화상자 안에서 다음 칸으로' },
    ],
  },
  {
    title: '전자칠판 화면',
    scope: ['app', 'board'],
    items: [
      { keys: ['F'], what: '전체 화면 켜기·끄기' },
      { keys: ['Esc'], what: '칠판 닫기' },
    ],
  },
  {
    title: '발표자 뽑기 (결과 화면)',
    scope: ['app'],
    items: [
      { keys: ['Enter', 'Space'], what: '한 명 더 뽑기' },
      { keys: ['Esc'], what: '결과 닫기' },
    ],
  },
  {
    title: '입력칸',
    scope: ['app'],
    items: [
      { keys: ['Enter'], what: '알림장·업무·관찰 기록·과목 한 줄 추가' },
      { keys: ['←', '→'], what: '탭 옮기기 (설정·출결 등)' },
    ],
  },
  {
    title: '잠금 화면',
    scope: ['app'],
    items: [
      { keys: ['0–9'], what: 'PIN 입력' },
      { keys: ['Backspace'], what: '한 자리 지우기' },
    ],
  },
];

/** 키보드 단축키 목록. 앱 셸과 칠판 프레임이 같이 쓴다. */
export function ShortcutsModal({
  open,
  onClose,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  scope: Scope;
}) {
  const groups = GROUPS.filter((group) => group.scope.includes(scope));

  return (
    <Modal open={open} onClose={onClose} title="키보드 단축키" size="sm">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-1.5 text-xs font-semibold text-slate-500">{group.title}</h3>
            <dl className="flex flex-col gap-1">
              {group.items.map((item) => (
                <div key={item.what} className="flex items-center gap-3 text-sm">
                  <dt className="flex w-28 shrink-0 flex-wrap gap-1">
                    {item.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dt>
                  <dd className="text-slate-800">{item.what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
