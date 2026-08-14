'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_EXPORT_KEYS,
  sanitizeExportKeys,
  calculateConfidence,
  markDuplicateRecords,
  parseInvoiceText,
  validateAmountRelation,
  type InvoiceExportKey,
  type InvoiceRecord
} from '@invoice-workbench/invoice-core';
import { ExportColumnSelector } from '../components/ExportColumnSelector';
import { InvoiceReviewPanel } from '../components/InvoiceReviewPanel';
import { InvoiceTable } from '../components/InvoiceTable';
import { ProcessingProgress, type ProcessingProgressValue } from '../components/ProcessingProgress';
import { UploadPanel } from '../components/UploadPanel';
import { exportCsv, exportXlsx } from '../lib/export';
import { extractPdfText, PdfTextExtractionError } from '../lib/pdf';

const EXPORT_STORAGE_KEY = 'invoice-workbench.export-columns.v1';

function createFailedRecord(fileName: string, error: unknown): InvoiceRecord {
  const record = parseInvoiceText({ sourceFileName: fileName, text: '' });
  record.parseStatus = 'failed';
  record.remark =
    error instanceof PdfTextExtractionError
      ? error.message
      : error instanceof Error
        ? `PDF 读取失败：${error.message}`
        : 'PDF 读取失败。';
  return record;
}

function incrementProgress(
  current: ProcessingProgressValue,
  record: InvoiceRecord,
  completed: number,
  nextFileName: string
): ProcessingProgressValue {
  return {
    ...current,
    completed,
    currentFileName: nextFileName,
    success: current.success + (record.parseStatus === 'success' ? 1 : 0),
    review: current.review + (record.parseStatus === 'review' ? 1 : 0),
    failed: current.failed + (record.parseStatus === 'failed' ? 1 : 0)
  };
}

export default function HomePage() {
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [selectedExportKeys, setSelectedExportKeys] = useState<InvoiceExportKey[]>(DEFAULT_EXPORT_KEYS);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<ProcessingProgressValue | null>(null);
  const [sourceFiles, setSourceFiles] = useState<Map<string, File>>(() => new Map());
  const [reviewRecordId, setReviewRecordId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXPORT_STORAGE_KEY);
      if (saved) setSelectedExportKeys(sanitizeExportKeys(JSON.parse(saved)));
    } catch {
      // NOTE: 隐私模式或浏览器策略可能禁用 localStorage，此时继续使用默认导出列即可。
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify(selectedExportKeys));
    } catch {
      // NOTE: 保存偏好失败不应阻断发票主流程。
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

  const handleRejectedFiles = (files: File[]) => {
    if (files.length === 0) {
      setNotice('');
      return;
    }

    const preview = files
      .slice(0, 3)
      .map((file) => file.name)
      .join('、');
    const more = files.length > 3 ? ` 等 ${files.length} 个文件` : '';
    setNotice(`已忽略非 PDF 文件：${preview}${more}`);
  };

  const handleFiles = async (files: File[]) => {
    if (busy || files.length === 0) return;

    setBusy(true);

    let batchProgress: ProcessingProgressValue = {
      total: files.length,
      completed: 0,
      currentFileName: files[0]?.name ?? '',
      success: 0,
      review: 0,
      failed: 0
    };
    setProgress(batchProgress);

    try {
      // 批量导入采用顺序处理：发票通常只有少量页面，顺序处理可以控制内存峰值，
      // 同时让界面逐张展示结果，单个文件失败也不会中断整个批次。
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        let record: InvoiceRecord;

        try {
          const extraction = await extractPdfText(file);
          record = parseInvoiceText({ sourceFileName: file.name, text: extraction.text });

          if (!extraction.hasUsableTextLayer && record.parseStatus === 'failed') {
            record.remark = `未检测到足够的 PDF 文本层（${extraction.textPageCount}/${extraction.pageCount} 页包含文本），可能是扫描件或图片 PDF。`;
          }
        } catch (error) {
          record = createFailedRecord(file.name, error);
        }

        // 只在浏览器内存中保存 File 引用，供后续“单张复核”预览原始 PDF。
        // File 不会因为放进 React State 而自动上传；刷新页面后这些临时引用也会自然消失。
        setSourceFiles((current) => {
          const next = new Map(current);
          next.set(record.id, file);
          return next;
        });

        // 每处理完一张就写入 State，而不是等整批结束才更新。
        // 这样处理大批量文件时，用户可以立即看到已经完成的部分结果。
        setRecords((current) => markDuplicateRecords([...current, record]));

        const completed = index + 1;
        batchProgress = incrementProgress(batchProgress, record, completed, files[completed]?.name ?? '');
        setProgress(batchProgress);
      }

    } finally {
      setBusy(false);
    }
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
    setSourceFiles((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    if (reviewRecordId === id) setReviewRecordId(null);
  };

  const clearAll = () => {
    if (!records.length || window.confirm('确定清空当前解析结果？')) {
      setRecords([]);
      setSourceFiles(new Map());
      setReviewRecordId(null);
      setProgress(null);
      setNotice('');
    }
  };

  const reviewIndex = reviewRecordId
    ? records.findIndex((record) => record.id === reviewRecordId)
    : -1;
  const reviewRecord = reviewIndex >= 0 ? records[reviewIndex] : undefined;
  const reviewFile = reviewRecord ? sourceFiles.get(reviewRecord.id) : undefined;

  const openAdjacentReview = (offset: number) => {
    const next = records[reviewIndex + offset];
    if (next) setReviewRecordId(next.id);
  };

  return (
    <main className="mx-auto w-[96vw] max-w-[1680px] px-3 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              v0.1 · 本地优先
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Invoice Workbench</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              批量读取 PDF 发票文本层，提取结构化字段、校验异常，并按你选择的列导出 Excel / CSV。
            </p>
          </div>
          <div className="text-right text-xs leading-5 text-slate-400">
            <div>默认不上传原始 PDF</div>
            <div>当前优先支持带文本层的电子 PDF</div>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        <UploadPanel busy={busy} onFiles={handleFiles} onRejectedFiles={handleRejectedFiles} />

        {notice ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600" role="status">
            {notice}
          </div>
        ) : null}

        <ProcessingProgress busy={busy} value={progress} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['识别成功', stats.success],
            ['待复核', stats.review],
            ['处理失败', stats.failed],
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
            disabled={!records.length || !selectedExportKeys.length || busy}
            onClick={() => exportXlsx(records, selectedExportKeys)}
            className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            导出 Excel
          </button>
          <button
            type="button"
            disabled={!records.length || !selectedExportKeys.length || busy}
            onClick={() => exportCsv(records, selectedExportKeys)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            导出 CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clearAll}
            className="rounded-xl border border-transparent px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清空列表
          </button>
        </section>

        <InvoiceTable
          records={records}
          selectedKeys={selectedExportKeys}
          onChange={updateRecord}
          onDelete={deleteRecord}
          onReview={setReviewRecordId}
        />
      </div>

      {reviewRecord ? (
        <InvoiceReviewPanel
          record={reviewRecord}
          file={reviewFile}
          index={reviewIndex}
          total={records.length}
          onChange={updateRecord}
          onClose={() => setReviewRecordId(null)}
          onPrevious={() => openAdjacentReview(-1)}
          onNext={() => openAdjacentReview(1)}
        />
      ) : null}

      <footer className="py-8 text-center text-xs text-slate-400">本地优先 · PDF.js · 规则优先 · 静态导出</footer>
    </main>
  );
}
