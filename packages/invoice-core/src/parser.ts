import {
  detectInvoiceType,
  extractAmounts,
  extractInvoiceNumber,
  extractIssueDate,
  extractItemName,
  extractPartyFields,
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

/**
 * 将 PDF 文本层转换成统一的 InvoiceRecord。
 *
 * 解析采用“各字段独立提取 + 最后交叉校验”的方式：某一个字段失败时，
 * 不会阻止其他字段继续识别，用户仍然可以在表格里人工补充或修正。
 */
export function parseInvoiceText(input: ParseInvoiceInput): InvoiceRecord {
  const normalized = normalizeInvoiceText(input.text);
  const filename = parseFilenameMetadata(input.sourceFileName);
  const amounts = extractAmounts(normalized);
  const parties = extractPartyFields(normalized);

  const record: InvoiceRecord = {
    id: createId(),
    sourceFileName: input.sourceFileName,
    fileDate: filename.date,
    fileDisplayName: filename.name,
    invoiceType: detectInvoiceType(normalized),
    invoiceNumber: extractInvoiceNumber(normalized),
    issueDate: extractIssueDate(normalized),
    sellerName: parties.sellerName,
    sellerTaxId: parties.sellerTaxId,
    buyerName: parties.buyerName,
    buyerTaxId: parties.buyerTaxId,
    amountExcludingTax: amounts.amountExcludingTax,
    taxAmount: amounts.taxAmount,
    amountIncludingTax: amounts.amountIncludingTax,
    taxRate: extractTaxRate(normalized),
    itemName: extractItemName(normalized),
    remark: '',
    parseStatus: 'review',
    manualReviewStatus: 'pending',
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

  if (!record.invoiceNumber) record.validationMessages.push('INVOICE_NUMBER_MISSING');
  if (!record.issueDate) record.validationMessages.push('ISSUE_DATE_MISSING');
  if (!record.amountIncludingTax) record.validationMessages.push('TOTAL_AMOUNT_MISSING');

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

  // 启发式金额和“文件名金额不一致”都属于需要人确认的风险信号。
  // 即使其他字段完整、数学关系也能自洽，也不应直接标记为自动识别成功。
  const requiresManualReview = record.validationMessages.some((message) =>
    ['AMOUNT_HEURISTIC_USED', 'FILENAME_AMOUNT_MISMATCH'].includes(message)
  );

  record.parseStatus =
    record.confidence >= 0.75 && record.amountValidation !== 'invalid' && !requiresManualReview
      ? 'success'
      : 'review';

  return record;
}
