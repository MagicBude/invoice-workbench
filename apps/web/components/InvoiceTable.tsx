'use client';

import {
  EXPORT_FIELDS,
  type ExportFieldDefinition,
  type InvoiceExportKey,
  type InvoiceRecord
} from '@invoice-workbench/invoice-core';

interface Props {
  records: InvoiceRecord[];
  selectedKeys: InvoiceExportKey[];
  onChange: (id: string, patch: Partial<InvoiceRecord>) => void;
  onDelete: (id: string) => void;
  onReview: (id: string) => void;
}

const COLUMN_WIDTHS: Record<InvoiceExportKey, number> = {
  sourceFileName: 240,
  fileDate: 128,
  fileDisplayName: 176,
  invoiceType: 176,
  invoiceNumber: 192,
  issueDate: 128,
  sellerName: 224,
  sellerTaxId: 208,
  buyerName: 224,
  buyerTaxId: 208,
  amountExcludingTax: 128,
  taxAmount: 112,
  amountIncludingTax: 128,
  taxRate: 112,
  itemName: 256,
  remark: 224,
  parseStatus: 112,
  confidence: 112,
  duplicateStatus: 112,
  amountValidation: 112
};

function statusClass(field: InvoiceExportKey, value: unknown): string {
  if (field === 'parseStatus') {
    if (value === 'success') return 'bg-emerald-50 text-emerald-700';
    if (value === 'failed') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
  }

  if (field === 'duplicateStatus') {
    return value === 'duplicate' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600';
  }

  if (field === 'amountValidation') {
    if (value === 'valid') return 'bg-emerald-50 text-emerald-700';
    if (value === 'invalid') return 'bg-rose-50 text-rose-700';
    return 'bg-slate-100 text-slate-600';
  }

  return 'bg-slate-100 text-slate-600';
}

function readonlyLabel(field: InvoiceExportKey, value: unknown): string {
  if (field === 'parseStatus') {
    if (value === 'success') return '成功';
    if (value === 'failed') return '失败';
    return '待复核';
  }

  if (field === 'duplicateStatus') {
    if (value === 'duplicate') return '重复';
    if (value === 'unique') return '未重复';
    return '未知';
  }

  if (field === 'amountValidation') {
    if (value === 'valid') return '通过';
    if (value === 'invalid') return '异常';
    return '无法校验';
  }

  if (field === 'confidence') {
    return value == null || value === '' ? '' : `${Math.round(Number(value) * 100)}%`;
  }

  return value == null ? '' : String(value);
}

function renderCell(
  record: InvoiceRecord,
  field: ExportFieldDefinition,
  onChange: Props['onChange']
) {
  const value = record[field.key];

  if (!field.editable) {
    const label = readonlyLabel(field.key, value);
    if (field.type === 'status') {
      return (
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(field.key, value)}`}>
          {label}
        </span>
      );
    }

    return <span className="text-slate-700">{label}</span>;
  }

  return (
    <input
      value={String(value ?? '')}
      inputMode={field.type === 'currency' || field.type === 'number' ? 'decimal' : undefined}
      onChange={(event) =>
        onChange(record.id, { [field.key]: event.target.value } as Partial<InvoiceRecord>)
      }
      className={`w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white ${
        field.type === 'currency' || field.type === 'number' ? 'text-right tabular-nums' : ''
      }`}
    />
  );
}

/**
 * 结果表格与“显示与导出字段”共用同一份 selectedKeys。
 *
 * 字段勾选只是 React 状态变化：所有发票字段在首次解析时已经保存在 records 中，
 * 因此切换列只会触发表格重新渲染，不会重新读取 PDF，也不需要用户再次拖入文件。
 */
export function InvoiceTable({ records, selectedKeys, onChange, onDelete, onReview }: Props) {
  const total = records.reduce((sum, record) => sum + (Number(record.amountIncludingTax) || 0), 0);
  const selectedSet = new Set(selectedKeys);
  const visibleFields = EXPORT_FIELDS.filter((field) => selectedSet.has(field.key));
  const tableMinWidth =
    56 +
    visibleFields.reduce((sum, field) => sum + COLUMN_WIDTHS[field.key], 0) +
    136;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">解析结果</h2>
          <p className="mt-1 text-sm text-slate-500">
            上方勾选的字段会立即显示在这里；修改字段后导出也会使用最新数据。
          </p>
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
            表格使用独立滚动容器。字段变化时只改变列，不重新解析 PDF。
            序号始终固定；PDF 文件名只有在用户勾选该字段时才显示并固定在左侧。
          */}
          <table className="w-full border-collapse text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-600">
              <tr>
                <th className="sticky left-0 top-0 z-40 w-14 min-w-[3.5rem] bg-slate-100 px-3 py-3 text-center font-semibold">
                  #
                </th>
                {visibleFields.map((field) => {
                  const isFileName = field.key === 'sourceFileName';
                  return (
                    <th
                      key={field.key}
                      style={{ minWidth: `${COLUMN_WIDTHS[field.key]}px` }}
                      className={`${
                        isFileName
                          ? 'sticky left-14 top-0 z-40 border-r border-slate-200 bg-slate-100 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.35)]'
                          : ''
                      } px-3 py-3 text-left font-semibold`}
                    >
                      {field.label}
                    </th>
                  );
                })}
                <th className="min-w-[8.5rem] whitespace-nowrap px-3 py-3 text-center font-semibold">操作</th>
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
                  {visibleFields.map((field) => {
                    const isFileName = field.key === 'sourceFileName';
                    return (
                      <td
                        key={field.key}
                        style={{ minWidth: `${COLUMN_WIDTHS[field.key]}px` }}
                        className={`${
                          isFileName
                            ? 'sticky left-14 z-10 border-r border-slate-200 bg-white shadow-[6px_0_8px_-8px_rgba(15,23,42,0.35)] group-hover:bg-slate-50'
                            : ''
                        } px-2 py-2 ${field.type === 'status' ? 'text-center' : ''}`}
                      >
                        {isFileName ? (
                          <span className="block break-words px-1 py-1.5 text-slate-700" title={record.sourceFileName}>
                            {record.sourceFileName}
                          </span>
                        ) : (
                          renderCell(record, field, onChange)
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onReview(record.id)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        复核
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(record.id)}
                        className="rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                        aria-label={`删除 ${record.sourceFileName}`}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
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
