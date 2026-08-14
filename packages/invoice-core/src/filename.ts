function pad2(value: string | number): string {
  return String(value).padStart(2, '0');
}

export interface FilenameMetadata {
  date: string;
  name: string;
  expectedAmount: string;
}

export function parseFilenameMetadata(fileName: string): FilenameMetadata {
  const base = fileName.replace(/\.pdf$/i, '').trim();
  let date = '';
  let name = base;

  let match = base.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[-_\s]?)([\s\S]*)$/);
  if (match) {
    date = `${match[1]}-${pad2(match[2] ?? '')}-${pad2(match[3] ?? '')}`;
    name = (match[4] ?? '').replace(/^[-_\s]+/, '').trim() || base;
  } else {
    // 常见的批量整理文件名会直接使用 YYYYMMDD，例如：20260721-财务小推车.pdf。
    // 单独支持这种格式，避免把文件名日期与发票正文中的“开票日期”混为一谈。
    match = base.match(/^(\d{4})(\d{2})(\d{2})(?:[-_\s]?)([\s\S]*)$/);
    if (match) {
      date = `${match[1]}-${pad2(match[2] ?? '')}-${pad2(match[3] ?? '')}`;
      name = (match[4] ?? '').replace(/^[-_\s]+/, '').trim() || base;
    } else {
      match = base.match(/^(\d{2})(\d{2})(\d{2})[-_]([\s\S]*)$/);
      if (match) {
        date = `${2000 + Number(match[1])}-${pad2(match[2] ?? '')}-${pad2(match[3] ?? '')}`;
        name = (match[4] ?? '').trim() || base;
      }
    }
  }

  const amountMatch = base.match(/(?:¥|￥)?\s*(\d+(?:\.\d{1,2})?)\s*元/);
  const expectedAmount = amountMatch?.[1] ?? '';

  return { date, name, expectedAmount };
}
