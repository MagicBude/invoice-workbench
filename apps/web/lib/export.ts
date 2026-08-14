import {
  EXPORT_FIELDS,
  type InvoiceExportKey,
  type InvoiceRecord
} from '@invoice-workbench/invoice-core';

function selectedFields(keys: InvoiceExportKey[]) {
  const selected = new Set(keys);
  return EXPORT_FIELDS.filter((field) => selected.has(field.key));
}

function cellValue(record: InvoiceRecord, key: InvoiceExportKey) {
  const value = record[key];
  return value ?? '';
}

export async function exportXlsx(records: InvoiceRecord[], keys: InvoiceExportKey[]) {
  const XLSX = await import('xlsx');
  const fields = selectedFields(keys);
  const rows = records.map((record) => {
    const row: Record<string, string | number> = {};
    for (const field of fields) {
      const value = cellValue(record, field.key);
      row[field.label] = field.type === 'currency' && value !== '' ? Number(value) : value;
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: fields.map((field) => field.label)
  });
  worksheet['!cols'] = fields.map((field) => ({
    wch: Math.max(12, Math.min(32, field.label.length * 2 + 8))
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '发票汇总');
  XLSX.writeFile(workbook, '发票汇总表.xlsx');
}

export function exportCsv(records: InvoiceRecord[], keys: InvoiceExportKey[]) {
  const fields = selectedFields(keys);
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const rows = [
    fields.map((field) => field.label),
    ...records.map((record) => fields.map((field) => cellValue(record, field.key)))
  ];

  const content = `\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '发票汇总表.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
