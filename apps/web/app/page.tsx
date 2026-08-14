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
import { RecordWorkbenchToolbar } from '../components/RecordWorkbenchToolbar';
import { UploadPanel } from '../components/UploadPanel';
import { exportCsv, exportXlsx } from '../lib/export';
import { extractPdfText, PdfTextExtractionError } from '../lib/pdf';
import {
  filterAndSortRecords,
  needsAttention,
  type RecordFilter,
  type RecordSort
} from '../lib/record-view';

const EXPORT_STORAGE_KEY = 'invoice-workbench.export-columns.v1';
const RESULT_RENDER_BATCH_SIZE = 8;

type ExportScope = 'all' | 'filtered';

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

const FILTER_CARDS: Array<{
  key: RecordFilter;
  label: string;
  description: string;
}> = [
  { key: 'all', label: '全部', description: '当前批次全部记录' },
  { key: 'success', label: '自动成功', description: '解析器自动判定成功' },
  { key: 'review', label: '待复核', description: '尚未人工确认的待复核记录' },
  { key: 'confirmed', label: '人工已确认', description: '已经人工核对确认' },
  { key: 'failed', label: '处理失败', description: '未能完成有效解析' },
  { key: 'duplicate', label: '重复记录', description: '发票号码重复' },
  { key: 'amountInvalid', label: '金额异常', description: '金额关系校验异常' }
];

export default function HomePage() {
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [selectedExportKeys, setSelectedExportKeys] = useState<InvoiceExportKey[]>(DEFAULT_EXPORT_KEYS);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<ProcessingProgressValue | null>(null);
  const [sourceFiles, setSourceFiles] = useState<Map<string, File>>(() => new Map());
  const [reviewRecordId, setReviewRecordId] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all');
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSort, setRecordSort] = useState<RecordSort>('original');
  const [exportScope, setExportScope] = useState<ExportScope>('all');

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
      all: records.length,
      success: records.filter((record) => record.parseStatus === 'success').length,
      review: records.filter(
        (record) => record.parseStatus === 'review' && record.manualReviewStatus !== 'confirmed'
      ).length,
      confirmed: records.filter((record) => record.manualReviewStatus === 'confirmed').length,
      failed: records.filter((record) => record.parseStatus === 'failed').length,
      duplicate: records.filter((record) => record.duplicateStatus === 'duplicate').length,
      amountInvalid: records.filter((record) => record.amountValidation === 'invalid').length
    };
  }, [records]);

  const visibleRecords = useMemo(
    () =>
      filterAndSortRecords(records, {
        filter: recordFilter,
        search: recordSearch,
        sort: recordSort
      }),
    [records, recordFilter, recordSearch, recordSort]
  );

  const exportRecords = exportScope === 'filtered' ? visibleRecords : records;

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

    // 批量文件较多时，如果每解析一张就立即重算全部重复状态并复制完整 Map，
    // 会让渲染和数组扫描次数快速增加。这里先按小批次刷新界面，整个批次结束后
    // 再统一执行一次重复检测，既保留进度反馈，也降低几百张发票时的额外开销。
    let pendingRecords: InvoiceRecord[] = [];
    let pendingFiles = new Map<string, File>();

    const flushPendingResults = () => {
      if (pendingRecords.length === 0) return;

      const recordsToAppend = pendingRecords;
      const filesToAppend = pendingFiles;
      pendingRecords = [];
      pendingFiles = new Map();

      setRecords((current) => [...current, ...recordsToAppend]);
      setSourceFiles((current) => {
        const next = new Map(current);
        for (const [id, file] of filesToAppend) next.set(id, file);
        return next;
      });
    };

    try {
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

        pendingRecords.push(record);
        pendingFiles.set(record.id, file);

        if (pendingRecords.length >= RESULT_RENDER_BATCH_SIZE || index === files.length - 1) {
          flushPendingResults();
        }

        const completed = index + 1;
        batchProgress = incrementProgress(batchProgress, record, completed, files[completed]?.name ?? '');
        setProgress(batchProgress);
      }

      // React 的函数式 setState 会按入队顺序执行，因此这里会在最后一次 append 之后
      // 对完整 records 统一计算重复状态。
      setRecords((current) => markDuplicateRecords(current));
    } finally {
      setBusy(false);
    }
  };

  const updateRecord = (id: string, patch: Partial<InvoiceRecord>) => {
    setRecords((current) => {
      const updated = current.map((record) => {
        if (record.id !== id) return record;

        const next = { ...record, ...patch };
        const patchKeys = Object.keys(patch);
        const onlyManualReviewChanged =
          patchKeys.length === 1 && patchKeys[0] === 'manualReviewStatus';

        // “人工确认”是独立于自动解析状态的人工结论。单纯点击确认时，不能顺手把
        // parseStatus 从“待复核”改成“成功”，否则会丢失解析器最初给出的风险判断。
        if (onlyManualReviewChanged) return next;

        // 人工确认代表“我已经核过当前这份数据”。一旦用户之后再次编辑字段，
        // 原确认结果就应该失效，需要重新确认当前修改后的内容。
        next.manualReviewStatus = 'pending';

        next.amountValidation = validateAmountRelation(
          next.amountExcludingTax,
          next.taxAmount,
          next.amountIncludingTax
        );
        next.confidence = calculateConfidence(next);
        const stillRequiresManualReview = next.validationMessages.some((message) =>
          ['AMOUNT_HEURISTIC_USED', 'FILENAME_AMOUNT_MISMATCH'].includes(message)
        );
        next.parseStatus =
          next.confidence >= 0.75 &&
          next.amountValidation !== 'invalid' &&
          !stillRequiresManualReview
            ? 'success'
            : 'review';
        return next;
      });
      return markDuplicateRecords(updated);
    });
  };

  const toggleConfirmed = (id: string) => {
    const record = records.find((item) => item.id === id);
    if (!record || record.parseStatus === 'failed') return;
    updateRecord(id, {
      manualReviewStatus: record.manualReviewStatus === 'confirmed' ? 'pending' : 'confirmed'
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
      setRecordFilter('all');
      setRecordSearch('');
      setRecordSort('original');
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

  const findAttentionIndex = (direction: -1 | 1): number => {
    if (reviewIndex < 0) return -1;
    for (
      let index = reviewIndex + direction;
      index >= 0 && index < records.length;
      index += direction
    ) {
      if (needsAttention(records[index]!)) return index;
    }
    return -1;
  };

  const previousAttentionIndex = findAttentionIndex(-1);
  const nextAttentionIndex = findAttentionIndex(1);

  const resetRecordView = () => {
    setRecordFilter('all');
    setRecordSearch('');
    setRecordSort('original');
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

      <div className="space-y-4">
        <UploadPanel
          busy={busy}
          compact={records.length > 0 || busy}
          onFiles={handleFiles}
          onRejectedFiles={handleRejectedFiles}
        />

        {notice ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600" role="status">
            {notice}
          </div>
        ) : null}

        <ProcessingProgress busy={busy} value={progress} />

        <section
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
        >
          {FILTER_CARDS.map((card) => {
            const active = recordFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setRecordFilter(card.key)}
                aria-pressed={active}
                className={`min-h-[76px] rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                  active
                    ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
                title={card.description}
              >
                <div className={`text-sm ${active ? 'font-medium text-emerald-800' : 'text-slate-500'}`}>
                  {card.label}
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                  {stats[card.key]}
                </div>
              </button>
            );
          })}
        </section>

        <RecordWorkbenchToolbar
          search={recordSearch}
          filter={recordFilter}
          sort={recordSort}
          visibleCount={visibleRecords.length}
          totalCount={records.length}
          onSearchChange={setRecordSearch}
          onSortChange={setRecordSort}
          onReset={resetRecordView}
        />

        <ExportColumnSelector selected={selectedExportKeys} onChange={setSelectedExportKeys} />

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="mr-1 flex items-center rounded-xl bg-slate-100 p-1" aria-label="导出范围">
            <button
              type="button"
              onClick={() => setExportScope('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                exportScope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              全部 {records.length}
            </button>
            <button
              type="button"
              onClick={() => setExportScope('filtered')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                exportScope === 'filtered' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              当前筛选 {visibleRecords.length}
            </button>
          </div>
          <button
            type="button"
            disabled={!exportRecords.length || !selectedExportKeys.length || busy}
            onClick={() => exportXlsx(exportRecords, selectedExportKeys)}
            className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            导出 Excel
          </button>
          <button
            type="button"
            disabled={!exportRecords.length || !selectedExportKeys.length || busy}
            onClick={() => exportCsv(exportRecords, selectedExportKeys)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            导出 CSV
          </button>
          <span className="text-xs text-slate-400">
            将导出 {exportRecords.length} 条记录；当前筛选和排序不会修改原始数据。
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={clearAll}
            className="ml-auto rounded-xl border border-transparent px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清空列表
          </button>
        </section>

        <InvoiceTable
          records={visibleRecords}
          totalRecordCount={records.length}
          selectedKeys={selectedExportKeys}
          onChange={updateRecord}
          onDelete={deleteRecord}
          onReview={setReviewRecordId}
          onToggleConfirmed={toggleConfirmed}
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
          onPreviousAttention={() => {
            if (previousAttentionIndex >= 0) setReviewRecordId(records[previousAttentionIndex]!.id);
          }}
          onNextAttention={() => {
            if (nextAttentionIndex >= 0) setReviewRecordId(records[nextAttentionIndex]!.id);
          }}
          hasPreviousAttention={previousAttentionIndex >= 0}
          hasNextAttention={nextAttentionIndex >= 0}
          onToggleConfirmed={() => toggleConfirmed(reviewRecord.id)}
        />
      ) : null}

      <footer className="py-8 text-center text-xs text-slate-400">本地优先 · PDF.js · 规则优先 · 静态导出</footer>
    </main>
  );
}
