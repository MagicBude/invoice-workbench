import { describe, expect, it } from 'vitest';
import { buildVisualPageText } from './pdf-layout';

describe('buildVisualPageText', () => {
  it('按页面坐标恢复从上到下、从左到右的视觉顺序', () => {
    const text = buildVisualPageText([
      // 故意使用与视觉顺序不同的数组顺序，模拟 PDF 内容流。
      { str: '销售方名称', transform: [1, 0, 0, 10, 320, 680], width: 60, height: 10 },
      { str: '项目名称', transform: [1, 0, 0, 10, 90, 620], width: 50, height: 10 },
      { str: '购买方名称', transform: [1, 0, 0, 10, 90, 680], width: 60, height: 10 },
      { str: '规格型号', transform: [1, 0, 0, 10, 250, 620], width: 50, height: 10 }
    ]);

    expect(text).toBe('购买方名称\t销售方名称\n项目名称\t规格型号');
  });

  it('允许同一视觉行存在小幅基线偏差', () => {
    const text = buildVisualPageText([
      { str: '名称:', transform: [1, 0, 0, 10, 90, 700], width: 30, height: 10 },
      { str: '示例公司', transform: [1, 0, 0, 10, 130, 699.2], width: 60, height: 10 }
    ]);

    expect(text).toBe('名称: 示例公司');
  });

  it('明显列间距使用制表符保留边界', () => {
    const text = buildVisualPageText([
      { str: '*生活服务*餐费', transform: [1, 0, 0, 10, 90, 600], width: 80, height: 10 },
      { str: '餐饮服务', transform: [1, 0, 0, 10, 260, 600], width: 50, height: 10 },
      { str: '1', transform: [1, 0, 0, 10, 430, 600], width: 8, height: 10 }
    ]);

    expect(text).toBe('*生活服务*餐费\t餐饮服务\t1');
  });

  it('忽略 PDF.js TextMarkedContent 标记项', () => {
    const text = buildVisualPageText([
      { type: 'beginMarkedContentProps', id: 'mc0' },
      { str: '发票号码', transform: [1, 0, 0, 10, 90, 700], width: 50, height: 10 },
      { str: '26317000001234567890', transform: [1, 0, 0, 10, 150, 700], width: 120, height: 10 }
    ]);

    expect(text).toBe('发票号码 26317000001234567890');
  });

});
