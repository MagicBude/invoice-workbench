import { buildVisualPageText } from './pdf-layout';

/**
 * PDF 文本层提取模块。
 *
 * 第一阶段只处理 PDF 自带的文本层，不执行 OCR。整个读取过程发生在
 * 浏览器本地：File.arrayBuffer() 只会读取用户主动选择的本地文件，
 * 不会因为调用该 API 自动上传到服务器。
 */

export const MIN_USABLE_TEXT_CHARACTERS = 20;

export type PdfReadErrorCode =
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PDF'
  | 'MISSING_PDF'
  | 'READ_FAILED';

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  textPageCount: number;
  characterCount: number;
  hasUsableTextLayer: boolean;
}

/**
 * 把 PDF.js 的底层异常转换成界面可以理解的稳定错误类型。
 */
export class PdfTextExtractionError extends Error {
  readonly code: PdfReadErrorCode;

  constructor(code: PdfReadErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PdfTextExtractionError';
    this.code = code;
  }
}

function countMeaningfulCharacters(text: string): number {
  return text.replace(/\s/g, '').length;
}

function toPdfReadError(error: unknown): PdfTextExtractionError {
  if (error instanceof PdfTextExtractionError) return error;

  const errorName = error instanceof Error ? error.name : '';
  const cause = error instanceof Error ? error : undefined;

  if (errorName === 'PasswordException') {
    return new PdfTextExtractionError(
      'PASSWORD_REQUIRED',
      'PDF 已加密或需要密码，当前版本暂不支持读取。',
      { cause }
    );
  }

  if (errorName === 'InvalidPDFException') {
    return new PdfTextExtractionError('INVALID_PDF', 'PDF 文件无效或已经损坏。', { cause });
  }

  if (errorName === 'MissingPDFException') {
    return new PdfTextExtractionError('MISSING_PDF', '无法读取该 PDF 文件。', { cause });
  }

  return new PdfTextExtractionError(
    'READ_FAILED',
    error instanceof Error && error.message ? `PDF 读取失败：${error.message}` : 'PDF 读取失败。',
    { cause }
  );
}

/**
 * 从一份本地 PDF 中读取全部页面的文本层。
 *
 * PDF.js 页码从 1 开始，因此循环边界与普通 JavaScript 数组索引不同。
 * 函数同时返回页数和有效文本页数，后续可以据此判断“扫描件 / 图片 PDF”。
 */
export async function extractPdfText(file: File): Promise<PdfTextExtractionResult> {
  const pdfjs = await import('pdfjs-dist');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  // PDF.js 使用独立 Worker 解析 PDF，避免把较重的解析工作全部压在 UI 主线程上。
  // 构建脚本会把 Worker 文件复制到 public 目录，因此 GitHub Pages 也能直接访问。
  pdfjs.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;

  try {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data });
    const document = await loadingTask.promise;

    try {
      const pageTexts: string[] = [];
      let textPageCount = 0;

      // 这里刻意逐页读取，而不是一次并发解析所有页面。
      // 发票通常页数很少，顺序处理可以降低批量导入大量文件时的瞬时内存占用。
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();

        // NOTE: TextContent.items 的数组顺序来自 PDF 内容流，并不保证等于页面上的
        // 视觉阅读顺序。发票含有双栏购销方和明细表，如果直接 join(' ')，很容易
        // 把销售方税号拼到购买方、或把明细表头拼到项目名称。这里先按 X/Y 坐标
        // 恢复视觉行，再交给发票规则解析。
        const pageText = buildVisualPageText(content.items).trim();

        if (countMeaningfulCharacters(pageText) > 0) {
          textPageCount += 1;
        }

        pageTexts.push(pageText);
        page.cleanup();
      }

      const text = pageTexts.join('\n').trim();
      const characterCount = countMeaningfulCharacters(text);

      return {
        text,
        pageCount: document.numPages,
        textPageCount,
        characterCount,
        hasUsableTextLayer: characterCount >= MIN_USABLE_TEXT_CHARACTERS
      };
    } finally {
      // destroy() 会释放 PDF.js 文档关联资源。批量处理大量文件时及时释放尤为重要。
      await document.destroy();
    }
  } catch (error) {
    throw toPdfReadError(error);
  }
}
