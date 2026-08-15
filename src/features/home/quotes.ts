/**
 * 오늘의 명언.
 *
 * 한국 속담과 사자성어만 담는다. **저작권이 살아 있는 문장은 넣지 않는다.**
 * 속담과 사자성어는 오래된 공유 자산이라 문제가 없다.
 *
 * 교사가 자기 문구를 넣는 기능은 만들지 않았다. 직접 띄우고 싶으면
 * 아래 도구 막대의 `알림 띄우기`가 이미 있다.
 */

export interface Quote {
  text: string;
  /** 사자성어의 한자나 속담의 뜻풀이 */
  note?: string;
}

export const QUOTES: readonly Quote[] = [
  { text: '천 리 길도 한 걸음부터' },
  { text: '가는 말이 고와야 오는 말이 곱다' },
  { text: '아는 길도 물어 가라' },
  { text: '백지장도 맞들면 낫다' },
  { text: '티끌 모아 태산' },
  { text: '열 번 찍어 아니 넘어가는 나무 없다' },
  { text: '세 살 버릇 여든까지 간다' },
  { text: '낮말은 새가 듣고 밤말은 쥐가 듣는다' },
  { text: '우물을 파도 한 우물을 파라' },
  { text: '구슬이 서 말이라도 꿰어야 보배' },
  { text: '시작이 반이다' },
  { text: '공든 탑이 무너지랴' },
  { text: '쇠뿔도 단김에 빼라' },
  { text: '급할수록 돌아가라' },
  { text: '말 한마디에 천 냥 빚도 갚는다' },
  { text: '남의 떡이 커 보인다' },
  { text: '개구리 올챙이 적 생각 못 한다' },
  { text: '윗물이 맑아야 아랫물이 맑다' },
  { text: '호미로 막을 것을 가래로 막는다' },
  { text: '도랑 치고 가재 잡는다' },

  { text: '교학상장', note: '가르치고 배우며 서로 자란다' },
  { text: '온고지신', note: '옛것을 익혀 새것을 안다' },
  { text: '괄목상대', note: '눈을 비비고 다시 볼 만큼 크게 늘었다' },
  { text: '대기만성', note: '큰 그릇은 늦게 이루어진다' },
  { text: '수불석권', note: '손에서 책을 놓지 않는다' },
  { text: '유지경성', note: '뜻이 있는 곳에 마침내 이룬다' },
  { text: '역지사지', note: '처지를 바꾸어 생각한다' },
  { text: '십시일반', note: '열 사람이 한 술씩 보태면 한 사람 몫이 된다' },
  { text: '적소성대', note: '작은 것이 쌓여 큰 것이 된다' },
  { text: '초심불망', note: '처음 먹은 마음을 잊지 않는다' },
] as const;

/** 그 해 1월 1일부터 며칠째인가. 읽을 수 없는 날짜면 null. */
function dayOfYear(today: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  const start = new Date(year, 0, 1);
  return Math.round((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * 오늘 보여 줄 명언.
 *
 * **같은 날에는 같은 것이 나온다.** 새로 고칠 때마다 바뀌면
 * "아까 그 문장 뭐였지"를 다시 찾을 수 없다.
 *
 * `offset`은 카드의 `다른 명언` 버튼이 쓴다. 저장하지 않으므로
 * 새로 고치면 오늘 것으로 돌아온다.
 */
export function quoteOfDay(today: string, offset = 0, quotes: readonly Quote[] = QUOTES): Quote {
  const fallback = quotes[0];
  // 목록이 비는 일은 없지만, 빈 배열에 나머지 연산을 하면 NaN이 된다.
  if (fallback === undefined) return { text: '오늘도 좋은 하루 되세요' };

  const base = dayOfYear(today) ?? 0;
  const index = (((base + offset) % quotes.length) + quotes.length) % quotes.length;

  return quotes[index] ?? fallback;
}
