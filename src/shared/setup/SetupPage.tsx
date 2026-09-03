import { ArrowLeft, ArrowRight, Check, School } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SchoolSearch } from '../../features/settings/SchoolSearch';
import { createClassRoom, createTerm } from '../domain/factories';
import { NeisSource } from '../external/NeisSource';
import { TauriHttpClient } from '../external/TauriHttpClient';
import { isDesktop } from '../platform/target';
import { RosterImportPanel } from '../roster/RosterImportPanel';
import { applyRosterImport } from '../roster/rosterOps';
import { useSuite } from '../roster/SuiteDataProvider';
import { Button, Card, cx, useToast } from '../ui';

/**
 * 최초 설정 마법사.
 *
 * 원본 reward의 InitialSetupWizard를 확장했다.
 * 목표는 하나다: **한 번 입력하면 5개 기능이 전부 켜진다.**
 * 학교·학급·명단만 받고 나머지는 기본값으로 시작한다.
 */

type Step = 'school' | 'class' | 'roster';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'school', label: '학교' },
  { id: 'class', label: '학급' },
  { id: 'roster', label: '명단' },
];

/** 3월 이전이면 아직 지난 학년도다. 학교 학년도는 3월에 바뀐다. */
function currentSchoolYear(today: Date): string {
  return String(today.getMonth() + 1 >= 3 ? today.getFullYear() : today.getFullYear() - 1);
}

export default function SetupPage() {
  const { data, update } = useSuite();
  const toast = useToast();
  const navigate = useNavigate();

  const today = new Date();
  const [step, setStep] = useState<Step>('school');
  const [schoolName, setSchoolName] = useState(data.profile.schoolName);
  const [teacherName, setTeacherName] = useState(data.profile.teacherName);
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear(today));
  const [semester, setSemester] = useState('1학기');
  const [className, setClassName] = useState('');

  /** 만든 학급 id. 명단 단계에서 쓴다. */
  const [classId, setClassId] = useState<string | null>(null);
  /** 학교 검색으로 고른 NEIS 코드·주소. 설치형에서만 채워진다. */
  const [schoolCodes, setSchoolCodes] = useState<{
    officeCode: string;
    schoolCode: string;
    schoolAddress: string;
  } | null>(null);

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  const createClass = (): void => {
    /*
     * 이미 만든 적이 있으면(명단 단계에서 [이전]으로 돌아온 경우) 새로
     * 만들지 않고 그 학급·학기의 값만 고친다. 전에는 매번 새로 만들어서,
     * 이름 오타를 고치러 돌아갔다 오면 같은 이름의 학급과 학기가 하나 더
     * 생겼다 — 처음 쓰는 교사가 가장 밟기 쉬운 길에 있던 함정이다.
     */
    if (classId !== null) {
      update((current) => {
        const room = current.classRooms.find((item) => item.id === classId);
        const termId = room?.termId;
        const now = new Date().toISOString();
        return {
          ...current,
          profile: {
            ...current.profile,
            schoolName: schoolName.trim(),
            teacherName: teacherName.trim(),
            ...(schoolCodes ?? {}),
          },
          terms: current.terms.map((term) =>
            term.id === termId
              ? {
                  ...term,
                  schoolYear,
                  semester,
                  name: `${schoolYear}학년도 ${semester}`,
                  startDate: `${schoolYear}-03-02`,
                  endDate: `${Number(schoolYear) + 1}-02-28`,
                }
              : term,
          ),
          classRooms: current.classRooms.map((item) =>
            item.id === classId ? { ...item, name: className.trim(), updatedAt: now } : item,
          ),
        };
      });
      setStep('roster');
      return;
    }

    const term = createTerm({
      schoolYear,
      semester,
      startDate: `${schoolYear}-03-02`,
      endDate: `${Number(schoolYear) + 1}-02-28`,
    });
    const room = createClassRoom({ termId: term.id, name: className.trim() });

    setClassId(room.id);
    update((current) => ({
      ...current,
      profile: {
        ...current.profile,
        schoolName: schoolName.trim(),
        teacherName: teacherName.trim(),
        ...(schoolCodes ?? {}),
      },
      terms: [...current.terms, term],
      classRooms: [...current.classRooms, room],
      activeTermId: term.id,
      activeClassId: room.id,
    }));
    setStep('roster');
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">처음 설정</h1>
        <p className="mt-1 text-sm text-slate-600">
          여기서 한 번 등록하면 자리배치·당번·보상·과제에서 모두 같은 명단을 씁니다.
        </p>
      </header>

      <ol className="flex items-center gap-2" aria-label="설정 단계">
        {STEPS.map((entry, index) => (
          <li key={entry.id} className="flex items-center gap-2">
            <span
              className={cx(
                'inline-flex size-7 items-center justify-center rounded-full text-sm font-medium',
                index < stepIndex
                  ? 'bg-success-500 text-white'
                  : index === stepIndex
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-200 text-slate-500',
              )}
              aria-current={index === stepIndex ? 'step' : undefined}
            >
              {index < stepIndex ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span
              className={cx(
                'text-sm',
                index === stepIndex ? 'font-medium text-slate-900' : 'text-slate-500',
              )}
            >
              {entry.label}
            </span>
            {index < STEPS.length - 1 ? <span className="text-slate-300">›</span> : null}
          </li>
        ))}
      </ol>

      {step === 'school' ? (
        <Card title="학교와 선생님" icon={School}>
          <div className="flex flex-col gap-3">
            {/*
             * 설치형은 학교를 **검색해서** 고른다. 이름만 치고 끝내면 NEIS
             * 코드·주소가 비어 급식도 날씨도 안 켜지고, 방금 학교를 입력한
             * 교사가 홈에서 "학교를 정하면…"을 다시 보게 된다. 웹은 NEIS를
             * 직접 못 불러 이름 입력만 남긴다(설정의 학교 정보 탭과 같다).
             */}
            {isDesktop() ? (
              <div>
                <span className="text-sm text-slate-700">학교 찾기</span>
                <div className="mt-1">
                  <SchoolSearch
                    source={new NeisSource(new TauriHttpClient())}
                    onPick={(hit) => {
                      setSchoolName(hit.schoolName);
                      setSchoolCodes({
                        officeCode: hit.officeCode,
                        schoolCode: hit.schoolCode,
                        schoolAddress: hit.address,
                      });
                    }}
                  />
                </div>
                {schoolCodes === null ? null : (
                  <p className="mt-1 text-sm text-success-700">
                    {schoolName} — 급식과 날씨가 함께 켜집니다.
                  </p>
                )}
              </div>
            ) : null}

            <label className="block text-sm">
              <span className="text-slate-700">학교 이름</span>
              <input
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="한빛초등학교"
                className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">선생님 이름</span>
              <input
                value={teacherName}
                onChange={(event) => setTeacherName(event.target.value)}
                placeholder="임한솔"
                className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
              />
              <span className="mt-1 block text-slate-500">
                안내문에 들어갈 이름입니다. 나중에 설정에서 바꿀 수 있습니다.
              </span>
            </label>

            <div className="flex justify-end">
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={schoolName.trim() === ''}
                onClick={() => setStep('class')}
              >
                다음
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'class' ? (
        <Card title="학기와 학급">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <label className="block flex-1 text-sm">
                <span className="text-slate-700">학년도</span>
                <input
                  value={schoolYear}
                  onChange={(event) => setSchoolYear(event.target.value)}
                  inputMode="numeric"
                  className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
                />
              </label>
              <label className="block flex-1 text-sm">
                <span className="text-slate-700">학기</span>
                <select
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                  className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
                >
                  <option>1학기</option>
                  <option>2학기</option>
                </select>
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-slate-700">학급 이름</span>
              <input
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="3학년 2반"
                className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
              />
              <span className="mt-1 block text-slate-500">
                여러 반을 맡으신다면 나머지는 나중에 설정에서 추가할 수 있습니다.
              </span>
            </label>

            <div className="flex justify-between">
              <Button icon={ArrowLeft} onClick={() => setStep('school')}>
                이전
              </Button>
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={className.trim() === '' || schoolYear.trim() === ''}
                onClick={createClass}
              >
                다음
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'roster' ? (
        <Card title="학생 명단">
          <RosterImportPanel
            showModeSelector={false}
            applyLabel="명단 등록하고 시작하기"
            onApply={(rows) => {
              if (classId === null) return;
              update((current) => applyRosterImport(current, classId, rows, 'replace'));
              /*
               * 다음 할 일은 시간표다. 홈으로 보내면 가장 큰 카드('지금')가
               * "시간표를 짜면…"이라 말하는 미완성 첫인상을 준다. 시간표
               * 탭에 내려놓고 한 줄로 이유를 말한다.
               */
              toast.success(
                `${rows.length}명을 등록했습니다. 이제 시간표를 짜 두면 홈의 '지금' 카드가 켜집니다.`,
              );
              void navigate('/settings?tab=timetable');
            }}
          />

          <div className="mt-4 flex justify-between border-t border-slate-100 pt-4">
            <Button icon={ArrowLeft} onClick={() => setStep('class')}>
              이전
            </Button>
            <Button variant="ghost" onClick={() => void navigate('/')}>
              명단은 나중에 등록하기
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
