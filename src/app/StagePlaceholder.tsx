import { Construction } from 'lucide-react';

interface Props {
  title: string;
  /** 설계 문서 §14의 작업 단계 번호 */
  stage: number;
  /** 이 화면이 이식해 올 원본 저장소 */
  source?: string;
}

/**
 * 아직 이식하지 않은 화면의 자리표시자.
 *
 * 단계별로 하나씩 실제 화면으로 교체된다.
 * 자리표시자를 남겨 두면 라우팅·레이아웃을 기능 이식 전에 검증할 수 있다.
 */
export function StagePlaceholder({ title, stage, source }: Props) {
  return (
    <section className="rounded-card border border-dashed border-slate-300 bg-surface p-8">
      <div className="flex items-start gap-3">
        <Construction className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden />
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {stage}단계에서 구현합니다.
            {source ? ` 원본: ${source}` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
