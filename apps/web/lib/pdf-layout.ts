/**
 * PDF.js 文本层的最小结构。
 *
 * PDF 内部对象的返回顺序不一定等于用户看到的视觉阅读顺序，尤其是发票这种
 * 双栏 + 表格布局。因此这里只依赖 transform 中的 X/Y 坐标，把文字重新排成
 * “从上到下、同一行从左到右”的文本，再交给 invoice-core 做规则解析。
 */
export interface PdfTextItemLike {
  str?: string;
  transform?: readonly number[];
  width?: number;
  height?: number;
}

/**
 * PDF.js 的 TextContent.items 除了真正的文字 TextItem，还可能包含
 * TextMarkedContent。后者只用于描述标记内容边界，没有 str / transform，
 * 因此不能参与坐标排序，但需要在类型层明确接收并安全忽略。
 */
export interface PdfMarkedContentLike {
  type: string;
  id?: string;
}

export type PdfTextContentItemLike = PdfTextItemLike | PdfMarkedContentLike;

function isPdfTextItemLike(item: PdfTextContentItemLike): item is PdfTextItemLike {
  return 'str' in item || 'transform' in item;
}

interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VisualLine {
  y: number;
  height: number;
  items: PositionedTextItem[];
}

function toPositionedItem(item: PdfTextItemLike): PositionedTextItem | null {
  const text = item.str?.trim();
  const transform = item.transform;

  if (!text || !transform || transform.length < 6) return null;

  const x = Number(transform[4]);
  const y = Number(transform[5]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const transformHeight = Math.max(
    Math.abs(Number(transform[1]) || 0),
    Math.abs(Number(transform[3]) || 0)
  );
  const height = Math.max(1, Number(item.height) || transformHeight || 10);
  const width = Math.max(0, Number(item.width) || 0);

  return { text, x, y, width, height };
}

function sameVisualLine(line: VisualLine, item: PositionedTextItem): boolean {
  // 同一行文字的基线通常非常接近。阈值跟随较小字体高度变化，并设置上下限，
  // 避免大标题把相邻两行错误合并，也兼容不同开票系统 1~2pt 的基线偏差。
  const tolerance = Math.max(1.5, Math.min(3.5, Math.min(line.height, item.height) * 0.4));
  return Math.abs(line.y - item.y) <= tolerance;
}

function joinLineItems(items: PositionedTextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const parts: string[] = [];
  let previous: PositionedTextItem | undefined;

  for (const item of sorted) {
    if (previous) {
      const previousEnd = previous.x + previous.width;
      const gap = item.x - previousEnd;

      // 明显的大间距通常意味着跨列。使用制表符保留这个“列边界”，
      // 后续项目名称解析可以直接取第一列，而不是把规格型号一起吃进去。
      const columnGap = Math.max(8, Math.min(previous.height, item.height) * 1.2);
      if (gap > columnGap) parts.push('\t');
      else if (gap > 0) parts.push(' ');
    }

    parts.push(item.text);
    previous = item;
  }

  return parts.join('').replace(/ +/g, ' ').replace(/ *\t */g, '\t').trim();
}

/**
 * 将 PDF.js TextContent.items 重新排列为接近页面视觉顺序的纯文本。
 *
 * 无坐标的少数文本对象会放到最后作为兜底，避免因为第三方 PDF 的异常文本层
 * 直接丢失内容。
 */
export function buildVisualPageText(items: readonly PdfTextContentItemLike[]): string {
  const positioned: PositionedTextItem[] = [];
  const fallback: string[] = [];

  for (const item of items) {
    // TextMarkedContent 不是可见文字，没有坐标和字符串，直接跳过。
    if (!isPdfTextItemLike(item)) continue;

    const positionedItem = toPositionedItem(item);
    if (positionedItem) {
      positioned.push(positionedItem);
    } else if (item.str?.trim()) {
      fallback.push(item.str.trim());
    }
  }

  positioned.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: VisualLine[] = [];
  for (const item of positioned) {
    const line = lines.find((candidate) => sameVisualLine(candidate, item));
    if (line) {
      line.items.push(item);
      line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({ y: item.y, height: item.height, items: [item] });
    }
  }

  lines.sort((a, b) => b.y - a.y);
  const visualLines = lines.map((line) => joinLineItems(line.items)).filter(Boolean);

  if (fallback.length) {
    visualLines.push(fallback.join(' '));
  }

  return visualLines.join('\n').trim();
}
