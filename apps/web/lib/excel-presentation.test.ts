import { describe, expect, it } from 'vitest';
import { EXPORT_FIELDS } from '@invoice-workbench/invoice-core';
import {
  calculateExcelColumnWidth,
  estimateExcelTextWidth,
  excelHorizontalAlignment,
  excelStatusTone
} from './excel-presentation';

function field(key: string) {
  const result = EXPORT_FIELDS.find((item) => item.key === key);
  if (!result) throw new Error(`Missing field: ${key}`);
  return result;
}

describe('Excel 展示规则', () => {
  it('中文字符按更宽的视觉宽度计算', () => {
    expect(estimateExcelTextWidth('发票ABC')).toBe(7);
  });

  it('长文本列会扩大但不会无限撑宽工作表', () => {
    expect(
      calculateExcelColumnWidth(field('sellerName'), ['江苏某某某某某某某某某某某某某某某有限公司'])
    ).toBeLessThanOrEqual(32);
    expect(calculateExcelColumnWidth(field('remark'), ['这是一段非常非常非常长的备注'.repeat(8)])).toBe(40);
  });

  it('金额右对齐，日期和状态居中', () => {
    expect(excelHorizontalAlignment(field('amountIncludingTax'))).toBe('right');
    expect(excelHorizontalAlignment(field('issueDate'))).toBe('center');
    expect(excelHorizontalAlignment(field('parseStatus'))).toBe('center');
  });

  it('状态值映射到稳定的语义色调', () => {
    expect(excelStatusTone('成功')).toBe('success');
    expect(excelStatusTone('待复核')).toBe('warning');
    expect(excelStatusTone('异常')).toBe('danger');
    expect(excelStatusTone('未知')).toBe('neutral');
  });
});
