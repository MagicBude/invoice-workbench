export function normalizeInvoiceText(input: string): string {
  return input
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[⽉]/g, '月')
    .replace(/[⽇]/g, '日')
    .replace(/：/g, ':')
    .replace(/￥/g, '¥')
    .replace(/[\u00a0\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}
