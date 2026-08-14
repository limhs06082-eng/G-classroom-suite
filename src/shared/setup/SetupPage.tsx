import { ArrowLeft, ArrowRight, Check, School } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createClassRoom, createTerm } from '../domain/factories';
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

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  const createClass = (): void => {
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
      profile: { ...current.profile, schoolName: schoolName.trim(), teacherName: teacherName.trim() },
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
              toast.success(`${rows.length}명을 등록했습니다. 이제 모든 기능에서 쓸 수 있습니다.`);
              void navigate('/');
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
