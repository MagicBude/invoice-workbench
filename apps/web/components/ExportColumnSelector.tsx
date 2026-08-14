'use client';

import {
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
      onChange(selected.filter((item) => item !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">导出列</h2>
          <p className="mt-1 text-sm text-slate-500">
            自定义 Excel / CSV 中需要的字段，选择会保存在当前浏览器。
          </p>
        </div>
        <span className="text-xs text-slate-400">已选择 {selected.length} 列</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(GROUP_LABELS).map(([group, label]) => (
          <div key={group} className="rounded-xl bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
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
    </section>
  );
}
