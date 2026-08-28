import { Check, Palette } from 'lucide-react';

import { THEMES, type ThemeId } from '../../shared/theme/themes';
import { ROOT_DEFAULT_THEME, useTheme } from '../../shared/theme/useTheme';
import { Card, cx } from '../../shared/ui';

/**
 * 미리보기에 놓을 과목 넷.
 *
 * 클래스 글자를 `bg-subject-${n}`처럼 지어 쓰지 않고 그대로 적는다. 지어 쓰면
 * Tailwind가 소스에서 그 글자를 못 찾아 CSS를 **한 줄도 안 내보낸다** —
 * 색만 조용히 안 먹고 빌드도 시험도 아무 말을 안 한다(TimetableTab.tsx가
 * 같은 까닭으로 열둘을 손으로 적어 두었다).
 *
 * 번호는 `subjects.ts`가 그 과목에 정해 둔 것 그대로다. 여기서 국어가 빨강인데
 * 시간표에서 파랑이면 미리보기가 거짓말을 하는 셈이라, 시험이 둘을 견준다.
 *
 * 넷을 이웃한 번호로 안 고른다. 1·6·8·11은 색상각이 20·170·230·320으로 고루
 * 벌어져 있다. **'또렷하게'가 있는 까닭이 과목 색 채도**인데, 이웃한 번호끼리
 * 놓으면 그 차이가 안 보여 왜 그 테마가 있는지 알 길이 없다.
 */
const PREVIEW_SUBJECTS: readonly { name: string; tintClass: string }[] = [
  { name: '국어', tintClass: 'bg-subject-1' },
  { name: '사회', tintClass: 'bg-subject-6' },
  { name: '영어', tintClass: 'bg-subject-8' },
  { name: '미술', tintClass: 'bg-subject-11' },
];

/**
 * 그 테마로 그린 화면 한 조각.
 *
 * **이 조각이 이 탭의 값어치다.** 이름만 넷 늘어놓으면 '포근하게'가 무슨
 * 색인지 눌러 봐야 알고, 눌러 보는 것은 앱 전체가 한 번 뒤집히는 일이다.
 *
 * `data-theme`을 이 요소에 직접 붙인다. `index.css`의 테마 블록이 `:root`에
 * 안 매여 있어서, 붙이면 그 안에서만 CSS 변수가 바뀐다.
 *
 * **밝게에는 안 붙인다.** `:root`의 기본값이 곧 밝은 테마라 `light` 블록이
 * 아예 없고, 붙여 봐야 어디에도 안 걸리는 속성이 남을 뿐이다. `<html>`에
 * 붙일 때와 같은 규칙이라 상수도 같은 것(`ROOT_DEFAULT_THEME`)을 쓴다.
 *
 * 담은 것: 바탕 → 카드 → 글자 두 단계 → 기능 색 → 과목 색. 테마가 실제로
 * 건드리는 다섯 가지다. 색 이름을 여기 박지 않는다 — 전부 `index.css`의
 * 토큰을 거치므로 이 조각은 테마가 늘어도 그대로 돈다.
 *
 * 낭독기에서는 숨긴다. '우리 반'도 '국어'도 색을 보이려고 놓은 그림이지 읽을
 * 글이 아니라서, 안 숨기면 테마마다 같은 말이 네 번 읽힌다.
 */
function ThemePreview({ id }: { id: ThemeId }) {
  return (
    <span
      data-theme={id === ROOT_DEFAULT_THEME ? undefined : id}
      data-testid={`theme-preview-${id}`}
      aria-hidden
      /* 앱 화면은 바탕(slate-50) 위에 표면 카드가 얹힌 모양이다. 그대로 줄인다. */
      className="block rounded-control border border-slate-200 bg-slate-50 p-1.5"
    >
      <span className="block rounded-control border border-slate-200 bg-surface p-2">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">
            우리 반
          </span>
          {/*
           * 기능 색 한 조각. 이 파랑은 테마가 바뀌어도 거의 그대로다 —
           * 넷을 나란히 놓으면 그 사실이 눈에 보인다.
           */}
          <span className="shrink-0 rounded-control bg-brand-600 px-1.5 py-0.5 text-xs font-medium text-white">
            저장
          </span>
        </span>

        {/* 흐린 글자. 테마마다 이 단계가 읽히는지가 가장 먼저 무너지는 자리다. */}
        <span className="mt-1 block text-xs text-slate-500">3교시까지 20분</span>

        <span className="mt-1.5 flex gap-1">
          {PREVIEW_SUBJECTS.map((subject) => (
            <span
              key={subject.name}
              className={cx(
                'min-w-0 flex-1 truncate rounded-control py-0.5 text-center text-xs text-slate-700',
                subject.tintClass,
              )}
            >
              {subject.name}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

/**
 * 화면 테마를 고른다.
 *
 * 시간표 탭에 얹지 않고 '화면' 탭을 따로 둔다. 시간표와 아무 상관이 없고,
 * 나중에 글자 크기처럼 '보이는 방식'을 다루는 것들이 붙을 자리다.
 *
 * `isDesktop()` 분기를 두지 않는다. 테마는 바깥 통신이 없어 웹에서도
 * 설치형에서도 똑같이 돈다.
 */
export function ThemeTab() {
  const { theme, setTheme } = useTheme();

  return (
    <Card title="테마" icon={Palette}>
      <p className="text-sm text-slate-500">
        교실 조명과 화면에 맞춰 고릅니다. 고른 테마는{' '}
        <strong className="font-semibold">이 컴퓨터에만</strong> 남고 백업 파일에는 안 들어갑니다.
        교실 컴퓨터를 프로젝터용으로 맞춰 둬도 집 노트북 화면은 그대로입니다.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {THEMES.map((item) => {
          const chosen = item.id === theme;

          return (
            <button
              key={item.id}
              type="button"
              /*
               * 고른 것을 `aria-pressed`로 알린다. 테두리 색과 체크 표시만으로는
               * 낭독기에 아무것도 안 남는다 — 넷 다 그냥 단추로 읽힌다.
               */
              aria-pressed={chosen}
              onClick={() => setTheme(item.id)}
              className={cx(
                'flex flex-col gap-1.5 rounded-card border p-3 text-left',
                'transition-colors duration-[120ms] ease-out-soft',
                chosen
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 bg-surface hover:border-slate-300',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                {chosen ? (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700">
                    <Check className="size-3.5" aria-hidden />
                    사용 중
                  </span>
                ) : null}
              </span>

              {/*
               * 한 줄과 두 줄이 섞이면 미리보기 위치가 타일마다 어긋난다.
               * 넷을 견주라고 나란히 둔 것이라 높이를 맞춘다.
               */}
              <span className="min-h-8 text-xs text-slate-500">{item.when}</span>

              <ThemePreview id={item.id} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
