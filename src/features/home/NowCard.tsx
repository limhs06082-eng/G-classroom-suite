import { Clock, EyeOff, Monitor, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, Card } from '../../shared/ui';
import type { NowState } from '../now/nowCore';
import { useTools } from '../tools/ToolsContext';

/**
 * '지금' 카드.
 *
 * 시계도 자료도 보지 않는다. `state`를 받아 그리기만 한다. 그렇게 둔 까닭은
 * **여섯 갈래를 전부 확인할 수 있어야** 하기 때문이다. 카드가 제 시계를 보면
 * 점심때 화면이 어떻게 생겼는지 보려고 시스템 시계를 돌려야 한다.
 *
 * 전자칠판도 직접 열지 않는다. 여는 법(`openBoard`)은 웹과 설치형이 다르고
 * 그 사정은 홈이 안다. 카드는 넘겨받은 것을 부르기만 한다.
 */
export function NowCard({
  state,
  onOpenBoard,
  hasMealCard,
}: {
  state: NowState;
  onOpenBoard: () => void;
  /**
   * 홈에 '오늘 급식' 카드가 실제로 있는가.
   *
   * 급식은 설치형에서만 된다(NEIS가 브라우저의 직접 요청을 막는다). 웹의
   * 그 자리에는 이름이 '급식'인 다른 카드가 있고 내용은 "설치형에서만
   * 받아 옵니다"다. 그런 화면에서 "'오늘 급식' 카드에 있습니다"라고 하면
   * 없는 것을 찾아 헤매게 만든다.
   *
   * 여기서 `isDesktop()`을 부르지 않는다. 이 카드는 그리기만 하는 자리라
   * 빌드 대상을 알면 안 되고, 어차피 **홈이 이미 아는 사실**이다.
   */
  hasMealCard: boolean;
}) {
  return (
    <Card title="지금" icon={Clock}>
      <NowBody state={state} onOpenBoard={onOpenBoard} hasMealCard={hasMealCard} />
    </Card>
  );
}

/**
 * 갈래를 가른다.
 *
 * 삼항식을 여섯 개 늘어놓지 않는다. 그러면 일곱째 갈래가 생겼을 때 **조용히
 * 빈 카드**가 되는데, 빈 카드는 아무도 신고하지 않는다. `switch`의 마지막
 * 갈래에서 `never`로 받으면 그 순간 컴파일이 깨진다.
 */
function NowBody({
  state,
  onOpenBoard,
  hasMealCard,
}: {
  state: NowState;
  onOpenBoard: () => void;
  hasMealCard: boolean;
}) {
  switch (state.kind) {
    case 'no-timetable':
      return (
        <p className="text-sm text-slate-500">
          시간표를 짜면 지금 몇 교시인지 알려 드립니다.{' '}
          {/* 말만 하고 마는 카드가 되지 않게 갈 길을 함께 둔다. */}
          <Link to="/settings?tab=timetable" className="font-medium text-brand-700 underline">
            시간표 짜기
          </Link>
        </p>
      );

    case 'before':
      /*
       * 등교 전은 한 줄이다. 홈에는 당번 카드와 과제 카드가 이미 나란히 있어
       * 여기서 같은 것을 또 그리면 도움이 아니라 잡음이 된다.
       */
      return (
        <OneLine
          main={`${state.period}교시 ${state.subject} · ${state.startsAt} 시작`}
          aside={untilText(state.minutesUntil)}
        />
      );

    case 'lesson':
      return (
        <div className="flex flex-col gap-3">
          <div>
            {/*
              홈에서 가장 큰 글씨다. 하루 종일 켜 둔 화면을 흘긋 볼 때 눈에
              들어와야 하는 것이 이 한 줄이라 카드 제목(text-base)보다 크다.
              board 스케일은 안 쓴다 — 그건 3~8m 떨어진 뒷자리에서 읽는
              전자칠판 전용이고, 교실 컴퓨터 화면에 섞으면 안 된다.
            */}
            <p className="text-2xl font-bold text-slate-900">
              {`${state.period}교시 ${state.subject}`}
            </p>
            {/*
              남은 시간은 1분마다 바뀐다. tabular-nums가 아니면 숫자 폭이
              달라져 글자가 좌우로 흔들린다.
            */}
            <p data-numeric className="mt-0.5 text-sm text-slate-500">
              {`${state.minutesLeft}분 남음`}
            </p>
          </div>
          <LessonTools onOpenBoard={onOpenBoard} />
        </div>
      );

    case 'break':
      /*
       * 쉬는 시간에 타이머를 내밀면 자리만 차지한다. 그때 궁금한 것은
       * 다음 교시가 무엇이고 얼마나 남았는가다.
       */
      return (
        <OneLine
          main={`다음 ${state.period}교시 ${state.subject}`}
          aside={untilText(state.minutesUntil)}
        />
      );

    case 'lunch':
      return (
        <div>
          <p className="text-base font-semibold text-slate-900">점심시간입니다</p>
          {/*
            '아래 카드'라고 쓰지 않는다. 홈에서 이 카드가 어디 놓이는지는
            홈이 정하고, 화면 폭에 따라 옆이 되기도 아래가 되기도 한다.
            자리 대신 이름으로 가리킨다.

            없는 카드를 가리키지도 않는다. 웹에는 '오늘 급식' 카드가 없다.
          */}
          {hasMealCard ? (
            <p className="mt-1 text-sm text-slate-500">
              오늘 급식은 &lsquo;오늘 급식&rsquo; 카드에 있습니다.
            </p>
          ) : null}
        </div>
      );

    case 'after':
      return <p className="text-sm text-slate-600">오늘 수업이 끝났습니다.</p>;

    default: {
      /*
       * 여기까지 오면 `NowState`에 갈래가 늘었는데 이 카드가 못 따라온 것이다.
       * 컴파일이 먼저 깨지지만, 저장된 자료가 코드보다 앞서 나가는 일은 실제로
       * 있으므로 화면에도 티가 나게 둔다.
       */
      const unhandled: never = state;
      return (
        <p className="text-sm text-warning-700">
          지금이 어떤 때인지 알 수 없습니다 ({kindOf(unhandled)}).
        </p>
      );
    }
  }
}

/**
 * 수업 중에만 손에 닿는 도구.
 *
 * 제 `ToolsProvider`를 만들지 않는다. 만들면 툴바와 **다른 상태**를 보게 되어
 * 단추를 눌러도 아무 일이 안 일어나는데, 그래도 컴파일은 되고 카드만 그리는
 * 시험도 통과한다. provider는 `AppShell`이 이미 씌워 준다.
 *
 * 단추 크기를 툴바(sm)보다 키운 까닭은 여기가 카드 안이라 자리가 있고,
 * 수업 중에 서서 누르는 단추이기 때문이다. md는 40px 높이를 지킨다.
 */
function LessonTools({ onOpenBoard }: { onOpenBoard: () => void }) {
  const { open } = useTools();

  return (
    <div className="flex flex-wrap gap-2">
      <Button icon={Monitor} onClick={onOpenBoard}>
        전자칠판
      </Button>
      <Button icon={Timer} onClick={() => open('timer')}>
        타이머
      </Button>
      <Button icon={EyeOff} onClick={() => open('curtain')}>
        화면 가리기
      </Button>
    </div>
  );
}

/**
 * 한 줄로 짚는 갈래(등교 전·쉬는 시간)의 공통 모양.
 *
 * 남은 시간을 흐리게 두는 까닭은 **읽는 순서** 때문이다. 무슨 과목인지 먼저
 * 보고 그다음에 얼마나 남았는지 본다. 둘을 같은 굵기로 두면 눈이 갈 데를
 * 못 정한다.
 */
function OneLine({ main, aside }: { main: string; aside: string }) {
  return (
    <p className="text-sm text-slate-800">
      {main} ·{' '}
      <span data-numeric className="text-slate-500">
        {aside}
      </span>
    </p>
  );
}

/**
 * 남은 시간을 사람이 읽는 말로 바꾼다.
 *
 * `280분 뒤`는 아무도 못 읽는다. 오후에만 수업이 있는 반이면 등교 전에 실제로
 * 그런 값이 나온다.
 */
function untilText(minutes: number): string {
  if (minutes < 60) return `${minutes}분 뒤`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  // '4시간 0분 뒤'는 군더더기다.
  return rest === 0 ? `${hours}시간 뒤` : `${hours}시간 ${rest}분 뒤`;
}

/** 타입이 막아도 값은 올 수 있다. 그때 갈래 이름이라도 화면에 남긴다. */
function kindOf(value: never): string {
  const kind: unknown = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : '알 수 없음';
}
