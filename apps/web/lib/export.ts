import {
  EXPORT_FIELDS,
  type ExportFieldDefinition,
  type InvoiceExportKey,
  type InvoiceRecord
} from '@invoice-workbench/invoice-core';

export type ExportCell = string | number;

export interface ExportMatrix {
  fields: ExportFieldDefinition[];
  rows: ExportCell[][];
  summaryRow: ExportCell[];
}

function selectedFields(keys: InvoiceExportKey[]): ExportFieldDefinition[] {
  const selected = new Set(keys);
  return EXPORT_FIELDS.filter((field) => selected.has(field.key));
}

function statusText(key: InvoiceExportKey, value: unknown): string | null {
  if (key === 'parseStatus') {
    if (value === 'success') return '成功';
    if (value === 'review') return '待复核';
    if (value === 'failed') return '失败';
  }

  if (key === 'manualReviewStatus') {
    if (value === 'confirmed') return '已确认';
    if (value === 'pending') return '未确认';
  }

  if (key === 'duplicateStatus') {
    if (value === 'unique') return '未重复';
    if (value === 'duplicate') return '重复';
    if (value === 'unknown') return '未知';
  }

  if (key === 'amountValidation') {
    if (value === 'valid') return '通过';
    if (value === 'invalid') return '异常';
    if (value === 'unknown') return '无法校验';
  }

  return null;
}

/**
 * 把内部数据转换成用户真正看到的导出值。
 *
 * UI 内部保留 success/review 等稳定英文枚举便于代码判断，导出时再转换成中文，
 * 这样既不破坏程序结构，也不会让最终 Excel 出现面向开发者的内部状态值。
 */
export function exportCellValue(
  record: InvoiceRecord,
  field: ExportFieldDefinition
): ExportCell {
  const value = record[field.key];
  const localizedStatus = statusText(field.key, value);
  if (localizedStatus !== null) return localizedStatus;

  if (field.key === 'confidence') {
    return value === '' || value == null ? '' : `${Math.round(Number(value) * 100)}%`;
  }

  if (field.type === 'currency' && value !== '' && value != null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : String(value);
  }

  return value == null ? '' : (value as ExportCell);
}

export function buildExportMatrix(records: InvoiceRecord[], keys: InvoiceExportKey[]): ExportMatrix {
  const fields = selectedFields(keys);
  const rows = records.map((record) => fields.map((field) => exportCellValue(record, field)));

  const summaryLabelIndex = fields.findIndex((field) => field.type !== 'currency');
  const summaryRow = fields.map<ExportCell>((field, index) => {
    if (field.type === 'currency') {
      return records.reduce((sum, record) => {
        const value = Number(record[field.key]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
    }

    return index === summaryLabelIndex ? '合计' : '';
  });

  return { fields, rows, summaryRow };
}

export async function exportXlsx(records: InvoiceRecord[], keys: InvoiceExportKey[]) {
  const XLSX = await import('xlsx');
  const { fields, rows, summaryRow } = buildExportMatrix(records, keys);
  const aoa = [fields.map((field) => field.label), ...rows, summaryRow];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet['!cols'] = fields.map((field) => ({
    wch: Math.max(12, Math.min(32, field.label.length * 2 + 8))
  }));

  // SheetJS 会根据 number 类型写入真正的数值单元格，后续在 Excel 中可以继续求和和计算。
  for (let rowIndex = 1; rowIndex < aoa.length; rowIndex += 1) {
    fields.forEach((field, columnIndex) => {
      if (field.type !== 'currency') return;
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[address];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '发票汇总');
  XLSX.writeFile(workbook, '发票汇总表.xlsx');
}

export function exportCsv(records: InvoiceRecord[], keys: InvoiceExportKey[]) {
  const { fields, rows, summaryRow } = buildExportMatrix(records, keys);
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const contentRows = [fields.map((field) => field.label), ...rows, summaryRow];
  const content = `\uFEFF${contentRows.map((row) => row.map(escape).join(',')).join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '发票汇总表.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
