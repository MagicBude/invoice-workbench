'use client';

import type { InvoiceRecord } from '@invoice-workbench/invoice-core';

interface Props {
  records: InvoiceRecord[];
  onChange: (id: string, patch: Partial<InvoiceRecord>) => void;
  onDelete: (id: string) => void;
}

const editableColumns: Array<{
  key: keyof InvoiceRecord;
  label: string;
  width: string;
  numeric?: boolean;
}> = [
  { key: 'fileDate', label: '日期', width: 'min-w-32' },
  { key: 'fileDisplayName', label: '名称', width: 'min-w-44' },
  { key: 'invoiceNumber', label: '发票号码', width: 'min-w-48' },
  { key: 'amountExcludingTax', label: '不含税金额', width: 'min-w-32', numeric: true },
  { key: 'taxAmount', label: '税额', width: 'min-w-28', numeric: true },
  { key: 'amountIncludingTax', label: '价税合计', width: 'min-w-32', numeric: true },
  { key: 'issueDate', label: '开票日期', width: 'min-w-32' },
  { key: 'remark', label: '备注', width: 'min-w-56' }
];

function statusClass(status: InvoiceRecord['parseStatus']) {
  if (status === 'success') return 'bg-emerald-50 text-emerald-700';
  if (status === 'failed') return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

function statusLabel(status: InvoiceRecord['parseStatus']): string {
  if (status === 'success') return '成功';
  if (status === 'failed') return '失败';
  return '待复核';
}

export function InvoiceTable({ records, onChange, onDelete }: Props) {
  const total = records.reduce((sum, record) => sum + (Number(record.amountIncludingTax) || 0), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">解析结果</h2>
          <p className="mt-1 text-sm text-slate-500">结果可直接修改。单个文件失败不会影响整个批次。</p>
        </div>
        <div className="text-sm text-slate-600">
          共 <b>{records.length}</b> 条 · 价税合计 <b>{total.toFixed(2)}</b> 元
        </div>
      </div>

      {records.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-slate-400">还没有数据，先添加 PDF 文件。</div>
      ) : (
        <div className="max-h-[calc(100vh-16rem)] overflow-auto overscroll-contain">
          {/*
            表格使用独立滚动容器，而不是让整个页面随着发票数量无限增长。
            这样即使有几百条记录，横向滚动条也始终位于当前表格工作区底部。
          */}
          <table className="w-full min-w-[1400px] border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-600">
              <tr>
                <th className="sticky left-0 top-0 z-40 w-14 min-w-[3.5rem] bg-slate-100 px-3 py-3 text-center font-semibold">
                  #
                </th>
                <th className="sticky left-14 top-0 z-40 w-60 min-w-60 border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold shadow-[6px_0_8px_-8px_rgba(15,23,42,0.35)]">
                  PDF文件名
                </th>
                {editableColumns.map((column) => (
                  <th key={column.key} className={`${column.width} px-3 py-3 text-left font-semibold`}>
                    {column.label}
                  </th>
                ))}
                <th className="min-w-28 px-3 py-3 text-center font-semibold">状态</th>
                <th className="min-w-20 whitespace-nowrap px-3 py-3 text-center font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr
                  key={record.id}
                  className="group border-t border-slate-100 align-top hover:bg-slate-50/80"
                >
                  <td className="sticky left-0 z-10 w-14 min-w-[3.5rem] bg-white px-3 py-2 text-center text-slate-400 group-hover:bg-slate-50">
                    {index + 1}
                  </td>
                  <td className="sticky left-14 z-10 w-60 min-w-60 border-r border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.35)] group-hover:bg-slate-50">
                    <span className="block break-words" title={record.sourceFileName}>
                      {record.sourceFileName}
                    </span>
                  </td>
                  {editableColumns.map((column) => (
                    <td key={column.key} className="px-2 py-2">
                      <input
                        value={String(record[column.key] ?? '')}
                        inputMode={column.numeric ? 'decimal' : undefined}
                        onChange={(event) =>
                          onChange(record.id, { [column.key]: event.target.value } as Partial<InvoiceRecord>)
                        }
                        className={`w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white ${
                          column.numeric ? 'text-right tabular-nums' : ''
                        }`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(record.parseStatus)}`}>
                      {statusLabel(record.parseStatus)}
                    </span>
                    {record.duplicateStatus === 'duplicate' ? (
                      <div className="mt-1 text-xs font-medium text-rose-600">发票号重复</div>
                    ) : null}
                    {record.amountValidation === 'invalid' ? (
                      <div className="mt-1 text-xs font-medium text-rose-600">金额异常</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onDelete(record.id)}
                      className="rounded-lg px-2 py-1 text-rose-600 hover:bg-rose-50"
                      aria-label={`删除 ${record.sourceFileName}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
