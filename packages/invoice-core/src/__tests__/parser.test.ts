import { describe, expect, it } from 'vitest';
import {
  detectInvoiceType,
  extractAmounts,
  extractInvoiceNumber,
  extractIssueDate,
  extractItemName,
  extractPartyFields,
  extractTaxRate,
  markDuplicateRecords,
  normalizeInvoiceText,
  parseFilenameMetadata,
  parseInvoiceText,
  validateAmountRelation
} from '../index';

describe('normalizeInvoiceText', () => {
  it('统一全角字符并保留换行', () => {
    expect(normalizeInvoiceText('发票号码：１２３４\r\n价税合计：￥１１３．００')).toBe(
      '发票号码:1234\n价税合计:¥113.00'
    );
  });

  it('保留视觉列分隔制表符', () => {
    expect(normalizeInvoiceText('项目名称\t规格型号\t数量')).toBe('项目名称\t规格型号\t数量');
  });
});

describe('parseFilenameMetadata', () => {
  it('解析 yyyy.mm.dd 前缀和文件名金额', () => {
    expect(parseFilenameMetadata('2026.08.14-京东-128.50元.pdf')).toEqual({
      date: '2026-08-14',
      name: '京东-128.50元',
      expectedAmount: '128.50'
    });
  });

  it('解析 YYYYMMDD 前缀', () => {
    expect(parseFilenameMetadata('20260721-财务小推车.pdf')).toEqual({
      date: '2026-07-21',
      name: '财务小推车',
      expectedAmount: ''
    });
  });
});

describe('发票基础字段', () => {
  it('优先提取带标签的 20 位发票号码', () => {
    expect(extractInvoiceNumber('发票号码: 12345678901234567890')).toBe('12345678901234567890');
  });

  it('支持传统 8 位发票号码', () => {
    expect(extractInvoiceNumber('发 票 号 码：87654321')).toBe('87654321');
  });

  it('支持数字之间被 PDF 文本层插入空格', () => {
    expect(extractInvoiceNumber('发票号码: 1234 5678 9012 3456 7890')).toBe('12345678901234567890');
  });

  it('解析中文开票日期', () => {
    expect(extractIssueDate('开票日期: 2026年8月14日')).toBe('2026-08-14');
  });

  it('解析紧凑开票日期', () => {
    expect(extractIssueDate('开票日期：20260814')).toBe('2026-08-14');
  });

  it('拒绝无效日期', () => {
    expect(extractIssueDate('开票日期: 2026年2月31日')).toBe('');
  });

  it('识别数电普通发票类型', () => {
    expect(detectInvoiceType('电子发票（普通发票）')).toBe('电子发票（普通发票）');
  });
});

describe('购销方信息', () => {
  it('解析顺序布局的购买方和销售方', () => {
    const result = extractPartyFields(`
      购买方信息 名称: 杭州测试科技有限公司 统一社会信用代码/纳税人识别号: 91330100ABCDEF1234
      销售方信息 名称: 上海示例软件有限公司 纳税人识别号: 91310100ZXCVBN5678
      项目名称 规格型号 单位 数量 单价 金额 税率 税额
    `);

    expect(result).toEqual({
      buyerName: '杭州测试科技有限公司',
      buyerTaxId: '91330100ABCDEF1234',
      sellerName: '上海示例软件有限公司',
      sellerTaxId: '91310100ZXCVBN5678'
    });
  });

  it('解析双栏文本顺序的购买方和销售方', () => {
    const result = extractPartyFields(`
      购买方信息 销售方信息
      名称: 杭州甲方有限公司 名称: 上海乙方有限公司
      统一社会信用代码/纳税人识别号: 91330100AAAABBBB11
      统一社会信用代码/纳税人识别号: 91310100CCCCDDDD22
      项目名称 规格型号 单位 数量 单价 金额 税率 税额
    `);

    expect(result.buyerName).toBe('杭州甲方有限公司');
    expect(result.sellerName).toBe('上海乙方有限公司');
    expect(result.buyerTaxId).toBe('91330100AAAABBBB11');
    expect(result.sellerTaxId).toBe('91310100CCCCDDDD22');
  });

  it('字段标签被当作名称候选时宁可留空', () => {
    const result = extractPartyFields(`
      购买方信息 销售方信息
      名称: 统一社会信用代码/纳税人识别号 名称: 上海乙方有限公司
      统一社会信用代码/纳税人识别号: 91330100AAAABBBB11
      统一社会信用代码/纳税人识别号: 91310100CCCCDDDD22
      项目名称 规格型号 单位 数量 单价 金额 税率 税额
    `);

    expect(result.buyerName).toBe('');
    expect(result.sellerName).toBe('上海乙方有限公司');
    expect(result.buyerTaxId).toBe('91330100AAAABBBB11');
    expect(result.sellerTaxId).toBe('91310100CCCCDDDD22');
  });

  it('号码和日期拼接文本不会被识别成购销方名称', () => {
    const result = extractPartyFields(`
      购买方信息 名称: 26317000002598503004 2026年07月17日 纳税人识别号: 91330100AAAABBBB11
      销售方信息 名称: 购买方信息 纳税人识别号: 91310100CCCCDDDD22
      项目名称 规格型号 单位 数量 单价 金额 税率 税额
    `);

    expect(result.buyerName).toBe('');
    expect(result.sellerName).toBe('');
    expect(result.buyerTaxId).toBe('91330100AAAABBBB11');
    expect(result.sellerTaxId).toBe('91310100CCCCDDDD22');
  });

  it('税号标签丢失时可从名称尾部拆分购销方税号', () => {
    const result = extractPartyFields(`
      购买方信息 销售方信息
      名称: 苏州示例智能科技有限公司 91320594MA1XQJBH12
      名称: 江苏示例餐饮管理有限责任公司昆山分公司 91320583MA20R38G8E
      项目名称 规格型号 单位 数量 单价 金额 税率/征收率 税额
    `);

    expect(result.buyerName).toBe('苏州示例智能科技有限公司');
    expect(result.buyerTaxId).toBe('91320594MA1XQJBH12');
    expect(result.sellerName).toBe('江苏示例餐饮管理有限责任公司昆山分公司');
    expect(result.sellerTaxId).toBe('91320583MA20R38G8E');
  });

  it('视觉顺序双栏发票不会把销售方税号错配给购买方', () => {
    const result = extractPartyFields(`
      购买方信息\t销售方信息
      名称: 斯迈孚智能科技（苏州）有限公司\t名称: 上海择程西南国际旅行社有限公司
      统一社会信用代码/纳税人识别号: 91320594MA1XQJBH12\t统一社会信用代码/纳税人识别号: 91310105134638405A
      项目名称\t规格型号\t单位\t数量\t单价\t金额\t税率/征收率\t税额
    `);

    expect(result).toEqual({
      buyerName: '斯迈孚智能科技（苏州）有限公司',
      buyerTaxId: '91320594MA1XQJBH12',
      sellerName: '上海择程西南国际旅行社有限公司',
      sellerTaxId: '91310105134638405A'
    });
  });

  it('视觉双栏支持真实发票常见的全角冒号', () => {
    const result = extractPartyFields(`
      购买方信息\t销售方信息
      名称：斯迈孚智能科技（苏州）有限公司\t名称：江苏示例餐饮管理有限责任公司昆山分公司
      统一社会信用代码/纳税人识别号：91320594MA1XQJBH12\t统一社会信用代码/纳税人识别号：91320583MA20R38G8E
      项目名称\t规格型号\t单位\t数量\t单价\t金额\t税率/征收率\t税额
    `);

    expect(result).toEqual({
      buyerName: '斯迈孚智能科技（苏州）有限公司',
      buyerTaxId: '91320594MA1XQJBH12',
      sellerName: '江苏示例餐饮管理有限责任公司昆山分公司',
      sellerTaxId: '91320583MA20R38G8E'
    });
  });

  it('不依赖竖排购销方标题也能解析标准双栏名称和税号', () => {
    const result = extractPartyFields(`
      购\t销
      买\t售
      方\t方
      信\t信
      息\t息
      名称：\t斯迈孚智能科技（苏州）有限公司\t名称：\t江苏示例餐饮管理有限责任公司昆山分公司
      统一社会信用代码/纳税人识别号：\t91320594MA1XQJBH12\t统一社会信用代码/纳税人识别号：\t91320583MA20R38G8E
      项目名称\t规格型号\t单位\t数量\t单价\t金额\t税率/征收率\t税额
    `);

    expect(result).toEqual({
      buyerName: '斯迈孚智能科技（苏州）有限公司',
      buyerTaxId: '91320594MA1XQJBH12',
      sellerName: '江苏示例餐饮管理有限责任公司昆山分公司',
      sellerTaxId: '91320583MA20R38G8E'
    });
  });

  it('兼容税号标签被拆空格且没有冒号的文本层', () => {
    const result = extractPartyFields(`
      购买方信息 名称: 苏州示例智能科技有限公司 统 一 社 会 信 用 代 码 / 纳 税 人 识 别 号 91320594MA1XQJBH12
      销售方信息 名称: 江苏示例餐饮管理有限责任公司昆山分公司 统 一 社 会 信 用 代 码 / 纳 税 人 识 别 号 91320583MA20R38G8E
      项目名称 规格型号 单位 数量 单价 金额 税率/征收率 税额
    `);

    expect(result.buyerName).toBe('苏州示例智能科技有限公司');
    expect(result.buyerTaxId).toBe('91320594MA1XQJBH12');
    expect(result.sellerName).toBe('江苏示例餐饮管理有限责任公司昆山分公司');
    expect(result.sellerTaxId).toBe('91320583MA20R38G8E');
  });
});

describe('金额解析', () => {
  it('优先使用合计行和价税合计', () => {
    const amounts = extractAmounts(
      '合 计 ¥100.00 ¥13.00 价税合计（大写）壹佰壹拾叁元整 （小写）¥113.00'
    );

    expect(amounts).toEqual({
      amountExcludingTax: '100.00',
      taxAmount: '13.00',
      amountIncludingTax: '113.00',
      usedHeuristic: false
    });
  });

  it('支持红字负数金额', () => {
    const amounts = extractAmounts(
      '合计 ¥-100.00 ¥-13.00 价税合计（小写）¥-113.00'
    );

    expect(amounts.amountExcludingTax).toBe('-100.00');
    expect(amounts.taxAmount).toBe('-13.00');
    expect(amounts.amountIncludingTax).toBe('-113.00');
  });

  it('只有两项可靠金额时通过关系补齐第三项', () => {
    const amounts = extractAmounts('不含税金额: ¥100.00 税额合计: ¥13.00');
    expect(amounts.amountIncludingTax).toBe('113.00');
    expect(amounts.usedHeuristic).toBe(false);
  });

  it('启发式对负数按绝对值寻找总额', () => {
    const amounts = extractAmounts('其他内容 ¥-100.00 ¥-13.00 ¥-113.00');
    expect(amounts.amountIncludingTax).toBe('-113.00');
    expect(amounts.taxAmount).toBe('-13.00');
    expect(amounts.usedHeuristic).toBe(true);
  });
});

describe('税率与项目名称', () => {
  it('提取单一税率', () => {
    expect(extractTaxRate('税率 13%')).toBe('13%');
  });

  it('保留多税率信息并去重', () => {
    expect(extractTaxRate('6% 13% 6%')).toBe('6%、13%');
  });

  it('识别免税', () => {
    expect(extractTaxRate('税率 免税')).toBe('免税');
  });

  it('多明细同时保留税率和免税信息', () => {
    expect(extractTaxRate('13% 免税')).toBe('13%、免税');
  });

  it('从明确标签提取项目名称', () => {
    expect(extractItemName('项目名称: *信息技术服务*软件服务 规格型号')).toBe('*信息技术服务*软件服务');
  });

  it('从完整明细表头后提取第一条星号分类项目名称', () => {
    expect(
      extractItemName(
        '项目名称 规格型号 单 位 数 量 单 价 金 额 税率/征收率 税额 *生活服务*餐费 1 247.17 247.17 6% 14.83 合计 ¥247.17 ¥14.83'
      )
    ).toBe('*生活服务*餐费');
  });

  it('使用视觉列边界只提取项目名称，不包含规格型号', () => {
    expect(
      extractItemName(
        '项目名称\t规格型号\t单位\t数量\t单价\t金额\t税率/征收率\t税额\n*软饮料*娃哈哈纯净水596ml*24瓶\t55ml*24瓶(纸箱装整箱)\t箱\t2\t28.85\t57.70\t13%\t7.50\n合计\t54.82\t7.12'
      )
    ).toBe('*软饮料*娃哈哈纯净水596ml*24瓶');
  });

  it('不会把明细表头本身识别成项目名称', () => {
    expect(extractItemName('项目名称 规格型号 单 位 数 量 单 价 金 额 税率/征收率 税额')).toBe('');
  });
});

describe('金额校验', () => {
  it('使用分级容差校验到分', () => {
    expect(validateAmountRelation('100.00', '13.00', '113.00')).toBe('valid');
    expect(validateAmountRelation('100.00', '13.00', '120.00')).toBe('invalid');
  });
});

describe('重复检测', () => {
  it('相同发票号码全部标记为重复', () => {
    const first = parseInvoiceText({
      sourceFileName: 'a.pdf',
      text: '发票号码: 12345678901234567890 开票日期: 2026年8月14日 合计 ¥100.00 ¥13.00 价税合计(小写)¥113.00'
    });
    const second = { ...first, id: 'second' };
    const result = markDuplicateRecords([first, second]);

    expect(result[0]?.duplicateStatus).toBe('duplicate');
    expect(result[1]?.duplicateStatus).toBe('duplicate');
  });
});

describe('parseInvoiceText', () => {
  it('生成可直接复核的完整记录', () => {
    const record = parseInvoiceText({
      sourceFileName: '2026.08.14-软件服务-113元.pdf',
      text: `
        电子发票（普通发票）
        发票号码: 12345678901234567890 开票日期: 2026年8月14日
        购买方信息 名称: 杭州测试科技有限公司 纳税人识别号: 91330100AAAABBBB11
        销售方信息 名称: 上海示例软件有限公司 纳税人识别号: 91310100CCCCDDDD22
        项目名称: *信息技术服务*软件服务 规格型号 单位 数量 单价 金额 税率 税额
        合计 ¥100.00 ¥13.00
        价税合计（小写）¥113.00
        税率 13%
      `
    });

    expect(record.invoiceNumber).toBe('12345678901234567890');
    expect(record.issueDate).toBe('2026-08-14');
    expect(record.buyerName).toBe('杭州测试科技有限公司');
    expect(record.sellerName).toBe('上海示例软件有限公司');
    expect(record.amountExcludingTax).toBe('100.00');
    expect(record.taxAmount).toBe('13.00');
    expect(record.amountIncludingTax).toBe('113.00');
    expect(record.taxRate).toBe('13%');
    expect(record.itemName).toBe('*信息技术服务*软件服务');
    expect(record.amountValidation).toBe('valid');
    expect(record.parseStatus).toBe('success');
  });

  it('文件名金额与发票总额不一致时标记复核信息', () => {
    const record = parseInvoiceText({
      sourceFileName: '2026.08.14-测试-120元.pdf',
      text: '发票号码: 12345678901234567890 开票日期: 2026年8月14日 合计 ¥100.00 ¥13.00 价税合计(小写)¥113.00'
    });

    expect(record.validationMessages).toContain('FILENAME_AMOUNT_MISMATCH');
    expect(record.remark).toContain('文件名金额 120.00');
    expect(record.parseStatus).toBe('review');
  });

  it('启发式金额即使数学关系自洽也要求人工复核', () => {
    const record = parseInvoiceText({
      sourceFileName: '测试.pdf',
      text: '发票号码: 12345678901234567890 开票日期: 2026年8月14日 其他内容 ¥100.00 ¥13.00 ¥113.00'
    });

    expect(record.validationMessages).toContain('AMOUNT_HEURISTIC_USED');
    expect(record.parseStatus).toBe('review');
  });

  it('没有有效文本层时返回失败', () => {
    const record = parseInvoiceText({ sourceFileName: 'scan.pdf', text: '图片' });
    expect(record.parseStatus).toBe('failed');
    expect(record.validationMessages).toContain('NO_TEXT_LAYER');
  });
});

describe('导出字段偏好', () => {
  it('清理未知和重复字段，并按字段注册表顺序恢复', async () => {
    const { sanitizeExportKeys } = await import('../index');
    expect(sanitizeExportKeys(['taxAmount', 'unknown', 'sourceFileName', 'taxAmount'])).toEqual([
      'sourceFileName',
      'taxAmount'
    ]);
  });

  it('无有效字段时回退到默认导出列', async () => {
    const { DEFAULT_EXPORT_KEYS, sanitizeExportKeys } = await import('../index');
    expect(sanitizeExportKeys(['unknown'])).toEqual(DEFAULT_EXPORT_KEYS);
  });
});
