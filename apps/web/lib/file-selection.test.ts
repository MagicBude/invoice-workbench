import { describe, expect, it } from 'vitest';
import { isPdfFile, partitionPdfFiles } from './file-selection';

function mockFile(name: string, type: string): File {
  return { name, type } as File;
}

describe('isPdfFile', () => {
  it('接受标准 PDF MIME Type', () => {
    expect(isPdfFile(mockFile('invoice', 'application/pdf'))).toBe(true);
  });

  it('MIME Type 缺失时仍接受 .pdf 扩展名', () => {
    expect(isPdfFile(mockFile('invoice.PDF', ''))).toBe(true);
  });

  it('拒绝非 PDF 文件', () => {
    expect(isPdfFile(mockFile('invoice.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))).toBe(false);
  });
});

describe('partitionPdfFiles', () => {
  it('把 PDF 和非 PDF 分到不同集合', () => {
    const pdf = mockFile('a.pdf', 'application/pdf');
    const fallbackPdf = mockFile('b.PDF', '');
    const image = mockFile('c.png', 'image/png');

    const result = partitionPdfFiles([pdf, fallbackPdf, image]);

    expect(result.acceptedFiles).toEqual([pdf, fallbackPdf]);
    expect(result.rejectedFiles).toEqual([image]);
  });
});
