/**
 * 统一 PDF 文本中的常见字符差异，同时尽量保留换行结构。
 *
 * PDF.js 从不同开票系统中读取出的字符可能包含全角数字、全角标点、
 * 不同形态的破折号和不可见字符。解析前统一这些差异，可以让后续
 * 正则规则更专注于“字段结构”，而不是重复兼容字符编码问题。
 */
export function normalizeInvoiceText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[⽉]/g, '月')
    .replace(/[⽇]/g, '日')
    .replace(/[￥]/g, '¥')
    .replace(/[—–−]/g, '-')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/[\u00a0\u3000\t\f\v]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
