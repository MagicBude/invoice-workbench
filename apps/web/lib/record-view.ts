import type { InvoiceRecord } from '@invoice-workbench/invoice-core';

export type RecordFilter =
  | 'all'
  | 'success'
  | 'review'
  | 'confirmed'
  | 'failed'
  | 'duplicate'
  | 'amountInvalid';

export type RecordSort =
  | 'original'
  | 'fileDateDesc'
  | 'fileDateAsc'
  | 'issueDateDesc'
  | 'issueDateAsc'
  | 'amountDesc'
  | 'amountAsc'
  | 'status';

export interface RecordViewOptions {
  filter: RecordFilter;
  search: string;
  sort: RecordSort;
}

export function needsAttention(record: InvoiceRecord): boolean {
  if (record.manualReviewStatus === 'confirmed') return false;
  return (
    record.parseStatus === 'review' ||
    record.parseStatus === 'failed' ||
    record.duplicateStatus === 'duplicate' ||
    record.amountValidation === 'invalid'
  );
}

export function recordMatchesFilter(record: InvoiceRecord, filter: RecordFilter): boolean {
  switch (filter) {
    case 'success':
      return record.parseStatus === 'success';
    case 'review':
      return record.parseStatus === 'review' && record.manualReviewStatus !== 'confirmed';
    case 'confirmed':
      return record.manualReviewStatus === 'confirmed';
    case 'failed':
      return record.parseStatus === 'failed';
    case 'duplicate':
      return record.duplicateStatus === 'duplicate';
    case 'amountInvalid':
      return record.amountValidation === 'invalid';
    case 'all':
    default:
      return true;
  }
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('zh-CN');
}

export function recordMatchesSearch(record: InvoiceRecord, search: string): boolean {
  const query = normalizeSearchText(search);
  if (!query) return true;

  // 搜索只覆盖用户最常用来定位发票的字段，避免把内部状态码等技术字段混入结果。
  const haystack = [
    record.sourceFileName,
    record.fileDisplayName,
    record.invoiceNumber,
    record.sellerName,
    record.sellerTaxId,
    record.buyerName,
    record.buyerTaxId,
    record.itemName,
    record.remark
  ]
    .map(normalizeSearchText)
    .join('\n');

  return haystack.includes(query);
}

function compareOptionalText(a: string, b: string, direction: 'asc' | 'desc'): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
}

function compareOptionalNumber(a: string, b: string, direction: 'asc' | 'desc'): number {
  const aNumber = Number(a);
  const bNumber = Number(b);
  const aValid = a !== '' && Number.isFinite(aNumber);
  const bValid = b !== '' && Number.isFinite(bNumber);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return direction === 'asc' ? aNumber - bNumber : bNumber - aNumber;
}

function workflowRank(record: InvoiceRecord): number {
  if (record.parseStatus === 'failed') return 0;
  if (record.manualReviewStatus === 'pending' && record.parseStatus === 'review') return 1;
  if (record.manualReviewStatus === 'confirmed') return 3;
  if (record.amountValidation === 'invalid' || record.duplicateStatus === 'duplicate') return 2;
  return 4;
}

export function filterAndSortRecords(
  records: InvoiceRecord[],
  options: RecordViewOptions
): InvoiceRecord[] {
  const originalIndex = new Map(records.map((record, index) => [record.id, index]));
  const filtered = records.filter(
    (record) => recordMatchesFilter(record, options.filter) && recordMatchesSearch(record, options.search)
  );

  if (options.sort === 'original') return filtered;

  return [...filtered].sort((a, b) => {
    let compared = 0;
    switch (options.sort) {
      case 'fileDateDesc':
        compared = compareOptionalText(a.fileDate, b.fileDate, 'desc');
        break;
      case 'fileDateAsc':
        compared = compareOptionalText(a.fileDate, b.fileDate, 'asc');
        break;
      case 'issueDateDesc':
        compared = compareOptionalText(a.issueDate, b.issueDate, 'desc');
        break;
      case 'issueDateAsc':
        compared = compareOptionalText(a.issueDate, b.issueDate, 'asc');
        break;
      case 'amountDesc':
        compared = compareOptionalNumber(a.amountIncludingTax, b.amountIncludingTax, 'desc');
        break;
      case 'amountAsc':
        compared = compareOptionalNumber(a.amountIncludingTax, b.amountIncludingTax, 'asc');
        break;
      case 'status':
        compared = workflowRank(a) - workflowRank(b);
        break;
    }

    return compared || (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
  });
}
