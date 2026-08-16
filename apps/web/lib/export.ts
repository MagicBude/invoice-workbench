import {
  EXPORT_FIELDS,
  type ExportFieldDefinition,
  type InvoiceExportKey,
  type InvoiceRecord
} from '@invoice-workbench/invoice-core';
import {
  calculateExcelColumnWidth,
  excelHorizontalAlignment,
  excelStatusTone
} from './excel-presentation';

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

const EXCEL_COLORS = {
  header: 'FF0F766E',
  headerBorder: 'FF0A5C4B',
  bodyText: 'FF1F2937',
  border: 'FFD9E2E8',
  zebra: 'FFF8FAFC',
  summary: 'FFE8F5EF',
  summaryBorder: 'FF7AB89F',
  statusSuccessFill: 'FFDCFCE7',
  statusSuccessText: 'FF166534',
  statusWarningFill: 'FFFFF7E0',
  statusWarningText: 'FFB45309',
  statusDangerFill: 'FFFFE4E6',
  statusDangerText: 'FFBE123C',
  statusNeutralFill: 'FFF1F5F9',
  statusNeutralText: 'FF475569'
} as const;

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: EXCEL_COLORS.border } },
  left: { style: 'thin' as const, color: { argb: EXCEL_COLORS.border } },
  bottom: { style: 'thin' as const, color: { argb: EXCEL_COLORS.border } },
  right: { style: 'thin' as const, color: { argb: EXCEL_COLORS.border } }
};

function statusStyle(value: unknown) {
  const tone = excelStatusTone(value);
  if (tone === 'success') {
    return { fill: EXCEL_COLORS.statusSuccessFill, font: EXCEL_COLORS.statusSuccessText };
  }
  if (tone === 'warning') {
    return { fill: EXCEL_COLORS.statusWarningFill, font: EXCEL_COLORS.statusWarningText };
  }
  if (tone === 'danger') {
    return { fill: EXCEL_COLORS.statusDangerFill, font: EXCEL_COLORS.statusDangerText };
  }
  return { fill: EXCEL_COLORS.statusNeutralFill, font: EXCEL_COLORS.statusNeutralText };
}

/**
 * 生成适合直接交付使用的 Excel 汇总表。
 *
 * ExcelJS 在点击导出时才动态加载，因此不会进入首页的首屏 JavaScript。
 * 所有生成、样式设置和下载仍然发生在浏览器本地，不会上传发票数据。
 */
export async function exportXlsx(records: InvoiceRecord[], keys: InvoiceExportKey[]) {
  const { Workbook } = await import('exceljs');
  const { fields, rows, summaryRow } = buildExportMatrix(records, keys);

  const workbook = new Workbook();
  workbook.creator = 'Invoice Workbench';
  workbook.lastModifiedBy = 'Invoice Workbench';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = '发票汇总表';
  workbook.subject = 'Invoice Workbench 发票汇总';

  const worksheet = workbook.addWorksheet('发票汇总', {
    views: [
      {
        state: 'frozen',
        xSplit: 1,
        ySplit: 1,
        topLeftCell: 'B2',
        activeCell: 'A1',
        showGridLines: false
      }
    ]
  });

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2
    }
  };

  worksheet.addRow(fields.map((field) => field.label));
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.addRow(summaryRow);

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: fields.length }
  };

  fields.forEach((field, columnIndex) => {
    const values = rows.map((row) => row[columnIndex]);
    const column = worksheet.getColumn(columnIndex + 1);
    column.width = calculateExcelColumnWidth(field, values);
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = {
      name: '微软雅黑',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.header }
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    cell.border = {
      top: { style: 'thin', color: { argb: EXCEL_COLORS.headerBorder } },
      left: { style: 'thin', color: { argb: EXCEL_COLORS.headerBorder } },
      bottom: { style: 'thin', color: { argb: EXCEL_COLORS.headerBorder } },
      right: { style: 'thin', color: { argb: EXCEL_COLORS.headerBorder } }
    };
  });

  const lastDataRowNumber = rows.length + 1;
  for (let rowNumber = 2; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const field = fields[columnNumber - 1];
      if (!field) return;

      cell.font = {
        name: '微软雅黑',
        size: 10.5,
        color: { argb: EXCEL_COLORS.bodyText }
      };
      cell.border = thinBorder;
      cell.alignment = {
        horizontal: excelHorizontalAlignment(field),
        vertical: 'middle',
        wrapText: ['sourceFileName', 'fileDisplayName', 'sellerName', 'buyerName', 'itemName', 'remark'].includes(
          field.key
        )
      };

      if (rowNumber % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.zebra }
        };
      }

      if (field.type === 'currency' && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00;[Red]-#,##0.00';
      }

      if (field.type === 'status') {
        const style = statusStyle(cell.value);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: style.fill }
        };
        cell.font = {
          ...cell.font,
          bold: true,
          color: { argb: style.font }
        };
      }
    });
  }

  const summaryRowNumber = rows.length + 2;
  const summaryExcelRow = worksheet.getRow(summaryRowNumber);
  summaryExcelRow.height = 24;
  summaryExcelRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const field = fields[columnNumber - 1];
    cell.font = {
      name: '微软雅黑',
      size: 10.5,
      bold: true,
      color: { argb: EXCEL_COLORS.bodyText }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.summary }
    };
    cell.border = {
      ...thinBorder,
      top: { style: 'medium', color: { argb: EXCEL_COLORS.summaryBorder } }
    };
    cell.alignment = {
      horizontal: field ? excelHorizontalAlignment(field) : 'left',
      vertical: 'middle'
    };

    if (field?.type === 'currency' && typeof cell.value === 'number') {
      cell.numFmt = '#,##0.00;[Red]-#,##0.00';
    }
  });

  // ExcelJS 的浏览器写入接口返回二进制 Buffer/ArrayBuffer。
  // 转成 Uint8Array 后交给 Blob，即可继续沿用纯浏览器下载，不需要后端服务。
  const buffer = await workbook.xlsx.writeBuffer();
  const binary = new Uint8Array(buffer);
  const blob = new Blob([binary], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '发票汇总表.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
