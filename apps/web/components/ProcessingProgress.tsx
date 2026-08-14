interface ProcessingProgressValue {
  total: number;
  completed: number;
  currentFileName: string;
  success: number;
  review: number;
  failed: number;
}

interface Props {
  busy: boolean;
  value: ProcessingProgressValue | null;
}

export function ProcessingProgress({ busy, value }: Props) {
  if (!value) return null;

  const percentage = value.total === 0 ? 0 : Math.round((value.completed / value.total) * 100);
  const currentNumber = Math.min(value.completed + 1, value.total);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            {busy ? `正在处理 ${currentNumber}/${value.total}` : `本批次已完成 ${value.completed}/${value.total}`}
          </div>
          <div className="mt-1 max-w-3xl truncate text-xs text-slate-500" title={value.currentFileName}>
            {busy && value.currentFileName ? value.currentFileName : '本批次文件已经全部处理完成'}
          </div>
        </div>
        <div className="text-sm font-semibold tabular-nums text-slate-700">{percentage}%</div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-700 transition-[width] duration-200"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>成功 {value.success}</span>
        <span>待复核 {value.review}</span>
        <span>失败 {value.failed}</span>
      </div>
    </section>
  );
}

export type { ProcessingProgressValue };
