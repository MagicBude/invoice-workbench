import { describe, expect, it } from 'vitest';
import { parseInvoiceText } from '@invoice-workbench/invoice-core';
import { filterAndSortRecords, needsAttention, recordMatchesSearch } from './record-view';

function createRecord(fileName: string, total: number) {
  return parseInvoiceText({
    sourceFileName: fileName,
    text: `电子发票（普通发票）\n发票号码: ${String(total).padStart(20, '1')}\n开票日期: 2026年8月14日\n销售方信息 名称: 上海示例科技有限公司 纳税人识别号: 91310100CCCCDDDD22\n项目名称: *信息技术服务*软件服务\n合计 ¥${(total - 13).toFixed(2)} ¥13.00\n价税合计（小写）¥${total.toFixed(2)}`
  });
}

describe('record view', () => {
  it('支持按文件名、发票号和购销方搜索', () => {
    const record = createRecord('2026.08.14-软件服务.pdf', 113);
    record.buyerName = '苏州测试智能有限公司';

    expect(recordMatchesSearch(record, '软件服务')).toBe(true);
    expect(recordMatchesSearch(record, record.invoiceNumber)).toBe(true);
    expect(recordMatchesSearch(record, '苏州测试')).toBe(true);
    expect(recordMatchesSearch(record, '不存在的公司')).toBe(false);
  });

  it('人工确认后的待复核记录不再进入待处理队列', () => {
    const record = createRecord('a.pdf', 113);
    record.parseStatus = 'review';
    expect(needsAttention(record)).toBe(true);

    record.manualReviewStatus = 'confirmed';
    expect(needsAttention(record)).toBe(false);
  });

  it('筛选人工已确认记录', () => {
    const first = createRecord('a.pdf', 113);
    const second = createRecord('b.pdf', 226);
    second.manualReviewStatus = 'confirmed';

    const result = filterAndSortRecords([first, second], {
      filter: 'confirmed',
      search: '',
      sort: 'original'
    });

    expect(result.map((record) => record.sourceFileName)).toEqual(['b.pdf']);
  });

  it('按价税合计从高到低排序且不会修改原数组', () => {
    const first = createRecord('a.pdf', 113);
    const second = createRecord('b.pdf', 226);
    const records = [first, second];

    const result = filterAndSortRecords(records, {
      filter: 'all',
      search: '',
      sort: 'amountDesc'
    });

    expect(result.map((record) => record.sourceFileName)).toEqual(['b.pdf', 'a.pdf']);
    expect(records.map((record) => record.sourceFileName)).toEqual(['a.pdf', 'b.pdf']);
  });
});
