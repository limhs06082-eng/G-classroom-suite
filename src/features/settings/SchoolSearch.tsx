import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { NeisSource, SchoolSearchResult } from '../../shared/external/NeisSource';
import type { SchoolHit } from '../../shared/external/neisParse';
import { Button } from '../../shared/ui';

/**
 * 학교를 이름으로 찾는다.
 *
 * 지금까지는 시도교육청 코드와 학교 코드를 직접 입력하게 했다. 그 코드를
 * 아는 교사는 없다. 이름을 넣고 목록에서 고르면 코드가 한꺼번에 채워진다.
 *
 * 같은 이름의 학교가 여럿이라(전국에 '한빛초등학교'가 셋) 교육청과 주소를
 * 함께 보여 줘야 고를 수 있다.
 */
export function SchoolSearch({
  source,
  onPick,
}: {
  source: NeisSource;
  onPick: (hit: SchoolHit) => void;
}) {
  const [name, setName] = useState('');
  const [found, setFound] = useState<SchoolSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFound(null);

    try {
      setFound(await source.searchSchools(name));
    } catch {
      /*
       * 이름을 잘못 친 것과 인터넷이 끊긴 것을 가른다. 둘 다 "찾지
       * 못했습니다"로 보이면 선생님은 이름만 자꾸 고쳐 보게 된다.
       */
      setError('NEIS에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <form className="flex items-end gap-2" onSubmit={(event) => void search(event)}>
        <label className="block flex-1 text-sm">
          <span className="text-slate-700">학교 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 한빛초"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <Button type="submit" variant="primary" icon={Search} disabled={busy}>
          {busy ? '찾는 중' : '찾기'}
        </Button>
      </form>

      {error === '' ? null : (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      )}

      {found !== null && found.hits.length === 0 ? (
        <p className="text-sm text-slate-500">
          그 이름으로는 찾지 못했습니다. 앞 두 글자만 넣어 보세요 — `한빛초`처럼.
        </p>
      ) : null}

      {found !== null && found.total > found.hits.length ? (
        <p className="text-sm text-slate-600">
          {/*
           * 잘렸다고 말해 주지 않으면, 자기 학교가 없는 목록을 보고 이름을
           * 잘못 쳤다고 여긴다. 그러면 더 짧게 고쳐서 더 많이 자른다.
           * 여기서는 반대로 가라고 해야 한다.
           */}
          모두 {found.total}곳 중 {found.hits.length}곳만 보입니다. 학교 이름을 더 길게
          넣으면 좁혀집니다.
        </p>
      ) : null}

      {found !== null && found.hits.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {found.hits.map((hit) => (
            <li key={`${hit.officeCode}-${hit.schoolCode}`}>
              <button
                type="button"
                onClick={() => onPick(hit)}
                className="w-full rounded-control border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block text-sm font-medium text-slate-900">{hit.schoolName}</span>
                <span className="block text-xs text-slate-500">
                  {hit.officeName} · {hit.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
