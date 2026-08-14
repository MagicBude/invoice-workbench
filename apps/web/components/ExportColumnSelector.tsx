'use client';

import { useEffect, useState } from 'react';
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

const PANEL_STORAGE_KEY = 'invoice-workbench.field-panel.expanded.v1';

interface Props {
  selected: InvoiceExportKey[];
  onChange: (keys: InvoiceExportKey[]) => void;
}

export function ExportColumnSelector({ selected, onChange }: Props) {
  const selectedSet = new Set(selected);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(PANEL_STORAGE_KEY) === 'true');
    } catch {
      // NOTE: 浏览器禁用 localStorage 时保持默认收起即可，不影响字段选择功能。
    }
  }, []);

  const updateExpanded = (next: boolean) => {
    setExpanded(next);
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, String(next));
    } catch {
      // NOTE: UI 偏好保存失败不应阻断主流程。
    }
  };

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
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className={`flex flex-wrap items-center justify-between gap-3 ${expanded ? 'mb-4' : ''}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">显示与导出字段</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
              {selected.length} / {EXPORT_FIELDS.length} 列
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {expanded
              ? '勾选后会立即显示在结果表格，并同步用于 Excel / CSV 导出。'
              : '字段设置已收起；当前勾选会同时控制结果表格和导出列。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateExpanded(!expanded)}
            aria-expanded={expanded}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
          >
            {expanded ? '收起设置' : '展开设置'}
          </button>
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

      {expanded ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <p className="mt-3 text-xs text-slate-400">
            至少保留 1 个字段；结果表格、Excel 与 CSV 共用同一套字段设置。
          </p>
        </>
      ) : null}
    </section>
  );
}
