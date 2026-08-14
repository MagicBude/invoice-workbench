'use client';

import {
  ALL_EXPORT_KEYS,
  DEFAULT_EXPORT_KEYS,
  EXPORT_FIELDS,
  type InvoiceExportKey
} from '@invoice-workbench/invoice-core';

const GROUP_LABELS = {
  file: '文件信息',
  invoice: '发票信息',
  party: '购销方',
  amount: '金额',
  business: '业务信息',
  quality: '质量与校验'
} as const;

interface Props {
  selected: InvoiceExportKey[];
  onChange: (keys: InvoiceExportKey[]) => void;
}

export function ExportColumnSelector({ selected, onChange }: Props) {
  const selectedSet = new Set(selected);

  const toggle = (key: InvoiceExportKey) => {
    if (selectedSet.has(key)) {
      // 至少保留一列，避免出现“按钮可点但导出文件没有任何字段”的模糊状态。
      if (selected.length === 1) return;
      onChange(selected.filter((item) => item !== key));
    } else {
      const next = new Set([...selected, key]);
      // 统一按字段注册表排序，避免用户勾选顺序影响 Excel / CSV 列顺序。
      onChange(ALL_EXPORT_KEYS.filter((item) => next.has(item)));
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">显示与导出字段</h2>
          <p className="mt-1 text-sm text-slate-500">
            勾选后会立即显示在下方结果表格，并用于 Excel / CSV 导出；无需重新选择 PDF。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-slate-400">已选择 {selected.length} / {EXPORT_FIELDS.length} 列</span>
          <button
            type="button"
            onClick={() => onChange([...ALL_EXPORT_KEYS])}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            全选
          </button>
          <button
            type="button"
            onClick={() => onChange([...DEFAULT_EXPORT_KEYS])}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            恢复默认
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(GROUP_LABELS).map(([group, label]) => (
          <div key={group} className="rounded-xl bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500">{label}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {EXPORT_FIELDS.filter((field) => field.group === group).map((field) => (
                <label key={field.key} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-700"
                    checked={selectedSet.has(field.key)}
                    onChange={() => toggle(field.key)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">至少保留 1 个字段；结果表格、Excel 与 CSV 共用同一套字段设置。</p>
    </section>
  );
}
