# Invoice Workbench 注释规范

## 1. 注释目标

Invoice Workbench 的注释除了服务项目维护，还承担一个额外目标：

> 让阅读项目代码的人能够顺便学习前端开发知识。

因此，本项目允许比典型商业项目稍多一些的解释性注释。

但注释必须提供有价值的信息，而不是简单重复代码。

---

## 2. 注释语言

原则上使用中文。

技术名词第一次出现时可以保留英文，例如：

```ts
// Object URL 是浏览器为本地 Blob/File 临时创建的可访问地址。
const url = URL.createObjectURL(file);
```

推荐：

```text
中文解释 + 必要英文技术术语
```

不推荐：

```text
整段英文说明
中英文来回切换
```

---

## 3. 不要解释显而易见的代码

错误：

```ts
// 定义变量
const total = 100;

// 如果 total 大于 0
if (total > 0) {
  // 返回 true
  return true;
}
```

这种注释没有学习价值。

---

## 4. 优先解释“为什么”

最有价值的注释应该解释：

```text
为什么这样设计？
为什么不能使用另一种方式？
这里有什么浏览器限制？
这里有什么业务规则？
这里容易出现什么错误？
```

例如：

```ts
// 金额比较不能直接使用 ===。
// JavaScript 浮点数计算可能产生微小误差，因此允许 0.01 元以内的偏差。
const isValid =
  Math.abs(amountWithoutTax + taxAmount - totalAmount) <= 0.01;
```

---

## 5. 前端知识型注释

当代码涉及比较重要的前端概念时，可以补充一两行解释。

### React State

```ts
// selectedFields 属于用户界面状态，因此使用 useState 保存。
// 它发生变化时 React 会重新渲染依赖该状态的界面。
const [selectedFields, setSelectedFields] = useState(defaultFields);
```

### useMemo

```ts
// 这里的总金额完全可以由 invoices 计算得到，因此不单独保存 State。
// useMemo 用于避免每次渲染都重复执行较重的计算。
const totalAmount = useMemo(
  () => invoices.reduce((sum, item) => sum + (item.totalAmount ?? 0), 0),
  [invoices],
);
```

### 浏览器 File API

```ts
// File 继承自 Blob。
// arrayBuffer() 会把用户选择的 PDF 读取为二进制数据，整个过程发生在浏览器本地。
const buffer = await file.arrayBuffer();
```

---

## 6. Next.js 特有知识可以说明

例如：

```ts
"use client";

// Next.js App Router 中，组件默认是 Server Component。
// 当前组件需要使用 File API 和 useState，因此必须声明为 Client Component。
```

这类注释对于学习 Next.js 很有帮助。

但同一种知识不需要在每一个文件重复解释。

---

## 7. 函数注释

简单的内部函数，名称已经足够明确时，可以不写注释。

例如：

```ts
function formatAmount(value: number): string {
  return value.toFixed(2);
}
```

复杂函数、核心业务函数、公共函数建议写 JSDoc。

例如：

```ts
/**
 * 从已经标准化的发票文本中提取发票号码。
 *
 * 当前规则优先识别带有“发票号码”标签的号码，
 * 只有标签匹配失败后才执行较宽松的数字匹配，
 * 避免把税号等其他长数字误识别为发票号码。
 */
export function extractInvoiceNumber(text: string): string | null {
  // ...
}
```

---

## 8. 公共 API 注释

`invoice-core` 对外导出的函数建议使用 JSDoc。

需要时说明：

- 函数用途。
- 参数含义。
- 返回值。
- 特殊行为。
- 重要限制。

例如：

```ts
/**
 * 解析一份 PDF 提取出的文本并生成标准发票数据。
 *
 * @param text PDF 文本层提取出的原始文本
 * @returns 标准化后的发票记录
 */
export function parseInvoice(text: string): InvoiceRecord {
  // ...
}
```

---

## 9. 复杂算法要写阶段注释

例如解析流程：

```ts
export function parseInvoice(text: string): InvoiceRecord {
  // 1. 先统一全角数字、特殊空格等字符，减少版式差异带来的影响。
  const normalizedText = normalizeInvoiceText(text);

  // 2. 各字段独立解析，避免某个字段识别失败导致整张发票失败。
  const invoiceNumber = extractInvoiceNumber(normalizedText);
  const issueDate = extractIssueDate(normalizedText);
  const amounts = extractInvoiceAmounts(normalizedText);

  // 3. 对解析结果进行交叉校验，而不是只相信单条正则结果。
  const validation = validateInvoiceAmounts(amounts);

  return {
    // ...
  };
}
```

---

## 10. 正则表达式必须解释

复杂正则不能只扔一行代码。

错误：

```ts
const match = text.match(/发票号码[：:\s]*(\d{20})/);
```

推荐：

```ts
// 数电票常见发票号码为 20 位数字。
// 优先要求数字前存在“发票号码”标签，避免误匹配税号或其他编号。
const invoiceNumberPattern = /发票号码[：:\s]*(\d{20})/;
```

如果规则比较复杂，应拆成具名变量。

---

## 11. 业务规则必须说明意图

例如：

```ts
// 金额校验关系：
// 不含税金额 + 税额 ≈ 价税合计。
// 这里主要用于发现解析错误，不应直接修改用户原始数据。
```

重要的是说明：

> 校验是提醒，不是擅自修改。

---

## 12. 临时方案必须标记

如果某段代码只是阶段性处理：

```ts
// TODO: 当前仅处理存在文本层的 PDF。
// 后续 OCR 能力加入后，需要在这里增加扫描件回退流程。
```

或者：

```ts
// FIXME: 当前多税率发票可能无法正确计算汇总税率，需要重新设计数据模型。
```

统一使用：

```text
TODO
FIXME
NOTE
```

含义：

```text
TODO：以后需要实现
FIXME：当前存在已知问题
NOTE：容易误解的重要说明
```

---

## 13. 不要留下失效注释

代码修改后必须同步检查注释。

错误情况：

```ts
// 默认导出 7 个字段

const defaultFields = [
  // 实际已经变成 10 个
];
```

失效注释比没有注释更加危险。

---

## 14. 不要保留被注释掉的大段旧代码

错误：

```ts
// function oldParser() {
//   ...
//   ...
// }
```

Git 已经负责保存历史版本。

确认不用的代码直接删除。

---

## 15. JSX 注释

普通 JSX 不要过度注释：

```tsx
return (
  <div>
    {/* 标题 */}
    <h1>发票整理</h1>

    {/* 按钮 */}
    <button>上传</button>
  </div>
);
```

这种没有必要。

对于较长页面，可以使用区域注释：

```tsx
return (
  <>
    {/* 上传区域 */}
    <PdfUploader />

    {/* 解析结果 */}
    <InvoiceTable />

    {/* 汇总与导出 */}
    <ExportPanel />
  </>
);
```

---

## 16. 组件顶部学习说明

对于包含重要前端知识的组件，可以在文件顶部增加简短说明。

例如：

```ts
/**
 * 发票上传组件。
 *
 * 前端知识：
 * - 使用浏览器 File API 获取用户选择的本地文件。
 * - 浏览器只会授予当前页面读取用户主动选择文件的权限。
 * - 第一阶段文件不会上传服务器。
 */
```

但只有确实值得学习的组件才需要这样做。

---

## 17. 不重复解释同一个知识点

比如：

`File.arrayBuffer()` 的详细解释在第一个核心 PDF 模块写一次即可。

其他位置：

```ts
const buffer = await file.arrayBuffer();
```

不需要每次再解释三行。

目标是：

> 项目整体可以学习，而不是每个文件都像教材。

---

## 18. 注释与 README/docs 的边界

代码注释回答：

```text
这里为什么这样写？
这一小段代码在做什么？
有什么语言/API限制？
```

项目文档回答：

```text
系统为什么采用这个架构？
整个 PDF 解析流程是什么？
未来 OCR 如何演进？
为什么选择 Local-first？
```

不要把整篇架构说明复制进代码注释。

可以写：

```ts
// 关于完整解析流程，参见 docs/architecture/parsing-pipeline.md。
```

---

## 19. AI / Codex 生成代码的注释要求

Codex 新增代码时，应遵循：

- 核心业务逻辑添加中文注释。
- 复杂正则必须解释。
- 浏览器特殊 API 可增加学习型注释。
- 不为简单赋值和简单 JSX 添加无意义注释。
- 不生成大段模板化 JSDoc。
- 修改代码后同步检查原注释是否仍然正确。
- 注释重点解释设计原因和知识点。

推荐给 Codex 的要求：

```text
请遵循项目注释规范。
对于值得学习的 React、Next.js、TypeScript 和浏览器 API，
使用简洁中文注释解释关键知识点和设计原因，
但不要逐行注释，也不要注释显而易见的代码。
```

---

## 20. 一个理想示例

```ts
/**
 * 从用户选择的 PDF 中提取文字。
 *
 * PDF.js 可以直接读取电子 PDF 内部的文本层，
 * 因此标准电子发票通常不需要 OCR。
 */
export async function extractPdfText(file: File): Promise<string> {
  // File.arrayBuffer() 使用浏览器 File API 读取本地二进制文件。
  // 数据仍然保留在当前浏览器中，不会因为调用该 API 自动上传服务器。
  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: buffer,
  }).promise;

  const pages: string[] = [];

  // PDF.js 页码从 1 开始，而普通 JavaScript 数组索引通常从 0 开始。
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" "),
    );
  }

  return pages.join("\n");
}
```

这类注释就是本项目希望达到的风格：

> 看代码能理解功能，同时顺便理解前端知识。
