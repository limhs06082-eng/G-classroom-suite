import { AlertTriangle, ClipboardPaste, Info } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Button, cx } from '../ui';
import { parseRosterText, type ParsedRosterRow } from './parseRosterText';
import type { ImportMode } from './rosterOps';

const PLACEHOLDER = `김가람
이나래
박다온

또는

1,김가람
2,이나래
3,박다온`;

interface Props {
  /** 모드 선택을 보여 줄지. 최초 설정에서는 항상 replace라 숨긴다. */
  showModeSelector?: boolean;
  defaultMode?: ImportMode;
  applyLabel?: string;
  onApply: (rows: ParsedRosterRow[], mode: ImportMode) => void;
}

/**
 * 명단 붙여넣기 화면.
 *
 * 핵심은 **적용 전에 결과를 보여 주는 것**이다.
 * 원본 앱들은 붙여넣으면 곧바로 반영하고, 읽지 못한 줄은 조용히 사라졌다.
 */
export function RosterImportPanel({
  showModeSelector = true,
  defaultMode = 'replace',
  applyLabel = '명단 적용',
  onApply,
}: Props) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ImportMode>(defaultMode);

  const result = useMemo(() => parseRosterText(text), [text]);
  const hasInput = text.trim() !== '';

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          학생 명단을 붙여넣으세요
        </span>
        <p className="mt-1 text-sm text-slate-500">
          이름만 적어도 되고, 엑셀에서 번호와 이름을 함께 복사해도 됩니다.
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          className="mt-2 w-full rounded-control border border-slate-300 p-3 font-mono text-sm leading-relaxed"
        />
      </label>

      {hasInput ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={result.rows.length > 0 ? 'success' : 'neutral'}>
              학생 {result.rows.length}명
            </Badge>
            {result.issues.length > 0 ? (
              <Badge tone="danger">읽지 못한 줄 {result.issues.length}개</Badge>
            ) : null}
            {result.autoNumberedCount > 0 ? (
              <Badge tone="info">번호 자동 부여 {result.autoNumberedCount}명</Badge>
            ) : null}
            {result.headerSkipped ? <Badge tone="neutral">헤더 줄 건너뜀</Badge> : null}
            {result.duplicateNumbers.length > 0 ? (
              <Badge tone="warning">번호 중복 {result.duplicateNumbers.join(', ')}</Badge>
            ) : null}
            {result.duplicateNames.length > 0 ? (
              <Badge tone="warning">같은 이름 {result.duplicateNames.join(', ')}</Badge>
            ) : null}
          </div>

          {/*
            읽지 못한 줄을 반드시 보여 준다.
            25명을 붙여넣고 23명만 들어가는 상황을 교사가 알아야 한다.
          */}
          {result.issues.length > 0 ? (
            <div className="rounded-card border border-danger-200 bg-danger-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-danger-700">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                아래 줄은 명단에 넣지 못했습니다
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {result.issues.slice(0, 8).map((issue) => (
                  <li key={issue.line} className="text-sm text-danger-700">
                    <span className="font-mono text-xs">{issue.line}행</span>
                    <span className="mx-1.5 font-mono text-xs text-danger-500">
                      {issue.text.slice(0, 24)}
                    </span>
                    — {issue.reason}
                  </li>
                ))}
                {result.issues.length > 8 ? (
                  <li className="text-sm text-danger-700">
                    외 {result.issues.length - 8}개
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {result.rows.length > 0 ? (
            <PreviewList rows={result.rows} />
          ) : (
            <p className="text-sm text-slate-500">읽어낸 학생이 없습니다. 형식을 확인해 주세요.</p>
          )}
        </div>
      ) : null}

      {showModeSelector ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-700">적용 방식</legend>
          <ModeOption
            checked={mode === 'replace'}
            onSelect={() => setMode('replace')}
            title="명단 전체 교체"
            description="붙여넣은 목록에 없는 학생은 전출 처리됩니다. 기록은 지워지지 않습니다."
          />
          <ModeOption
            checked={mode === 'add'}
            onSelect={() => setMode('add')}
            title="새 학생만 추가"
            description="기존 학생은 그대로 두고 목록에 있는 새 학생만 넣습니다."
          />
        </fieldset>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          icon={ClipboardPaste}
          disabled={result.rows.length === 0}
          onClick={() => {
            onApply(result.rows, mode);
            setText('');
          }}
        >
          {applyLabel}
        </Button>
        {hasInput ? (
          <Button variant="ghost" onClick={() => setText('')}>
            지우기
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PreviewList({ rows }: { rows: ParsedRosterRow[] }) {
  const duplicates = new Set(
    rows
      .map((row) => row.number)
      .filter((number, index, all) => all.indexOf(number) !== index),
  );

  return (
    <div className="rounded-card border border-slate-200">
      <p className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-sm text-slate-600">
        <Info className="size-4 shrink-0 text-slate-400" aria-hidden />
        이렇게 들어갑니다
      </p>
      <ul className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto p-3">
        {rows.map((row) => (
          <li
            key={`${row.line}-${row.number}`}
            className={cx(
              'inline-flex items-baseline gap-1.5 rounded-control border px-2 py-1 text-sm',
              duplicates.has(row.number)
                ? 'border-warning-200 bg-warning-50 text-warning-700'
                : 'border-slate-200 bg-slate-50 text-slate-700',
            )}
          >
            <span className="font-mono text-xs text-slate-400">{row.number}</span>
            <span>{row.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeOption({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer gap-2.5 rounded-control border p-3',
        checked ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50',
      )}
    >
      <input
        type="radio"
        name="import-mode"
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
      </span>
    </label>
  );
}
