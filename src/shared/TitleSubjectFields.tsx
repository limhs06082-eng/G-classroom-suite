import { useId } from 'react';

import { COMMON_SUBJECTS, MAX_SUBJECT_LENGTH } from './subjects';

/**
 * 이름과 과목 입력칸.
 *
 * 수업 흐름과 문제 세트가 같은 것을 쓴다. 둘 다 "이게 무슨 자료인가"를 말하는
 * 이름표라 모양이 같아야 한다.
 *
 * `defaultValue` + `onBlur`로 받는다. 글자마다 저장하면 다른 창까지 알림이
 * 퍼지고, 이름은 다 치고 나서 확정되는 값이다.
 *
 * 과목은 `datalist`로 고르기를 곁들인다. 목록은 돕는 것이지 가두는 것이
 * 아니라서, 방과후·동아리처럼 교과가 아닌 것도 직접 칠 수 있다.
 */
export function TitleSubjectFields({
  title,
  subject,
  titleLabel,
  onTitleChange,
  onSubjectChange,
}: {
  title: string;
  subject: string;
  titleLabel: string;
  onTitleChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
}) {
  const listId = useId();

  return (
    <div className="flex flex-wrap gap-3 rounded-card border border-slate-200 bg-slate-50 p-3">
      <label className="min-w-48 flex-1 text-sm text-slate-600">
        {titleLabel}
        <input
          type="text"
          // key를 함께 주지 않으면 다른 자료를 열었을 때 앞의 값이 남는다.
          key={`${listId}-title-${title}`}
          defaultValue={title}
          onBlur={(event) => onTitleChange(event.target.value)}
          aria-label={titleLabel}
          className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
        />
      </label>

      <label className="w-40 text-sm text-slate-600">
        과목 (선택)
        <input
          type="text"
          list={listId}
          key={`${listId}-subject-${subject}`}
          defaultValue={subject}
          maxLength={MAX_SUBJECT_LENGTH}
          onBlur={(event) => onSubjectChange(event.target.value)}
          placeholder="예: 수학"
          aria-label="과목"
          className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
        />
        <datalist id={listId}>
          {COMMON_SUBJECTS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </label>
    </div>
  );
}
