import { describe, expect, it } from 'vitest';
import {
  extractInvoiceNumber,
  extractIssueDate,
  parseFilenameMetadata,
  parseInvoiceText,
  validateAmountRelation
} from '../index';

describe('parseFilenameMetadata', () => {
  it('parses yyyy.mm.dd prefix', () => {
    expect(parseFilenameMetadata('2026.08.14-京东-128.50元.pdf')).toEqual({
      date: '2026-08-14',
      name: '京东-128.50元',
      expectedAmount: '128.50'
    });
  });
});

describe('invoice fields', () => {
  it('extracts invoice number', () => {
    expect(extractInvoiceNumber('发票号码: 12345678901234567890')).toBe('12345678901234567890');
  });

  it('extracts issue date', () => {
    expect(extractIssueDate('开票日期: 2026年8月14日')).toBe('2026-08-14');
  });
});

describe('amount validation', () => {
  it('validates with cent tolerance', () => {
    expect(validateAmountRelation('100.00', '13.00', '113.00')).toBe('valid');
    expect(validateAmountRelation('100.00', '13.00', '120.00')).toBe('invalid');
  });
});

describe('parseInvoiceText', () => {
  it('creates a reviewable record', () => {
    const record = parseInvoiceText({
      sourceFileName: '2026.08.14-测试-113元.pdf',
      text: '增值税电子普通发票 发票号码: 12345678901234567890 开票日期: 2026年8月14日 ¥100.00 ¥13.00 ¥113.00'
    });

    expect(record.invoiceNumber).toBe('12345678901234567890');
    expect(record.issueDate).toBe('2026-08-14');
    expect(record.amountIncludingTax).toBe('113.00');
  });
});
