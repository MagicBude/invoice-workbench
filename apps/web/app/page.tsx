'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_EXPORT_KEYS,
  calculateConfidence,
  markDuplicateRecords,
  parseInvoiceText,
  validateAmountRelation,
  type InvoiceExportKey,
  type InvoiceRecord
} from '@invoice-workbench/invoice-core';
import { ExportColumnSelector } from '../components/ExportColumnSelector';
import { InvoiceTable } from '../components/InvoiceTable';
import { UploadPanel } from '../components/UploadPanel';
import { exportCsv, exportXlsx } from '../lib/export';
import { extractPdfText } from '../lib/pdf';

const EXPORT_STORAGE_KEY = 'invoice-workbench.export-columns.v1';

export default function HomePage() {
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [selectedExportKeys, setSelectedExportKeys] = useState<InvoiceExportKey[]>(DEFAULT_EXPORT_KEYS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXPORT_STORAGE_KEY);
      if (saved) setSelectedExportKeys(JSON.parse(saved) as InvoiceExportKey[]);
    } catch {
      // Ignore invalid local preference data.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify(selectedExportKeys));
    } catch {
      // localStorage may be unavailable in privacy-restricted environments.
    }
  }, [selectedExportKeys]);

  const stats = useMemo(() => {
    return {
      success: records.filter((record) => record.parseStatus === 'success').length,
      review: records.filter((record) => record.parseStatus === 'review').length,
      failed: records.filter((record) => record.parseStatus === 'failed').length,
      duplicate: records.filter((record) => record.duplicateStatus === 'duplicate').length
    };
  }, [records]);

  const handleFiles = async (files: File[]) => {
    setBusy(true);
    setStatus(`正在解析 ${files.length} 个 PDF…`);

    const next: InvoiceRecord[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!;
      setStatus(`正在解析 ${index + 1}/${files.length}：${file.name}`);

      try {
        const text = await extractPdfText(file);
        next.push(parseInvoiceText({ sourceFileName: file.name, text }));
      } catch (error) {
        next.push(
          parseInvoiceText({
            sourceFileName: file.name,
            text: ''
          })
        );
        const current = next[next.length - 1]!;
        current.remark = `PDF 读取失败：${error instanceof Error ? error.message : String(error)}`;
      }
    }

    setRecords((current) => markDuplicateRecords([...current, ...next]));
    setStatus(`完成：本批次处理 ${files.length} 个 PDF。`);
    setBusy(false);
  };

  const updateRecord = (id: string, patch: Partial<InvoiceRecord>) => {
    setRecords((current) => {
      const updated = current.map((record) => {
        if (record.id !== id) return record;

        const next = { ...record, ...patch };
        next.amountValidation = validateAmountRelation(
          next.amountExcludingTax,
          next.taxAmount,
          next.amountIncludingTax
        );
        next.confidence = calculateConfidence(next);
        next.parseStatus = next.confidence >= 0.75 && next.amountValidation !== 'invalid' ? 'success' : 'review';
        return next;
      });
      return markDuplicateRecords(updated);
    });
  };

  const deleteRecord = (id: string) => {
    setRecords((current) => markDuplicateRecords(current.filter((record) => record.id !== id)));
  };

  const clearAll = () => {
    if (!records.length || window.confirm('确定清空当前解析结果？')) {
      setRecords([]);
      setStatus('');
    }
  };

  return (
    <main className="mx-auto w-[96vw] max-w-[1680px] px-3 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              v0.1 · 本地优先基础版本
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Invoice Workbench</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              批量读取 PDF 发票文本层，提取结构化字段、校验异常，并按你选择的列导出 Excel / CSV。
            </p>
          </div>
          <div className="text-right text-xs leading-5 text-slate-400">
            <div>默认不上传原始 PDF</div>
            <div>扫描件 OCR 将在后续版本提供</div>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        <UploadPanel busy={busy} onFiles={handleFiles} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['识别成功', stats.success],
            ['待复核', stats.review],
            ['读取失败', stats.failed],
            ['重复记录', stats.duplicate]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="text-sm text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
            </div>
          ))}
        </section>

        <ExportColumnSelector selected={selectedExportKeys} onChange={setSelectedExportKeys} />

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            disabled={!records.length || !selectedExportKeys.length}
            onClick={() => exportXlsx(records, selectedExportKeys)}
            className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            导出 Excel
          </button>
          <button
            type="button"
            disabled={!records.length || !selectedExportKeys.length}
            onClick={() => exportCsv(records, selectedExportKeys)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            导出 CSV
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-xl border border-transparent px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            清空列表
          </button>
          <span className="ml-auto text-sm text-slate-500">{status}</span>
        </section>

        <InvoiceTable records={records} onChange={updateRecord} onDelete={deleteRecord} />
      </div>

      <footer className="py-8 text-center text-xs text-slate-400">
        本地优先 · PDF.js · 规则优先 · 静态导出
      </footer>
    </main>
  );
}
