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

interface PartyValueParts {
  name: string;
  taxId: string;
}

/**
 * 把“公司名称 + 税号”这种被 PDF.js 拼成同一段的内容重新拆开。
 *
 * 部分电子发票的文本层不会稳定保留“统一社会信用代码/纳税人识别号”标签，
 * 但税号本身仍紧跟在公司名称后面。这里仅在尾部候选包含足够多数字、且长度
 * 符合税号特征时才拆分，避免误伤普通英文公司名。
 */
function splitPartyValue(value: string | undefined): PartyValueParts {
  const raw = cleanPartyName(value);
  if (!raw) return { name: '', taxId: '' };

  const trailing = raw.match(/((?:[0-9A-Z]\s*){15,20})\s*$/i);
  const taxId = normalizeTaxId(trailing?.[1]);
  const digitCount = (taxId.match(/\d/g) ?? []).length;

  if (!trailing || trailing.index == null || !taxId || digitCount < 8) {
    return { name: sanitizePartyName(raw), taxId: '' };
  }

  const namePart = raw.slice(0, trailing.index);
  return {
    name: sanitizePartyName(namePart),
    taxId
  };
}

const BUYER_HEADING = /购\s*买\s*方(?:\s*信\s*息)?/;
const SELLER_HEADING = /销\s*售\s*方(?:\s*信\s*息)?/;
const PARTY_NAME_LABEL = /名\s*称\s*[:：]/;
const PARTY_TAX_LABEL = /(?:统\s*一\s*社\s*会\s*信\s*用\s*代\s*码\s*\/?\s*纳\s*税\s*人\s*识\s*别\s*号|统\s*一\s*社\s*会\s*信\s*用\s*代\s*码|纳\s*税\s*人\s*识\s*别\s*号)\s*[:：]?/;
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
    /名\s*称\s*[:：]\s*([\s\S]{1,120}?)(?=\s*(?:统\s*一\s*社\s*会\s*信\s*用\s*代\s*码\s*\/?\s*纳\s*税\s*人\s*识\s*别\s*号|统\s*一\s*社\s*会\s*信\s*用\s*代\s*码|纳\s*税\s*人\s*识\s*别\s*号|地址\s*、?\s*电话|开户行及账号|开户行|销\s*售\s*方|购\s*买\s*方|项\s*目\s*名\s*称|货物或应税劳务|$))/
  );
  return splitPartyValue(match?.[1]).name;
}

function extractTaxIdFromSection(section: string): string {
  // 税号在 PDF 文本层中偶尔会被拆成带空格的单字符，因此允许字符间存在空白。
  const match = section.match(
    /(?:统\s*一\s*社\s*会\s*信\s*用\s*代\s*码\s*\/?\s*纳\s*税\s*人\s*识\s*别\s*号|统\s*一\s*社\s*会\s*信\s*用\s*代\s*码|纳\s*税\s*人\s*识\s*别\s*号)\s*[:：]?\s*((?:[0-9A-Z]\s*){15,20})/i
  );
  const labeledTaxId = normalizeTaxId(match?.[1]);
  if (labeledTaxId) return labeledTaxId;

  // 某些 PDF 文本层会丢掉税号标签，只留下“名称 + 税号”。
  const nameMatch = section.match(/名\s*称\s*[:：]\s*([\s\S]{1,160}?)(?=\s*(?:地址\s*、?\s*电话|开户行及账号|开户行|销\s*售\s*方|购\s*买\s*方|项\s*目\s*名\s*称|货物或应税劳务|$))/);
  return splitPartyValue(nameMatch?.[1]).taxId;
}

interface PartySlot {
  name: string;
  inlineTaxId: string;
}

function extractPartySlots(region: string): PartySlot[] {
  const values: PartySlot[] = [];
  const matches = [...region.matchAll(new RegExp(PARTY_NAME_LABEL.source, 'g'))];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    if (!current || current.index == null) continue;

    const start = current.index + current[0].length;
    const nextName = matches[index + 1]?.index ?? region.length;
    const segment = region.slice(start, nextName);
    const taxLabelIndex = findFirstIndex(segment, [PARTY_TAX_LABEL]);

    // 如果税号标签存在，名称只取标签之前；如果标签丢失，则允许从名称末尾拆税号。
    const nameRegion = taxLabelIndex >= 0 ? segment.slice(0, taxLabelIndex) : segment;
    const parts = splitPartyValue(nameRegion);

    values.push({
      name: parts.name,
      inlineTaxId: parts.taxId
    });
  }

  return values;
}

function extractLabeledPartyTaxIds(region: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(
    `${PARTY_TAX_LABEL.source}\\s*((?:[0-9A-Z]\\s*){15,20})`,
    'gi'
  );

  for (const match of region.matchAll(pattern)) {
    const taxId = normalizeTaxId(match[1]);
    if (taxId) values.push(taxId);
  }

  return values;
}


/**
 * 优先解析经过 PDF.js 坐标重排后的标准双栏购销方区域。
 *
 * 视觉重排会保留明显的列间距为制表符，因此标准电子发票通常会形成：
 *
 * 购买方信息\t销售方信息
 * 名称：购买方名称\t名称：销售方名称
 * 统一社会信用代码/纳税人识别号：购买方税号\t...：销售方税号
 *
 * 这种结构比“把整段文本交给跨行正则”可靠得多，因此作为第一优先级。
 */
function extractPartySlotsFromVisualLine(line: string): PartySlot[] {
  const matches = [...line.matchAll(/名\s*称\s*[:：]?/g)];
  const values: PartySlot[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    if (!current || current.index == null) continue;

    const start = current.index + current[0].length;
    const end = matches[index + 1]?.index ?? line.length;
    let segment = line.slice(start, end);

    // 顺序布局可能把“名称 + 税号标签 + 税号”放在同一视觉行。
    // 名称必须在税号标签之前截断，否则 sanitizePartyName 会因为包含字段标签而拒绝整段。
    const taxLabelIndex = findFirstIndex(segment, [PARTY_TAX_LABEL]);
    if (taxLabelIndex >= 0) segment = segment.slice(0, taxLabelIndex);

    // PDF.js 可能把“名称：”“公司名称”拆成两个相邻文本对象，
    // 视觉重排后会表现为制表符分列。只取标签后的第一个非空列。
    const candidate =
      segment
        .split(/\t+/)
        .map((part) => part.trim())
        .find(Boolean) ?? '';

    // 不只保留名称，还要保留 splitPartyValue() 同时拆出的尾部税号。
    // 否则“名称 + 税号（标签丢失）”场景会在视觉双栏优先分支中丢掉税号。
    const parts = splitPartyValue(candidate);
    values.push({ name: parts.name, inlineTaxId: parts.taxId });
  }

  return values;
}

function extractPartyTaxIdsFromVisualLine(line: string): string[] {
  const labelPattern = new RegExp(PARTY_TAX_LABEL.source, 'gi');
  const matches = [...line.matchAll(labelPattern)];
  const values: string[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    if (!current || current.index == null) continue;

    const start = current.index + current[0].length;
    const end = matches[index + 1]?.index ?? line.length;
    const segment = line.slice(start, end);

    // 税号也可能被拆成“标签<TAB>号码”。从标签后的第一个合法 15~20 位
    // 字母数字串中提取，而不是要求标签和值必须处在同一个文本对象里。
    const candidate =
      segment
        .split(/\t+/)
        .map((part) => part.trim())
        .find((part) => normalizeTaxId(part) !== '') ?? '';

    const taxId = normalizeTaxId(candidate);

    // 同一视觉行出现两组税号标签时必须保留空槽位，确保左右列不发生错位。
    // 只有一个标签且后面没有合法税号时，更可能只是“名称”里的错误候选标签，忽略即可。
    if (matches.length >= 2) values.push(taxId);
    else if (taxId) values.push(taxId);
  }

  return values;
}

/**
 * 优先解析经过 PDF.js 坐标重排后的标准双栏购销方区域。
 *
 * 关键点：发票上的“购买方信息 / 销售方信息”通常是竖排文字，PDF.js 恢复
 * 视觉顺序后很可能被拆成多个单字行，因此这里不再依赖这两个标题。
 *
 * 标准电子发票在明细表头之前通常稳定存在两组：
 * - 名称：购买方名称 / 名称：销售方名称
 * - 统一社会信用代码/纳税人识别号：购买方税号 / 销售方税号
 *
 * 按页面视觉顺序从左到右收集两组值，比依赖竖排标题可靠得多。
 */
function extractPartyFieldsFromVisualRows(text: string): ExtractedPartyFields | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const itemHeaderIndex = lines.findIndex((line) =>
    LINE_ITEM_HEADINGS.some((pattern) => pattern.test(line))
  );

  // 只在明细表头之前寻找购销方信息，避免把商品明细或备注中的“名称”误当公司名称。
  const regionLines = itemHeaderIndex >= 0 ? lines.slice(0, itemHeaderIndex) : lines;

  const slots: PartySlot[] = [];
  const labeledTaxIds: string[] = [];

  for (const line of regionLines) {
    slots.push(...extractPartySlotsFromVisualLine(line));
    labeledTaxIds.push(...extractPartyTaxIdsFromVisualLine(line));
  }

  // 标准双栏必须至少能稳定取得两组名称槽位或两组带标签税号，才按视觉顺序分配。
  // 只有一组时无法可靠判断属于购买方还是销售方，交给后面的兼容 fallback。
  if (slots.length < 2 && labeledTaxIds.length < 2) return null;

  const buyerSlot = slots[0];
  const sellerSlot = slots[1];

  return {
    buyerName: buyerSlot?.name ?? '',
    sellerName: sellerSlot?.name ?? '',
    // 税号标签丢失时优先使用名称尾部拆出的 inlineTaxId；
    // 有明确税号标签时，再按左右视觉顺序使用 labeledTaxIds。
    buyerTaxId: buyerSlot?.inlineTaxId || labeledTaxIds[0] || '',
    sellerTaxId: sellerSlot?.inlineTaxId || labeledTaxIds[1] || ''
  };
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
  const visualRows = extractPartyFieldsFromVisualRows(text);
  if (visualRows) return visualRows;

  const buyerHeadingIndex = findFirstIndex(text, [BUYER_HEADING]);
  const sellerHeadingIndex = findFirstIndex(text, [SELLER_HEADING]);
  const headingIndexes = [buyerHeadingIndex, sellerHeadingIndex].filter((index) => index >= 0);
  const regionStart = headingIndexes.length ? Math.min(...headingIndexes) : -1;
  const regionEnd = regionStart >= 0 ? findFirstIndex(text, LINE_ITEM_HEADINGS, regionStart) : -1;

  if (regionStart >= 0) {
    const region = text.slice(regionStart, regionEnd === -1 ? text.length : regionEnd);
    const slots = extractPartySlots(region);

    // 标准电子发票的购销方区域通常会出现两组“名称”。只要能稳定找到两个槽位，
    // 就按页面从左到右 / 从上到下的视觉顺序分别对应购买方和销售方。
    // PDF 文本在进入 invoice-core 前已经按坐标恢复视觉顺序，因此不再依赖内容流顺序。
    if (slots.length >= 2) {
      const labeledTaxIds = extractLabeledPartyTaxIds(region);
      const first = slots[0];
      const second = slots[1];

      // 只有明确拿到两组带标签税号时才按顺序分配，避免“购买方税号缺失、只有销售方税号”
      // 时把唯一税号错误塞进购买方。名称尾部直接带税号的情况则由 inlineTaxId 独立处理。
      const hasTwoLabeledTaxIds = labeledTaxIds.length >= 2;

      return {
        buyerName: first?.name ?? '',
        sellerName: second?.name ?? '',
        buyerTaxId: first?.inlineTaxId || (hasTwoLabeledTaxIds ? labeledTaxIds[0] ?? '' : ''),
        sellerTaxId: second?.inlineTaxId || (hasTwoLabeledTaxIds ? labeledTaxIds[1] ?? '' : '')
      };
    }
  }

  // 少数非标准版式只有一方信息，或标题/字段不是标准双栏结构。
  // 这时退回按“购买方区段 / 销售方区段”分别提取，宁可缺失，也不跨区补值。
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
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  // “项目名称:”只在同一视觉行内读取，禁止跨行向后吞文本。
  // 这样即使 PDF 内容流顺序异常，也不会把发票标题、购销方字段等整段内容吃进来。
  for (const line of lines) {
    const explicit = line.match(
      /项\s*目\s*名\s*称\s*[:：]\s*(.{2,120}?)(?=\s+(?:规\s*格\s*型\s*号|单\s*位|数\s*量|单\s*价|金\s*额|税\s*率|税\s*额)|$)/
    );
    const value = cleanPartyName(explicit?.[1]);
    if (value) return value;
  }

  const headerWords = ['项目名称', '规格型号', '单位', '数量', '单价', '金额', '税额'];
  const compactLine = (line: string) => line.replace(/\s+/g, '');
  const headerIndex = lines.findIndex((line) => {
    const compact = compactLine(line);
    return headerWords.filter((word) => compact.includes(word)).length >= 5;
  });

  if (headerIndex >= 0) {
    // PDF.js 在少数版式中会把“明细表头 + 第一条明细”拼在同一个视觉行里。
    // 先尝试从完整表头的末尾切出同一行剩余内容，再继续处理正常的后续明细行。
    const detailLines: string[] = [];
    const headerLine = lines[headerIndex] ?? '';
    const inlineDetailMatch = headerLine.match(
      /项\s*目\s*名\s*称\s+规\s*格\s*型\s*号\s+单\s*位\s+数\s*量\s+单\s*价\s+金\s*额\s+税\s*率(?:\s*\/\s*征\s*收\s*率)?\s+税\s*额\s+([\s\S]+)$/
    );
    if (inlineDetailMatch?.[1]) {
      detailLines.push(inlineDetailMatch[1].trim());
    }

    // 明细第一行通常就在表头之后。允许项目名称因换行占用后续几行，但在“合计”之前停止。
    for (let index = headerIndex + 1; index < Math.min(lines.length, headerIndex + 8); index += 1) {
      const line = lines[index];
      if (!line) continue;
      const compact = compactLine(line);
      if (/^合计/.test(compact) || compact.includes('价税合计')) break;
      if (headerWords.filter((word) => compact.includes(word)).length >= 3) continue;
      detailLines.push(line);
    }

    for (const line of detailLines) {
      const firstColumn = (line.split('\t')[0] ?? '').trim();

      // 数电票最常见、也最稳定的项目结构，例如：*生活服务*餐费。
      // 如果 PDF 文本层保留了列间距，优先只看“项目名称”第一列。
      const classifiedItem = line.includes('\t')
        ? firstColumn.match(/^\s*(\*[^*\n]{1,50}\*.+)$/)
        : null;
      if (classifiedItem?.[1]) return cleanPartyName(classifiedItem[1]);

      const lineClassifiedItem = line.match(
        /^\s*(\*[^*\n]{1,50}\*.*?)(?=\t|\s+(?:[+-]?\d+(?:[.,]\d+)?|¥\s*[+-]?\d))/
      );
      if (lineClassifiedItem?.[1]) return cleanPartyName(lineClassifiedItem[1]);
    }

    const firstLine = detailLines[0] ?? '';
    if (firstLine) {
      // 无星号分类时，优先使用视觉第一列；没有列分隔时才退回数字边界规则。
      const firstColumn = (firstLine.split('\t')[0] ?? '').trim();
      const fallbackMatch = firstLine.match(
        /^\s*(.{2,120}?)(?=\s+(?:[+-]?\d+(?:[.,]\d+)?|¥\s*[+-]?\d))/
      );
      let candidate = cleanPartyName(firstLine.includes('\t') ? firstColumn : fallbackMatch?.[1]);
      candidate = candidate.replace(/\s+(?:件|项|次|个|套|台|批|月|年|小时|天|米|吨|千克|公斤|箱)$/u, '');

      const compact = compactLine(candidate);
      const looksLikeHeader = headerWords.some((word) => compact.includes(word));
      if (candidate && !looksLikeHeader) return candidate;
    }
  }

  return '';
}
