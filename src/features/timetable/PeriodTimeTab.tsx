import { Clock } from 'lucide-react';
import { useState } from 'react';

import { createDefaultPeriodTimes } from '../../shared/domain/factories';
import type { PeriodTime } from '../../shared/domain/types';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { Button, Card, ConfirmDialog } from '../../shared/ui';
import { hmOf, lunchGap, minutesOf } from '../now/nowCore';

/** 한 줄의 두 끝. 키를 만들 때도 라벨을 지을 때도 이 둘뿐이다. */
type Edge = 'start' | 'end';

const EDGES: readonly Edge[] = ['start', 'end'];

const EDGE_NAME: Record<Edge, string> = { start: '시작', end: '끝' };

/** 초안 서랍의 열쇠. 교시 번호만으로는 시작과 끝을 못 가른다. */
function draftKey(period: number, edge: Edge): string {
  return `${String(period)}-${edge}`;
}

/**
 * 우리 학교 일과.
 *
 * **`update()`에 못 읽는 값을 넘기지 않는 것이 이 화면의 전부다.**
 *
 * 교시 시각 한 줄만 못 읽게 되어도 '지금' 카드는 그 줄을 버리고, 버려진
 * 자리가 앞뒤 교시를 잇는 60분짜리 구멍이 된다. 그 구멍은 진짜 점심과
 * 길이가 같아서 **아침 09:55에 "점심"이라고 뜬다.** 실제로 재현해 본 일이다.
 *
 * `invariants.ts`와 `schema.ts`가 같은 그물을 놓아 두었지만 그 그물은
 * **자료가 밖에서 들어올 때** 쳐진다. 여기는 `update()`로 직접 쓰는 자리라
 * 그 길을 안 거친다. 게다가 invariants의 그물에 걸리면 한 줄이 아니라
 * **일곱 줄이 통째로 기본값으로 되돌아간다** — 손으로 맞춰 둔 나머지 여섯
 * 줄까지 같이 날아가므로, 걸리기 전에 여기서 막는 편이 훨씬 싸다.
 *
 * `isDesktop()` 분기를 두지 않는다. 일과는 바깥 통신이 없어 웹에서도
 * 설치형에서도 똑같이 돈다.
 */
export function PeriodTimeTab() {
  const { data, update } = useSuite();

  /**
   * 아직 자료에 못 넣은 값.
   *
   * 칸을 `data`에 그대로 매어 두면 고치는 도중이 통째로 막힌다 — `09:00`을
   * 지우는 순간 빈 값이 되고, 빈 값은 저장할 수 없으니 화면이 곧바로
   * `09:00`으로 되감겨 다음 글자를 칠 수 없다. 그래서 못 넣는 값은 여기
   * 담아 칸에만 보여 준다. 담긴 값은 **자료가 아니다** — 저장되지 않았다는
   * 뜻이고, 그래서 아래 note가 늘 그 까닭을 말한다.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [reverting, setReverting] = useState(false);

  /** 칸에 보일 값. 초안이 있으면 초안이 임자다. */
  const shown = (time: PeriodTime, edge: Edge): string =>
    drafts[draftKey(time.period, edge)] ?? time[edge];

  const edit = (time: PeriodTime, edge: Edge, value: string): void => {
    /*
     * 짝이 되는 칸도 초안에서 읽는다. 시작을 지운 채 끝을 고치면 저장된
     * 옛 시작과 견주게 되는데, 그러면 화면에는 빈 시작이 보이는데 자료는
     * 멀쩡한 한 줄이 되어 둘이 갈라진다. 한 줄은 두 칸이 다 읽혀야 한 줄이다.
     */
    const start = edge === 'start' ? value : shown(time, 'start');
    const end = edge === 'end' ? value : shown(time, 'end');
    const startMin = minutesOf(start);
    const endMin = minutesOf(end);

    const reason = ((): string => {
      if (minutesOf(value) === null) {
        return `${String(time.period)}교시 ${EDGE_NAME[edge]} 시각을 채워 주세요.`;
      }
      if (startMin === null || endMin === null) {
        return `${String(time.period)}교시의 남은 칸을 먼저 채워 주세요.`;
      }
      if (endMin <= startMin) {
        // 길이가 0인 교시도 '지금' 카드는 못 읽는 줄로 보고 버린다.
        return `${String(time.period)}교시는 끝이 시작보다 이릅니다. 고치기 전까지 저장하지 않습니다.`;
      }
      return '';
    })();

    if (reason !== '') {
      setDrafts((current) => ({ ...current, [draftKey(time.period, edge)]: value }));
      setNote(reason);
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      delete next[draftKey(time.period, edge)];
      return next;
    });
    setNote('');

    // data가 아니라 current에서 읽는다. 일곱 줄을 잇달아 고칠 때 화면이 아직
    // 못 따라온 옛 목록을 바탕으로 덮어쓰면 방금 고친 줄이 되돌아간다.
    update((current) => ({
      ...current,
      periodTimes: current.periodTimes.map((row) =>
        row.period === time.period
          ? { ...row, ...(edge === 'start' ? { start: value } : { end: value }) }
          : row,
      ),
    }));
  };

  const revert = (): void => {
    update((current) => ({ ...current, periodTimes: createDefaultPeriodTimes() }));
    /*
     * 초안도 같이 버린다. 안 버리면 막혀 있던 08:00이 칸에 그대로 남아,
     * 화면은 08:00을 자료는 09:40을 들고 갈라진다. 선생님은 화면을 믿으므로
     * 저장되지 않은 값을 저장된 값으로 여기고 떠난다 — 이 화면이 막으려던
     * 바로 그 어긋남이 되돌리기 단추에서 되살아나는 자리다.
     */
    setDrafts({});
    setNote('');
    setReverting(false);
  };

  const isDefault = sameSchedule(data.periodTimes, createDefaultPeriodTimes());
  const hasDrafts = Object.keys(drafts).length > 0;
  const lunch = lunchGap(data.periodTimes);

  return (
    <Card
      title="우리 학교 일과"
      icon={Clock}
      action={
        /*
         * 기본값 그대로면 누를 까닭이 없다. 눌렀는데 아무 일도 안 일어나면
         * 선생님은 앱이 고장 났다고 여긴다(시간표의 '전체 지우기'와 같은 규칙).
         * 다만 막힌 초안이 남아 있으면 그것을 버리는 길이라 그때는 내놓는다.
         */
        isDefault && !hasDrafts ? null : (
          <Button variant="ghost" onClick={() => setReverting(true)}>
            기본 일과로
          </Button>
        )
      }
    >
      <p className="text-sm text-slate-500">
        학년·학급이 달라도 일과는 학교 하나입니다. 여기서 고치면 모든 반에 같이 적용됩니다.
      </p>

      {/*
       * 비어 있어도 늘 그린다. aria-live 영역은 글이 바뀌기 **전에** 이미
       * 화면에 있어야 낭독기가 읽는다 — 필요할 때 만들어 넣으면 늦다.
       * min-h-5는 글이 들고 날 때 표가 위아래로 튀지 않게 한다.
       */}
      <p role="status" className="mt-2 min-h-5 text-sm text-danger-700">
        {note}
      </p>

      <table className="mt-2 w-full table-fixed border-collapse">
        <caption className="sr-only">1교시부터 7교시까지의 시작·끝 시각</caption>
        <thead>
          <tr>
            <th className="w-16">
              <span className="sr-only">교시</span>
            </th>
            {EDGES.map((edge) => (
              <th key={edge} scope="col" className="pb-1 text-sm font-medium text-slate-600">
                {EDGE_NAME[edge]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.periodTimes.map((time) => (
            <tr key={time.period}>
              <th scope="row" className="text-sm font-normal text-slate-500">
                {time.period}교시
              </th>
              {EDGES.map((edge) => (
                <td key={edge} className="p-0.5">
                  <input
                    type="time"
                    /*
                     * type="time"을 쓰는 까닭. 브라우저가 형식을 지켜 주므로
                     * "9시"나 "0900" 같은 글자가 애초에 안 들어오고, 낭독기도
                     * 시·분으로 읽는다. 자리를 손으로 나누는 것보다 낫다.
                     */
                    value={shown(time, edge)}
                    onChange={(event) => edit(time, edge, event.target.value)}
                    /*
                     * 이름은 자리다. 표를 낭독기로 훑을 때 알아야 하는 것은
                     * '여기가 몇 교시의 어느 끝이냐'인데, 열 제목만으로는
                     * 칸 안에 들어갔을 때 그것이 안 읽힌다.
                     */
                    aria-label={`${String(time.period)}교시 ${EDGE_NAME[edge]}`}
                    className="h-9 w-full rounded-control border border-slate-300 px-2 text-sm"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/*
       * 점심을 따로 묻지 않는다 — 일곱 줄 사이에서 가장 긴 틈이 점심이다
       * (nowCore.lunchGap). 묻지 않는 대신 **그렇게 정해진 결과를 보여 준다.**
       * 안 보여 주면 교사는 4교시 끝을 옮긴 것이 점심을 옮겼다는 사실을
       * 알 길이 없고, 자기가 안 건드린 곳이 바뀌었다고 느낀다.
       */}
      <p className="mt-3 text-xs text-slate-500">
        {lunch === null
          ? '점심 시간을 정하지 못했습니다. 교시 사이에 25분 넘게 비는 틈이 하나 있어야 점심으로 봅니다.'
          : `점심 ${hmOf(lunch.start)} ~ ${hmOf(lunch.end)} · 교시 사이에서 가장 긴 틈을 점심으로 봅니다.`}
      </p>

      <ConfirmDialog
        open={reverting}
        title="기본 일과로 되돌릴까요?"
        description="일곱 줄이 모두 9시 시작·40분 수업으로 돌아갑니다. 손으로 맞춰 둔 시각은 사라집니다."
        destructive
        confirmLabel="되돌리기"
        onCancel={() => setReverting(false)}
        onConfirm={revert}
      />
    </Card>
  );
}

/** 두 일과가 같은가. 되돌리기 단추를 내놓을지 가리는 데만 쓴다. */
function sameSchedule(a: PeriodTime[], b: PeriodTime[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((row, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      other.period === row.period &&
      other.start === row.start &&
      other.end === row.end
    );
  });
}
