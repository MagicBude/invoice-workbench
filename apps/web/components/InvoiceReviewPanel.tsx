'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  EXPORT_FIELDS,
  type ExportFieldDefinition,
  type InvoiceExportKey,
  type InvoiceRecord
} from '@invoice-workbench/invoice-core';

interface Props {
  record: InvoiceRecord;
  file?: File;
  index: number;
  total: number;
  onChange: (id: string, patch: Partial<InvoiceRecord>) => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const GROUPS: Array<{
  key: ExportFieldDefinition['group'];
  label: string;
}> = [
  { key: 'file', label: '文件信息' },
  { key: 'invoice', label: '发票信息' },
  { key: 'party', label: '购销方信息' },
  { key: 'amount', label: '金额信息' },
  { key: 'business', label: '业务信息' },
  { key: 'quality', label: '质量与校验' }
];

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

function statusClass(field: InvoiceExportKey, value: unknown): string {
  if (field === 'parseStatus') {
    if (value === 'success') return 'bg-emerald-50 text-emerald-700';
    if (value === 'failed') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
  }

  if (field === 'duplicateStatus' && value === 'duplicate') {
    return 'bg-rose-50 text-rose-700';
  }

  if (field === 'amountValidation') {
    if (value === 'valid') return 'bg-emerald-50 text-emerald-700';
    if (value === 'invalid') return 'bg-rose-50 text-rose-700';
  }

  return 'bg-slate-100 text-slate-600';
}

function FieldEditor({
  record,
  field,
  onChange
}: {
  record: InvoiceRecord;
  field: ExportFieldDefinition;
  onChange: Props['onChange'];
}) {
  const value = record[field.key];

  if (!field.editable) {
    const label = readonlyLabel(field.key, value);
    return (
      <div className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {field.type === 'status' ? (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(field.key, value)}`}
          >
            {label}
          </span>
        ) : (
          label || <span className="text-slate-400">—</span>
        )}
      </div>
    );
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  if (field.key === 'remark' || field.key === 'itemName') {
    return (
      <textarea
        rows={field.key === 'remark' ? 3 : 2}
        value={String(value ?? '')}
        onChange={(event) =>
          onChange(record.id, { [field.key]: event.target.value } as Partial<InvoiceRecord>)
        }
        className={`${inputClass} resize-y`}
      />
    );
  }

  return (
    <input
      value={String(value ?? '')}
      inputMode={field.type === 'currency' || field.type === 'number' ? 'decimal' : undefined}
      onChange={(event) =>
        onChange(record.id, { [field.key]: event.target.value } as Partial<InvoiceRecord>)
      }
      className={`${inputClass} ${
        field.type === 'currency' || field.type === 'number' ? 'text-right tabular-nums' : ''
      }`}
    />
  );
}

/**
 * 单张发票复核面板。
 *
 * PDF 预览使用浏览器 Object URL：只有当前打开复核的 File 会创建临时 URL，
 * 切换发票或关闭面板时立即 revoke，避免批量文件长期占用额外浏览器资源。
 * 这个过程仍然完全发生在本地，不会把 PDF 上传到服务器。
 */
export function InvoiceReviewPanel({
  record,
  file,
  index,
  total,
  onChange,
  onClose,
  onPrevious,
  onNext
}: Props) {
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPdfUrl('');
      return;
    }

    const url = URL.createObjectURL(file);
    setPdfUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    // 模态复核面板打开时锁住页面背景滚动，避免滚轮同时带动后面的长表格。
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const groupedFields = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        fields: EXPORT_FIELDS.filter(
          (field) => field.group === group.key && field.key !== 'sourceFileName'
        )
      })),
    []
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 p-3 backdrop-blur-[1px] sm:p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`复核 ${record.sourceFileName}`}
        className="mx-auto flex h-full w-full max-w-[1680px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="text-xs text-slate-400">
              第 {index + 1} / {total} 张
            </div>
            <h2 className="truncate text-base font-semibold text-slate-900" title={record.sourceFileName}>
              {record.sourceFileName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              disabled={index <= 0}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一张
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={index >= total - 1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一张
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              关闭
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
          <div className="min-h-[42vh] border-b border-slate-200 bg-slate-100 lg:min-h-0 lg:border-b-0 lg:border-r">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title={`PDF 预览：${record.sourceFileName}`}
                className="h-full min-h-[42vh] w-full bg-white lg:min-h-0"
              />
            ) : (
              <div className="flex h-full min-h-[42vh] items-center justify-center p-8 text-center text-sm text-slate-500 lg:min-h-0">
                当前记录没有可用的本地 PDF 文件，仍可在右侧复核和修改字段。
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto bg-white p-4 sm:p-5">
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass('parseStatus', record.parseStatus)}`}>
                  {readonlyLabel('parseStatus', record.parseStatus)}
                </span>
                <span className="text-slate-500">置信度 {readonlyLabel('confidence', record.confidence)}</span>
                <span className="text-slate-500">金额校验：{readonlyLabel('amountValidation', record.amountValidation)}</span>
                <span className="text-slate-500">重复：{readonlyLabel('duplicateStatus', record.duplicateStatus)}</span>
              </div>

              {record.validationMessages.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-700">
                  {record.validationMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-6">
              {groupedFields.map((group) => (
                <section key={group.key}>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">{group.label}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <label
                        key={field.key}
                        className={field.key === 'remark' || field.key === 'itemName' ? 'sm:col-span-2' : ''}
                      >
                        <span className="mb-1.5 block text-xs font-medium text-slate-500">{field.label}</span>
                        <FieldEditor record={record} field={field} onChange={onChange} />
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
