import { AlertTriangle, Copy, MessageSquareText, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { createMessageTemplate } from '../../shared/domain/factories';
import { MESSAGE_CATEGORIES, type MessageCategory, type MessageTemplate } from '../../shared/domain/types';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { Badge, Button, Card, cx, EmptyState, Modal, useToast } from '../../shared/ui';
import {
  BUILT_IN_TEMPLATES,
  placeholdersIn,
  privacyWarnings,
  renderMessage,
} from './messageCore';
import { GEMINI_KEY_STORAGE, refineText } from './refineClient';
import { isDesktop } from '../../shared/platform/target';

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 문서·문구 템플릿.
 *
 * 문구를 고르면 학교·학년·반·교사가 자동으로 채워지고, 남은 빈칸만 손으로 넣는다.
 * AI 다듬기는 선택 기능이다. 키가 없으면 그 버튼만 숨고 나머지는 다 동작한다.
 */
export default function MessagePage() {
  const { data, update } = useSuite();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<MessageCategory | '전체'>('전체');
  const [date, setDate] = useState(todayString());
  const [place, setPlace] = useState('');
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [refining, setRefining] = useState(false);

  /*
   * 설치형에서는 다듬기 자리를 아예 안 보인다.
   *
   * `refineText`가 `/api/refine`을 부르는데, 그건 웹 배포본에만 있는
   * 서버 함수다. 설치형에서는 그 주소가 없으므로 **무엇을 해도 실패한다.**
   * 그런데 실패하기 전에 선생님은 [AI 다듬기 켜기]를 눌러 설정으로 가서
   * Gemini 키를 붙여 넣게 된다 — 쓰이지도 않을 열쇠를 받아 두는 셈이다.
   *
   * 이 저장소는 형성평가를 두고 같은 판단을 이미 했다. 반쯤 살려 두면
   * "되는 줄 알았는데 안 되는 자리"가 되고, 그건 없는 것보다 나쁘다.
   * 알림장 자체는 AI 없이 온전히 돌므로 이 단추만 감춘다.
   */
  const canRefine = !isDesktop();

  const hasApiKey = useMemo(() => {
    if (!canRefine) return false;
    try {
      return (window.localStorage.getItem(GEMINI_KEY_STORAGE) ?? '').trim() !== '';
    } catch {
      return false;
    }
  }, [canRefine]);

  /** 기본 문구 + 내가 만든 문구. 숨긴 기본 문구는 뺀다. */
  const templates = useMemo((): MessageTemplate[] => {
    const builtIns = BUILT_IN_TEMPLATES.filter(
      (item) => !data.messageHidden.includes(item.id),
    ).map((item) => ({ ...item, isBuiltIn: true, createdAt: '' }));

    const all = [...builtIns, ...data.messageTemplates];
    const filtered = category === '전체' ? all : all.filter((item) => item.category === category);

    // 즐겨찾기를 위로 올린다. 자주 쓰는 문구가 매번 스크롤 아래 있으면 안 쓴다.
    return filtered.sort((a, b) => {
      const favA = data.messageFavorites.includes(a.id) ? 0 : 1;
      const favB = data.messageFavorites.includes(b.id) ? 0 : 1;
      return favA - favB || a.title.localeCompare(b.title, 'ko');
    });
  }, [data.messageTemplates, data.messageHidden, data.messageFavorites, category]);

  const selected = templates.find((item) => item.id === selectedId) ?? null;

  const body = draft ?? selected?.body ?? '';
  const rendered = useMemo(
    () => renderMessage(body, { profile: data.profile, date, place, extras }),
    [body, data.profile, date, place, extras],
  );
  const needed = useMemo(() => placeholdersIn(body), [body]);
  const warnings = useMemo(() => privacyWarnings(rendered.text), [rendered.text]);

  /** 프로필·날짜·장소로 채워지지 않아 손으로 넣어야 하는 것 */
  const manualKeys = needed.filter(
    (key) => !['학교', '학년', '반', '교사', '날짜', '장소'].includes(key),
  );

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rendered.text);
      toast.success('문구를 복사했습니다.');
    } catch {
      toast.error('복사하지 못했습니다. 문구를 직접 선택해 복사해 주세요.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">문구 템플릿</h1>
        {data.profile.schoolName === '' ? (
          <Link to="/settings" className="text-sm font-medium text-brand-700 hover:text-brand-700">
            학교 정보를 넣으면 자동으로 채워집니다
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {(['전체', ...MESSAGE_CATEGORIES] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={category === value ? 'primary' : 'ghost'}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {value}
          </Button>
        ))}

        {/*
          숨긴 기본 문구를 되살리는 길. 전에는 messageHidden에 넣기만 하고
          빼는 코드가 어디에도 없어서, 잘못 숨기면 백업 복원 말고는 방법이
          없었다.
        */}
        {data.messageHidden.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              const count = data.messageHidden.length;
              update((current) => ({ ...current, messageHidden: [] }));
              toast.success(`숨긴 기본 문구 ${count}개를 되살렸습니다.`);
            }}
          >
            숨긴 기본 문구 {data.messageHidden.length}개 되살리기
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card title={`문구 ${templates.length}개`} icon={MessageSquareText} bodyClassName="p-2">
          {templates.length === 0 ? (
            <EmptyState title="이 분류에 문구가 없습니다" description="다른 분류를 눌러 보세요." />
          ) : (
            <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
              {templates.map((template) => {
                const isFav = data.messageFavorites.includes(template.id);
                const active = selectedId === template.id;

                return (
                  <li key={template.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(template.id);
                        setDraft(null);
                        setExtras({});
                      }}
                      aria-pressed={active}
                      className={cx(
                        'min-w-0 flex-1 rounded-control px-2.5 py-2 text-left text-sm',
                        active ? 'bg-brand-50 font-medium text-brand-700' : 'hover:bg-slate-50',
                      )}
                    >
                      <span className="block truncate">{template.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {template.category}
                        {template.isBuiltIn ? ' · 기본' : ''}
                      </span>
                    </button>

                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Star}
                      iconOnly
                      aria-label={`${template.title} 즐겨찾기 ${isFav ? '해제' : '추가'}`}
                      aria-pressed={isFav}
                      className={isFav ? 'text-amber-500' : 'text-slate-300'}
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          messageFavorites: isFav
                            ? current.messageFavorites.filter((id) => id !== template.id)
                            : [...current.messageFavorites, template.id],
                        }))
                      }
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      iconOnly
                      aria-label={`${template.title} ${template.isBuiltIn ? '숨기기' : '삭제'}`}
                      onClick={() => {
                        update((current) =>
                          template.isBuiltIn
                            ? { ...current, messageHidden: [...current.messageHidden, template.id] }
                            : {
                                ...current,
                                messageTemplates: current.messageTemplates.filter(
                                  (item) => item.id !== template.id,
                                ),
                              },
                        );
                        if (selectedId === template.id) setSelectedId(null);
                        // 내가 만든 문구의 즉시 삭제는 이 앱에서 여기뿐이었다. 돌아올 길을 준다.
                        toast.info(
                          template.isBuiltIn
                            ? `${template.title}을(를) 목록에서 숨겼습니다.`
                            : `${template.title}을(를) 지웠습니다.`,
                          {
                            actionLabel: '실행 취소',
                            onAction: () =>
                              update((current) =>
                                template.isBuiltIn
                                  ? {
                                      ...current,
                                      messageHidden: current.messageHidden.filter(
                                        (id) => id !== template.id,
                                      ),
                                    }
                                  : {
                                      ...current,
                                      messageTemplates: [...current.messageTemplates, template],
                                    },
                              ),
                          },
                        );
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected === null ? (
          <Card>
            <EmptyState
              icon={MessageSquareText}
              title="문구를 골라 주세요"
              description="왼쪽에서 문구를 고르면 학교·학년·반·교사가 자동으로 채워집니다."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <Card title={selected.title}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  {needed.includes('날짜') ? (
                    <label className="block text-sm">
                      <span className="text-slate-700">날짜</span>
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="mt-1 h-9 rounded-control border border-slate-300 px-2"
                      />
                    </label>
                  ) : null}

                  {needed.includes('장소') ? (
                    <label className="block text-sm">
                      <span className="text-slate-700">장소</span>
                      <input
                        value={place}
                        onChange={(event) => setPlace(event.target.value)}
                        placeholder="본교 시청각실"
                        className="mt-1 h-9 rounded-control border border-slate-300 px-2"
                      />
                    </label>
                  ) : null}

                  {manualKeys.map((key) => (
                    <label key={key} className="block text-sm">
                      <span className="text-slate-700">{key}</span>
                      <input
                        value={extras[key] ?? ''}
                        onChange={(event) =>
                          setExtras((current) => ({ ...current, [key]: event.target.value }))
                        }
                        className="mt-1 h-9 rounded-control border border-slate-300 px-2"
                      />
                    </label>
                  ))}
                </div>

                <textarea
                  value={body}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={10}
                  aria-label="문구 본문"
                  className="w-full rounded-control border border-slate-300 p-3 text-sm leading-relaxed"
                />
              </div>
            </Card>

            <Card title="보낼 문구">
              <div className="flex flex-col gap-3">
                {rendered.missing.length > 0 ? (
                  <p className="flex items-start gap-1.5 text-sm text-warning-700">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    아직 채우지 않은 항목이 있습니다: {rendered.missing.join(', ')}
                  </p>
                ) : null}

                {warnings.map((warning) => (
                  <p key={warning} className="flex items-start gap-1.5 text-sm text-danger-700">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {warning} 보내기 전에 다시 확인해 주세요.
                  </p>
                ))}

                <pre className="rounded-control bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {rendered.text}
                </pre>

                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" icon={Copy} onClick={() => void handleCopy()}>
                    복사하기
                  </Button>
                  <Button icon={Plus} onClick={() => setSaveOpen(true)}>
                    내 문구로 저장
                  </Button>

                  {hasApiKey ? (
                    <Button
                      icon={Sparkles}
                      loading={refining}
                      onClick={() => {
                        void (async () => {
                          setRefining(true);
                          const result = await refineText(body);
                          setRefining(false);

                          if (result.ok) {
                            setDraft(result.text);
                            toast.success('문장을 다듬었습니다. 내용을 확인해 주세요.');
                          } else {
                            toast.error(result.error);
                          }
                        })();
                      }}
                    >
                      AI로 다듬기
                    </Button>
                  ) : canRefine ? (
                    <Link
                      to="/settings"
                      className="inline-flex h-10 items-center gap-2 rounded-control border border-slate-300 bg-surface px-3.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
                    >
                      <Sparkles className="size-4" aria-hidden />
                      AI 다듬기 켜기
                    </Link>
                  ) : null}

                  {rendered.missing.length > 0 ? (
                    <Badge tone="warning" className="self-center">
                      빈칸 {rendered.missing.length}개
                    </Badge>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <SaveTemplateModal
        // 고른 문구의 분류가 바뀌면 기본값도 따라가야 한다. state 초기값은
        // 첫 마운트에만 읽히므로 key로 다시 마운트한다.
        key={selected?.category ?? '기타'}
        open={saveOpen}
        defaultCategory={selected?.category ?? '기타'}
        onClose={() => setSaveOpen(false)}
        onSave={(title, categoryValue) => {
          update((current) => ({
            ...current,
            messageTemplates: [
              ...current.messageTemplates,
              createMessageTemplate({ category: categoryValue, title, body }),
            ],
          }));
          setSaveOpen(false);
          toast.success(`${title} 문구를 저장했습니다.`);
        }}
      />
    </div>
  );
}

function SaveTemplateModal({
  open,
  defaultCategory,
  onClose,
  onSave,
}: {
  open: boolean;
  defaultCategory: MessageCategory;
  onClose: () => void;
  onSave: (title: string, category: MessageCategory) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MessageCategory>(defaultCategory);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="내 문구로 저장"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={title.trim() === ''}
            onClick={() => {
              onSave(title.trim(), category);
              setTitle('');
            }}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">문구 이름</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="우리 반 준비물 안내"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">분류</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as MessageCategory)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
          >
            {MESSAGE_CATEGORIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>

        <p className="text-sm text-slate-500">
          지금 편집한 내용이 그대로 저장됩니다. 자리표시자도 함께 저장되니 다음에 또 쓸 수 있습니다.
        </p>
      </div>
    </Modal>
  );
}
