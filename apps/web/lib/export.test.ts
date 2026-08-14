import { describe, expect, it } from 'vitest';
import { parseInvoiceText } from '@invoice-workbench/invoice-core';
import { buildExportMatrix } from './export';

function sampleRecord() {
  return parseInvoiceText({
    sourceFileName: '2026.08.14-软件服务-113元.pdf',
    text: '发票号码: 12345678901234567890 开票日期: 2026年8月14日 合计 ¥100.00 ¥13.00 价税合计(小写)¥113.00'
  });
}

describe('buildExportMatrix', () => {
  it('按照统一字段注册表顺序导出，并生成金额合计行', () => {
    const record = sampleRecord();
    const matrix = buildExportMatrix(
      [record],
      ['amountIncludingTax', 'sourceFileName', 'taxAmount', 'amountExcludingTax']
    );

    expect(matrix.fields.map((field) => field.key)).toEqual([
      'sourceFileName',
      'amountExcludingTax',
      'taxAmount',
      'amountIncludingTax'
    ]);
    expect(matrix.summaryRow).toEqual(['合计', 100, 13, 113]);
  });

  it('只有金额列时仍然保留金额合计', () => {
    const record = sampleRecord();
    const matrix = buildExportMatrix([record], ['taxAmount', 'amountIncludingTax']);

    expect(matrix.summaryRow).toEqual([13, 113]);
  });

  it('把内部状态值转换成中文', () => {
    const record = sampleRecord();
    record.parseStatus = 'review';
    record.duplicateStatus = 'duplicate';
    record.amountValidation = 'invalid';

    const matrix = buildExportMatrix(
      [record],
      ['parseStatus', 'duplicateStatus', 'amountValidation']
    );

    expect(matrix.rows[0]).toEqual(['待复核', '重复', '异常']);
  });
  it('把人工复核状态转换成中文', () => {
    const record = sampleRecord();
    record.manualReviewStatus = 'confirmed';

    const matrix = buildExportMatrix([record], ['manualReviewStatus']);

    expect(matrix.rows[0]).toEqual(['已确认']);
  });

});
