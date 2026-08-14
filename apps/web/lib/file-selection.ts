/**
 * 文件选择相关的纯函数。
 *
 * 把文件过滤逻辑放在 React 组件之外，既方便复用，也方便以后为
 * “文件夹导入”“拖入文件”等入口共用同一套规则。
 */

export interface PdfFileSelection {
  acceptedFiles: File[];
  rejectedFiles: File[];
}

/**
 * 判断一个浏览器 File 是否可以作为 PDF 进入解析流程。
 *
 * 某些操作系统或浏览器不会正确提供 MIME Type，因此这里同时检查
 * `application/pdf` 和 `.pdf` 扩展名。扩展名只是兼容手段，真正能否
 * 被 PDF.js 读取仍由后续解析阶段决定。
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * 将用户本次选择的文件分成“可处理 PDF”和“被忽略文件”两组。
 */
export function partitionPdfFiles(fileList: FileList | File[]): PdfFileSelection {
  const files = Array.from(fileList);

  return files.reduce<PdfFileSelection>(
    (result, file) => {
      if (isPdfFile(file)) {
        result.acceptedFiles.push(file);
      } else {
        result.rejectedFiles.push(file);
      }
      return result;
    },
    { acceptedFiles: [], rejectedFiles: [] }
  );
}
