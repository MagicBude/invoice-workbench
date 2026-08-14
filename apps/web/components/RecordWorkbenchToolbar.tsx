'use client';

import type { RecordFilter, RecordSort } from '../lib/record-view';

interface Props {
  search: string;
  filter: RecordFilter;
  sort: RecordSort;
  visibleCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onSortChange: (value: RecordSort) => void;
  onReset: () => void;
}

export function RecordWorkbenchToolbar({
  search,
  filter,
  sort,
  visibleCount,
  totalCount,
  onSearchChange,
  onSortChange,
  onReset
}: Props) {
  const hasCondition = Boolean(search.trim()) || filter !== 'all' || sort !== 'original';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto] lg:items-end">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-slate-500">搜索发票</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="文件名、发票号、购销方、项目名称……"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-medium text-slate-500">排序</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as RecordSort)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="original">导入顺序</option>
            <option value="status">待处理优先</option>
            <option value="fileDateDesc">文件日期：新 → 旧</option>
            <option value="fileDateAsc">文件日期：旧 → 新</option>
            <option value="issueDateDesc">开票日期：新 → 旧</option>
            <option value="issueDateAsc">开票日期：旧 → 新</option>
            <option value="amountDesc">价税合计：高 → 低</option>
            <option value="amountAsc">价税合计：低 → 高</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
          <span className="text-sm text-slate-500">
            当前显示 <b className="text-slate-800">{visibleCount}</b> / {totalCount} 条
          </span>
          <button
            type="button"
            disabled={!hasCondition}
            onClick={onReset}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清除条件
          </button>
        </div>
      </div>

      {filter !== 'all' ? (
        <p className="mt-3 text-xs text-slate-400">
          当前状态筛选由上方统计卡片控制；搜索与排序只改变当前视图，不会删除或重新解析发票。
        </p>
      ) : null}
    </section>
  );
}
