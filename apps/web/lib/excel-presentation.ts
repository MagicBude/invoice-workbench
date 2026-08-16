import type { ExportFieldDefinition, InvoiceExportKey } from '@invoice-workbench/invoice-core';

const NARROW_KEYS = new Set<InvoiceExportKey>([
  'fileDate',
  'issueDate',
  'taxRate',
  'parseStatus',
  'manualReviewStatus',
  'confidence',
  'duplicateStatus',
  'amountValidation'
]);

const WIDE_KEYS = new Set<InvoiceExportKey>([
  'sourceFileName',
  'fileDisplayName',
  'sellerName',
  'buyerName',
  'itemName',
  'remark'
]);

const EXTRA_WIDE_KEYS = new Set<InvoiceExportKey>(['itemName', 'remark']);

/**
 * Excel 的列宽不是像素。这里按字符视觉宽度做一个近似：中文字符约占两个英文字符宽度。
 * 目标不是追求像素级精确，而是避免文件名、公司名称等列过窄，同时限制超长文本把整张表撑得过宽。
 */
export function estimateExcelTextWidth(value: unknown): number {
  const text = value == null ? '' : String(value);
  let width = 0;

  for (const character of text) {
    width += /[\u3400-\u9fff\uF900-\uFAFF]/u.test(character) ? 2 : 1;
  }

  return width;
}

export function calculateExcelColumnWidth(
  field: ExportFieldDefinition,
  values: readonly unknown[]
): number {
  const contentWidth = Math.max(
    estimateExcelTextWidth(field.label),
    ...values.map(estimateExcelTextWidth)
  );

  const minimum = field.type === 'currency' ? 13 : NARROW_KEYS.has(field.key) ? 12 : 14;
  const maximum = EXTRA_WIDE_KEYS.has(field.key) ? 40 : WIDE_KEYS.has(field.key) ? 32 : 26;

  return Math.max(minimum, Math.min(maximum, contentWidth + 3));
}

export function excelHorizontalAlignment(
  field: ExportFieldDefinition
): 'left' | 'center' | 'right' {
  if (field.type === 'currency' || field.type === 'number') return 'right';
  if (field.type === 'date' || field.type === 'status' || field.key === 'taxRate') return 'center';
  return 'left';
}

export type ExcelStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

/**
 * 状态列的颜色只根据最终用户可见中文值决定，不依赖内部枚举。
 * 这样以后内部状态结构调整时，Excel 样式仍然保持稳定。
 */
export function excelStatusTone(value: unknown): ExcelStatusTone {
  const text = value == null ? '' : String(value);

  if (['成功', '已确认', '通过', '未重复'].includes(text)) return 'success';
  if (['待复核', '未确认', '无法校验'].includes(text)) return 'warning';
  if (['失败', '异常', '重复'].includes(text)) return 'danger';
  return 'neutral';
}
