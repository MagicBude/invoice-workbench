function pad2(value: string): string {
  return value.padStart(2, '0');
}

function amountToFixed(value: string | undefined): string {
  if (!value) return '';
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
}

function formatDateParts(year: string, month: string, day: string): string {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '';
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return '';

  // 使用 UTC 构造日期，避免本地时区在日期边界上造成额外偏移。
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return '';
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function findFirstIndex(text: string, patterns: readonly RegExp[], fromIndex = 0): number {
  let result = -1;
  const source = text.slice(fromIndex);

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.index == null) continue;
    const index = fromIndex + match.index;
    if (result === -1 || index < result) result = index;
  }

  return result;
}

function cleanPartyName(value: string | undefined): string {
  return (value ?? '')
    .replace(/^[\s:：]+/, '')
    .replace(/[\s:：]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PARTY_NAME_FORBIDDEN_TEXT = [
  '购买方',
  '购买方信息',
  '销售方',
  '销售方信息',
  '统一社会信用代码',
  '纳税人识别号',
  '地址、电话',
  '地址电话',
  '开户行及账号',
  '开户行',
  '发票号码',
  '开票日期',
  '项目名称',
  '规格型号',
  '单位',
  '数量',
  '单价',
  '税率',
  '税额'
] as const;

/**
 * 过滤购销方名称候选值。
 *
 * PDF.js 有时会把双栏布局的字段标签和字段值打乱，导致“名称”“购买方信息”
 * 或税号标签本身被误当成公司名称。这里采用保守策略：宁可留空，也不把
 * 明显的标签、日期或长数字串作为名称展示给用户。
 */
function sanitizePartyName(value: string | undefined): string {
  const cleaned = cleanPartyName(value);
  if (!cleaned) return '';

  const compact = cleaned.replace(/\s+/g, '');
  if (compact.length < 2 || compact.length > 100) return '';
  if (compact === '名称') return '';

  if (PARTY_NAME_FORBIDDEN_TEXT.some((label) => compact === label || compact.startsWith(`${label}:`))) {
    return '';
  }

  if (PARTY_NAME_FORBIDDEN_TEXT.some((label) => compact.includes(label) && label.length >= 4)) {
    return '';
  }

  // 公司名称或个人名称至少应包含一定数量的中文或英文字母。
  // 这样可以拦截“2631700000...2026年...”一类号码与日期拼接结果。
  const letterCount = (compact.match(/[A-Za-z\u3400-\u9fff]/g) ?? []).length;
  const digitCount = (compact.match(/\d/g) ?? []).length;
  if (letterCount < 2) return '';
  if (digitCount >= 8 && digitCount > letterCount * 2) return '';

  if (/^\d{4}[-/.]?\d{1,2}[-/.]?\d{1,2}/.test(compact)) return '';
  if (/^\d{8,20}/.test(compact) && letterCount < 6) return '';

  return cleaned;
}

function normalizeTaxId(value: string | undefined): string {
  const normalized = (value ?? '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
  return normalized.length >= 15 && normalized.length <= 20 ? normalized : '';
}

const BUYER_HEADING = /购\s*买\s*方(?:\s*信\s*息)?/;
const SELLER_HEADING = /销\s*售\s*方(?:\s*信\s*息)?/;
const PARTY_NAME_LABEL = /名\s*称\s*:/;
const PARTY_TAX_LABEL = /(?:统一社会信用代码\s*\/?\s*纳税人识别号|统一社会信用代码|纳税人识别号)\s*:/;
const LINE_ITEM_HEADINGS = [
  /项\s*目\s*名\s*称/,
  /货物或应税劳务、服务名称/,
  /货物或应税劳务名称/,
  /规\s*格\s*型\s*号/
] as const;

function getSection(text: string, startPattern: RegExp, endPatterns: readonly RegExp[]): string {
  const startMatch = text.match(startPattern);
  if (startMatch?.index == null) return '';

  const contentStart = startMatch.index + startMatch[0].length;
  const end = findFirstIndex(text, endPatterns, contentStart);
  return text.slice(contentStart, end === -1 ? text.length : end);
}

function extractNameFromSection(section: string): string {
  // 名称后面优先以税号、地址或账户等下一个字段标签作为边界，
  // 避免在 PDF.js 将一整行拼成字符串时把后续字段一起吃进名称。
  const match = section.match(
    /名\s*称\s*:\s*([\s\S]{1,120}?)(?=\s*(?:统一社会信用代码\s*\/?\s*纳税人识别号|统一社会信用代码|纳税人识别号|地址\s*、?\s*电话|开户行及账号|开户行|销\s*售\s*方|购\s*买\s*方|项\s*目\s*名\s*称|货物或应税劳务|$))/
  );
  return sanitizePartyName(match?.[1]);
}

function extractTaxIdFromSection(section: string): string {
  // 税号在 PDF 文本层中偶尔会被拆成带空格的单字符，因此允许字符间存在空白。
  const match = section.match(
    /(?:统一社会信用代码\s*\/?\s*纳税人识别号|统一社会信用代码|纳税人识别号)\s*:\s*((?:[0-9A-Z]\s*){15,20})/i
  );
  return normalizeTaxId(match?.[1]);
}

function extractAllPartyNames(region: string): string[] {
  const values: string[] = [];
  const matches = [...region.matchAll(new RegExp(PARTY_NAME_LABEL.source, 'g'))];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    if (!current || current.index == null) continue;
    const start = current.index + current[0].length;
    const nextName = matches[index + 1]?.index ?? region.length;
    const nextTax = findFirstIndex(region, [PARTY_TAX_LABEL], start);
    const endCandidates = [nextName, nextTax].filter((value) => value >= start);
    const end = endCandidates.length ? Math.min(...endCandidates) : region.length;

    // 不过滤数组位置，只过滤当前位置的值。
    // 双栏布局中如果购买方名称缺失，销售方名称不能因此左移成购买方名称。
    values.push(sanitizePartyName(region.slice(start, end)));
  }

  return values;
}

function extractAllPartyTaxIds(region: string): string[] {
  const values: string[] = [];
  const matches = [...region.matchAll(new RegExp(PARTY_TAX_LABEL.source, 'g'))];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    if (!current || current.index == null) continue;
    const start = current.index + current[0].length;
    const nextTax = matches[index + 1]?.index ?? region.length;
    const nextName = findFirstIndex(region, [PARTY_NAME_LABEL], start);
    const endCandidates = [nextTax, nextName].filter((value) => value >= start);
    const end = endCandidates.length ? Math.min(...endCandidates) : region.length;
    const candidate = region.slice(start, end).match(/(?:[0-9A-Z]\s*){15,20}/i)?.[0];

    // 与名称一样保留槽位：第一组税号无效时，不把第二组税号补到第一组。
    values.push(normalizeTaxId(candidate));
  }

  return values;
}

export interface ExtractedPartyFields {
  sellerName: string;
  sellerTaxId: string;
  buyerName: string;
  buyerTaxId: string;
}

/**
 * 提取购销双方信息。
 *
 * 电子发票 PDF 的文本顺序主要有两类：
 * 1. 顺序布局：购买方标题 → 购买方字段 → 销售方标题 → 销售方字段；
 * 2. 双栏布局：购买方标题和销售方标题先出现，再依次出现两组“名称 / 税号”。
 *
 * 这里先判断标题是否都位于第一个字段标签之前，以区分双栏布局，再选择对应策略。
 */
export function extractPartyFields(text: string): ExtractedPartyFields {
  const buyerHeadingIndex = findFirstIndex(text, [BUYER_HEADING]);
  const sellerHeadingIndex = findFirstIndex(text, [SELLER_HEADING]);
  const firstNameIndex = findFirstIndex(text, [PARTY_NAME_LABEL]);
  const firstTaxIndex = findFirstIndex(text, [PARTY_TAX_LABEL]);
  const firstFieldIndex = [firstNameIndex, firstTaxIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;

  const headingsAreParallel =
    buyerHeadingIndex >= 0 &&
    sellerHeadingIndex >= 0 &&
    firstFieldIndex >= 0 &&
    buyerHeadingIndex < firstFieldIndex &&
    sellerHeadingIndex < firstFieldIndex;

  if (headingsAreParallel) {
    const regionStart = Math.min(buyerHeadingIndex, sellerHeadingIndex);
    const regionEnd = findFirstIndex(text, LINE_ITEM_HEADINGS, firstFieldIndex);
    const region = text.slice(regionStart, regionEnd === -1 ? text.length : regionEnd);
    const names = extractAllPartyNames(region);
    const taxIds = extractAllPartyTaxIds(region);

    return {
      buyerName: names[0] ?? '',
      sellerName: names[1] ?? '',
      buyerTaxId: taxIds[0] ?? '',
      sellerTaxId: taxIds[1] ?? ''
    };
  }

  const buyerSection = getSection(text, BUYER_HEADING, [SELLER_HEADING, ...LINE_ITEM_HEADINGS]);
  const sellerSection = getSection(text, SELLER_HEADING, LINE_ITEM_HEADINGS);

  return {
    buyerName: extractNameFromSection(buyerSection),
    buyerTaxId: extractTaxIdFromSection(buyerSection),
    sellerName: extractNameFromSection(sellerSection),
    sellerTaxId: extractTaxIdFromSection(sellerSection)
  };
}

export function detectInvoiceType(text: string): string {
  if (/电子发票\s*[（(]\s*增值税专用发票\s*[）)]/.test(text)) return '电子发票（增值税专用发票）';
  if (/电子发票\s*[（(]\s*普通发票\s*[）)]/.test(text)) return '电子发票（普通发票）';
  if (/数电发票|全面数字化的电子发票/.test(text)) return '数电发票';
  if (/增值税专用发票/.test(text)) return '增值税专用发票';
  if (/增值税(?:电子)?普通发票/.test(text)) return '增值税普通发票';
  if (/电子发票/.test(text)) return '电子发票';
  return '';
}

export function extractInvoiceNumber(text: string): string {
  // 标签优先。允许 PDF.js 在号码数字之间插入空格。
  const labeled = text.match(/发\s*票\s*号\s*码\s*[:：]?\s*((?:\d\s*){8,20})/);
  if (labeled?.[1]) {
    const value = labeled[1].replace(/\s/g, '');
    if (value.length >= 8 && value.length <= 20) return value;
  }

  // 无标签时只兜底识别 20 位号码，降低把金额、日期或税号误认成发票号码的风险。
  const twentyDigit = text.match(/(?:^|\D)((?:\d\s*){20})(?:\D|$)/);
  return twentyDigit?.[1]?.replace(/\s/g, '') ?? '';
}

export function extractIssueDate(text: string): string {
  const patterns = [
    /开\s*票\s*日\s*期\s*[:：]?\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
    /开\s*票\s*日\s*期\s*[:：]?\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
    /开\s*票\s*日\s*期\s*[:：]?\s*(\d{4})(\d{2})(\d{2})/,
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/
  ] as const;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = formatDateParts(match[1] ?? '', match[2] ?? '', match[3] ?? '');
    if (value) return value;
  }

  return '';
}

export interface ExtractedAmounts {
  amountExcludingTax: string;
  taxAmount: string;
  amountIncludingTax: string;
  usedHeuristic: boolean;
}

function extractSubtotalPair(text: string): { amountExcludingTax: string; taxAmount: string } {
  const patterns = [
    /(?:^|\s)合\s*计\s*(?:¥\s*)?([+-]?[\d,]+\.\d{2})\s+(?:¥\s*)?([+-]?[\d,]+\.\d{2})(?=\s|$)/,
    /金额合计\s*:?\s*(?:¥\s*)?([+-]?[\d,]+\.\d{2})[\s,;，；]+(?:税额合计|合计税额)\s*:?\s*(?:¥\s*)?([+-]?[\d,]+\.\d{2})/
  ] as const;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return {
        amountExcludingTax: amountToFixed(match[1]),
        taxAmount: amountToFixed(match[2])
      };
    }
  }

  return { amountExcludingTax: '', taxAmount: '' };
}

function extractCurrencyValues(text: string): number[] {
  return [...text.matchAll(/(?:¥)\s*([+-]?[\d,]+(?:\.\d{1,2})?)/g)]
    .map((match) => Number((match[1] ?? '').replace(/,/g, '')))
    .filter(Number.isFinite);
}

export function extractAmounts(text: string): ExtractedAmounts {
  let amountIncludingTax = '';
  let amountExcludingTax = '';
  let taxAmount = '';
  let usedHeuristic = false;

  const subtotal = extractSubtotalPair(text);
  amountExcludingTax = subtotal.amountExcludingTax;
  taxAmount = subtotal.taxAmount;

  const totalPatterns = [
    /价\s*税\s*合\s*计[\s\S]{0,60}?(?:小\s*写\s*)?\)?\s*:?\s*(?:¥\s*)?([+-]?[\d,]+\.\d{2})/,
    /(?:小\s*写)\s*\)?\s*:?\s*(?:¥\s*)?([+-]?[\d,]+\.\d{2})/,
    /([+-]?[\d,]+\.\d{2})\s*\(?\s*小\s*写/
  ] as const;

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      amountIncludingTax = amountToFixed(match[1]);
      break;
    }
  }

  if (!amountExcludingTax) {
    const match = text.match(/(?:不含税金额|金额合计|合计金额)\s*:?\s*(?:¥\s*)?([+-]?[\d,]+\.\d{2})/);
    if (match?.[1]) amountExcludingTax = amountToFixed(match[1]);
  }

  if (!taxAmount) {
    const match = text.match(/(?:税额合计|合计税额)\s*:?\s*(?:¥\s*)?([+-]?[\d,]+\.\d{2})/);
    if (match?.[1]) taxAmount = amountToFixed(match[1]);
  }

  // 如果三项中已经可靠识别出两项，优先通过数学关系补齐第三项。
  // 这比从整张发票所有金额中猜“最大值 / 最小值”更可靠。
  if (!amountIncludingTax && amountExcludingTax && taxAmount) {
    amountIncludingTax = (Number(amountExcludingTax) + Number(taxAmount)).toFixed(2);
  }
  if (!amountExcludingTax && amountIncludingTax && taxAmount) {
    amountExcludingTax = (Number(amountIncludingTax) - Number(taxAmount)).toFixed(2);
  }
  if (!taxAmount && amountIncludingTax && amountExcludingTax) {
    taxAmount = (Number(amountIncludingTax) - Number(amountExcludingTax)).toFixed(2);
  }

  if (!amountIncludingTax || !taxAmount) {
    const values = extractCurrencyValues(text);

    if (values.length >= 2 && !amountIncludingTax) {
      usedHeuristic = true;
      const totalCandidate = [...values].sort((a, b) => Math.abs(b) - Math.abs(a))[0];
      if (totalCandidate != null) amountIncludingTax = totalCandidate.toFixed(2);
    }

    // 至少出现 3 个带货币符号的金额时才兜底猜税额，避免仅有两个金额时误判。
    if (values.length >= 3 && !taxAmount) {
      usedHeuristic = true;
      const taxCandidate = [...values].sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      if (taxCandidate != null) taxAmount = taxCandidate.toFixed(2);
    }
  }

  if (!amountExcludingTax && amountIncludingTax && taxAmount) {
    amountExcludingTax = (Number(amountIncludingTax) - Number(taxAmount)).toFixed(2);
  }

  return { amountExcludingTax, taxAmount, amountIncludingTax, usedHeuristic };
}

export function extractTaxRate(text: string): string {
  const rates = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value))
    .map((rate) => `${rate}%`);

  // 多明细发票可能同时包含不同税率、免税或不征税项目，
  // 因此这里保留所有去重后的税率信息，而不是只取第一个值。
  if (/免税/.test(text)) rates.push('免税');
  if (/不征税/.test(text)) rates.push('不征税');

  return [...new Set(rates)].join('、');
}

export function extractSellerName(text: string): string {
  return extractPartyFields(text).sellerName;
}

export function extractSellerTaxId(text: string): string {
  return extractPartyFields(text).sellerTaxId;
}

export function extractBuyerName(text: string): string {
  return extractPartyFields(text).buyerName;
}

export function extractBuyerTaxId(text: string): string {
  return extractPartyFields(text).buyerTaxId;
}

export function extractItemName(text: string): string {
  const explicit = text.match(
    /项\s*目\s*名\s*称\s*:?\s*([^\n]{2,100}?)(?=\s*(?:规格型号|单位|数量|单价|金额|税率|税额|合\s*计|$))/
  );
  const explicitValue = cleanPartyName(explicit?.[1]);
  if (explicitValue && !/^(规格型号|单位|数量|单价|金额|税率|税额)$/.test(explicitValue)) {
    return explicitValue;
  }

  // 常见数电票会先输出整行表头，再输出第一条明细：
  // “项目名称 规格型号 单位 ... 税额 *服务*软件服务 项 1 ...”。
  // 因此在最后一个表头“税额”之后截取第一段非数字内容作为项目名称兜底。
  const header = text.match(/项\s*目\s*名\s*称[\s\S]{0,160}?税\s*额/);
  if (header?.index != null) {
    const tail = text.slice(header.index + header[0].length, header.index + header[0].length + 240);
    const beforeSummary = tail.split(/\s+合\s*计\b/)[0] ?? '';
    const candidateMatch = beforeSummary.match(/^\s*([^\n]{2,100}?)(?=\s+[+-]?\d[\d,.]*\s|$)/);
    let candidate = cleanPartyName(candidateMatch?.[1]);
    candidate = candidate.replace(/\s+(?:件|项|次|个|套|台|批|月|年|小时|天|米|吨|千克|公斤)$/u, '');
    if (candidate && !/^(规格型号|单位|数量|单价|金额|税率|税额)$/.test(candidate)) {
      return candidate;
    }
  }

  return '';
}
