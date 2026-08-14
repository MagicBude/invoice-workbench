import type { ExportFieldDefinition, InvoiceExportKey } from './types';

export const EXPORT_FIELDS: readonly ExportFieldDefinition[] = [
  { key: 'sourceFileName', label: 'PDF文件名', defaultSelected: true, editable: false, type: 'text', group: 'file' },
  { key: 'fileDate', label: '日期', defaultSelected: true, editable: true, type: 'date', group: 'file' },
  { key: 'fileDisplayName', label: '名称', defaultSelected: true, editable: true, type: 'text', group: 'file' },
  { key: 'invoiceType', label: '发票类型', defaultSelected: false, editable: true, type: 'text', group: 'invoice' },
  { key: 'invoiceNumber', label: '发票号码', defaultSelected: true, editable: true, type: 'text', group: 'invoice' },
  { key: 'issueDate', label: '开票日期', defaultSelected: true, editable: true, type: 'date', group: 'invoice' },
  { key: 'sellerName', label: '销售方名称', defaultSelected: false, editable: true, type: 'text', group: 'party' },
  { key: 'sellerTaxId', label: '销售方税号', defaultSelected: false, editable: true, type: 'text', group: 'party' },
  { key: 'buyerName', label: '购买方名称', defaultSelected: false, editable: true, type: 'text', group: 'party' },
  { key: 'buyerTaxId', label: '购买方税号', defaultSelected: false, editable: true, type: 'text', group: 'party' },
  { key: 'amountExcludingTax', label: '不含税金额', defaultSelected: true, editable: true, type: 'currency', group: 'amount' },
  { key: 'taxAmount', label: '税额', defaultSelected: true, editable: true, type: 'currency', group: 'amount' },
  { key: 'amountIncludingTax', label: '价税合计', defaultSelected: true, editable: true, type: 'currency', group: 'amount' },
  { key: 'taxRate', label: '税率', defaultSelected: false, editable: true, type: 'text', group: 'amount' },
  { key: 'itemName', label: '项目名称', defaultSelected: false, editable: true, type: 'text', group: 'business' },
  { key: 'remark', label: '备注', defaultSelected: true, editable: true, type: 'text', group: 'business' },
  { key: 'parseStatus', label: '解析状态', defaultSelected: false, editable: false, type: 'status', group: 'quality' },
  { key: 'confidence', label: '置信度', defaultSelected: false, editable: false, type: 'number', group: 'quality' },
  { key: 'duplicateStatus', label: '重复状态', defaultSelected: false, editable: false, type: 'status', group: 'quality' },
  { key: 'amountValidation', label: '金额校验', defaultSelected: false, editable: false, type: 'status', group: 'quality' }
] as const;

export const DEFAULT_EXPORT_KEYS: InvoiceExportKey[] = EXPORT_FIELDS
  .filter((field) => field.defaultSelected)
  .map((field) => field.key);

export function getExportField(key: InvoiceExportKey): ExportFieldDefinition {
  const field = EXPORT_FIELDS.find((item) => item.key === key);
  if (!field) throw new Error(`Unknown export field: ${String(key)}`);
  return field;
}
