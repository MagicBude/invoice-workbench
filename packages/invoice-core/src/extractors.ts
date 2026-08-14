function pad2(value: string): string {
  return value.padStart(2, '0');
}

function amountToFixed(value: string | undefined): string {
  if (!value) return '';
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
}

export function detectInvoiceType(text: string): string {
  if (/数电发票|全面数字化的电子发票/.test(text)) return '数电发票';
  if (/增值税专用发票/.test(text)) return '增值税专用发票';
  if (/增值税普通发票/.test(text)) return '增值税普通发票';
  if (/电子发票/.test(text)) return '电子发票';
  return '';
}

export function extractInvoiceNumber(text: string): string {
  const labeled = text.match(/发票号码\s*[:：]?\s*(\d{8,20})/);
  if (labeled?.[1]) return labeled[1];

  const twentyDigit = text.match(/(?:^|\D)(\d{20})(?:\D|$)/);
  return twentyDigit?.[1] ?? '';
}

export function extractIssueDate(text: string): string {
  let match = text.match(/开票日期\s*[:：]?\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!match) match = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (match) return `${match[1]}-${pad2(match[2] ?? '')}-${pad2(match[3] ?? '')}`;

  match = text.match(/开票日期\s*[:：]?\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return `${match[1]}-${pad2(match[2] ?? '')}-${pad2(match[3] ?? '')}`;

  return '';
}

export interface ExtractedAmounts {
  amountExcludingTax: string;
  taxAmount: string;
  amountIncludingTax: string;
  usedHeuristic: boolean;
}

export function extractAmounts(text: string): ExtractedAmounts {
  let amountIncludingTax = '';
  let amountExcludingTax = '';
  let taxAmount = '';
  let usedHeuristic = false;

  const totalPatterns = [
    /价税合计[^¥￥\d-]{0,20}(?:¥|￥)?\s*([+-]?[\d,]+\.\d{2})/,
    /(?:小写|小写\))[^¥￥\d-]{0,10}(?:¥|￥)?\s*([+-]?[\d,]+\.\d{2})/,
    /([+-]?[\d,]+\.\d{2})\s*[（(]?\s*小写/
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      amountIncludingTax = amountToFixed(match[1]);
      break;
    }
  }

  const taxMatch = text.match(/(?:税额|税\s*额)[^¥￥\d-]{0,12}(?:¥|￥)?\s*([+-]?[\d,]+\.\d{2})/);
  if (taxMatch?.[1]) taxAmount = amountToFixed(taxMatch[1]);

  const noTaxMatch = text.match(/(?:金额|合计)[^¥￥\d-]{0,12}(?:¥|￥)?\s*([+-]?[\d,]+\.\d{2})\s+(?:¥|￥)?\s*([+-]?[\d,]+\.\d{2})/);
  if (noTaxMatch?.[1] && noTaxMatch?.[2]) {
    amountExcludingTax = amountToFixed(noTaxMatch[1]);
    if (!taxAmount) taxAmount = amountToFixed(noTaxMatch[2]);
  }

  if (!amountIncludingTax || !taxAmount) {
    const amounts = [...text.matchAll(/(?:¥|￥)\s*([+-]?[\d,]+(?:\.\d{1,2})?)/g)]
      .map((match) => Number((match[1] ?? '').replace(/,/g, '')))
      .filter(Number.isFinite);

    if (amounts.length >= 2) {
      usedHeuristic = true;
      if (!amountIncludingTax) amountIncludingTax = Math.max(...amounts).toFixed(2);
      if (!taxAmount) taxAmount = Math.min(...amounts).toFixed(2);
    }
  }

  if (!amountExcludingTax && amountIncludingTax && taxAmount) {
    amountExcludingTax = (Number(amountIncludingTax) - Number(taxAmount)).toFixed(2);
  }

  return { amountExcludingTax, taxAmount, amountIncludingTax, usedHeuristic };
}

export function extractTaxRate(text: string): string {
  const match = text.match(/(?:税率|税\s*率)[^\d]{0,8}(\d+(?:\.\d+)?)\s*%/);
  return match?.[1] ? `${match[1]}%` : '';
}

export function extractSellerName(_text: string): string {
  // TODO: 需要结合更多真实发票样本与 PDF 文本顺序实现稳定规则。
  return '';
}

export function extractSellerTaxId(_text: string): string {
  return '';
}

export function extractBuyerName(_text: string): string {
  return '';
}

export function extractBuyerTaxId(_text: string): string {
  return '';
}

export function extractItemName(_text: string): string {
  return '';
}
