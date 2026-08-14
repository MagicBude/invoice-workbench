import {
  detectInvoiceType,
  extractAmounts,
  extractBuyerName,
  extractBuyerTaxId,
  extractInvoiceNumber,
  extractIssueDate,
  extractItemName,
  extractSellerName,
  extractSellerTaxId,
  extractTaxRate
} from './extractors';
import { parseFilenameMetadata } from './filename';
import { normalizeInvoiceText } from './normalize';
import type { InvoiceRecord } from './types';
import { calculateConfidence, validateAmountRelation } from './validation';

function createId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface ParseInvoiceInput {
  sourceFileName: string;
  text: string;
}

export function parseInvoiceText(input: ParseInvoiceInput): InvoiceRecord {
  const normalized = normalizeInvoiceText(input.text);
  const filename = parseFilenameMetadata(input.sourceFileName);
  const amounts = extractAmounts(normalized);

  const record: InvoiceRecord = {
    id: createId(),
    sourceFileName: input.sourceFileName,
    fileDate: filename.date,
    fileDisplayName: filename.name,
    invoiceType: detectInvoiceType(normalized),
    invoiceNumber: extractInvoiceNumber(normalized),
    issueDate: extractIssueDate(normalized),
    sellerName: extractSellerName(normalized),
    sellerTaxId: extractSellerTaxId(normalized),
    buyerName: extractBuyerName(normalized),
    buyerTaxId: extractBuyerTaxId(normalized),
    amountExcludingTax: amounts.amountExcludingTax,
    taxAmount: amounts.taxAmount,
    amountIncludingTax: amounts.amountIncludingTax,
    taxRate: extractTaxRate(normalized),
    itemName: extractItemName(normalized),
    remark: '',
    parseStatus: 'review',
    confidence: 0,
    duplicateStatus: 'unknown',
    amountValidation: validateAmountRelation(
      amounts.amountExcludingTax,
      amounts.taxAmount,
      amounts.amountIncludingTax
    ),
    validationMessages: []
  };

  if (!normalized || normalized.length < 20) {
    record.parseStatus = 'failed';
    record.remark = '未检测到有效 PDF 文本层，可能是扫描件或图片 PDF。';
    record.validationMessages.push('NO_TEXT_LAYER');
    return record;
  }

  if (amounts.usedHeuristic) {
    record.validationMessages.push('AMOUNT_HEURISTIC_USED');
  }

  if (filename.expectedAmount && record.amountIncludingTax) {
    const difference = Math.abs(Number(filename.expectedAmount) - Number(record.amountIncludingTax));
    if (Number.isFinite(difference) && difference > 0.01) {
      record.validationMessages.push('FILENAME_AMOUNT_MISMATCH');
      record.remark = `文件名金额 ${Number(filename.expectedAmount).toFixed(2)} 与价税合计 ${record.amountIncludingTax} 不一致`;
    }
  }

  if (record.amountValidation === 'invalid') {
    record.validationMessages.push('AMOUNT_RELATION_INVALID');
  }

  record.confidence = calculateConfidence(record);
  record.parseStatus = record.confidence >= 0.75 && record.amountValidation !== 'invalid' ? 'success' : 'review';

  return record;
}
