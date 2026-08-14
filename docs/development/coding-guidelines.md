# Invoice Workbench 代码规范

## 1. 规范目标

本规范用于统一 Invoice Workbench 的代码风格、目录组织和实现方式，使项目具备以下特点：

- 代码结构清晰，容易维护。
- 新增功能时能够快速找到对应位置。
- 避免业务逻辑散落在页面组件中。
- 方便通过阅读代码学习 TypeScript、React、Next.js 和前端工程化知识。
- 方便 Codex 等 AI 编程工具理解和持续维护项目。
- 保持本地优先（Local-first）、规则优先（Rule-first）的项目原则。

项目代码应优先追求：

> 清晰 > 简短 > 炫技

不为了减少几行代码而牺牲可读性。

---

## 2. 基本原则

### 2.1 一个模块只负责一类事情

不要把 UI、PDF 解析、发票规则、Excel 导出全部写在同一个文件中。

例如：

```text
components/
负责界面组件

features/
负责具体业务功能

lib/
负责通用工具

invoice-core/
负责发票解析、校验和数据模型
```

错误示例：

```tsx
export default function Home() {
  // 读取 PDF
  // 正则解析发票
  // 判断金额
  // 检测重复
  // 渲染表格
  // 导出 Excel
}
```

正确思路：

```text
页面
 ↓
业务 Hook / Feature
 ↓
invoice-core
 ↓
parser / validator / exporter
```

---

## 3. TypeScript 规范

项目原则上不使用 JavaScript 文件编写业务代码。

优先使用：

```text
.ts
.tsx
```

### 3.1 禁止随意使用 `any`

错误：

```ts
function parseInvoice(data: any) {
  // ...
}
```

推荐：

```ts
function parseInvoice(data: InvoiceText): InvoiceRecord {
  // ...
}
```

如果类型暂时未知，优先使用：

```ts
unknown
```

再进行类型判断。

### 3.2 业务数据必须定义明确类型

例如：

```ts
export interface InvoiceRecord {
  fileName: string;
  invoiceNumber: string;
  issueDate: string;
  sellerName: string;
  amountWithoutTax: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
}
```

不要在多个组件中分别定义相似的数据结构。

核心类型统一放在：

```text
packages/invoice-core/
```

---

## 4. 命名规范

### 4.1 变量和函数

使用：

```text
camelCase
```

例如：

```ts
invoiceNumber
selectedFields
parseInvoiceText()
validateInvoiceAmount()
```

### 4.2 类型、接口和 React 组件

使用：

```text
PascalCase
```

例如：

```ts
InvoiceRecord
InvoiceField
InvoiceTable
PdfUploader
ExportDialog
```

### 4.3 常量

普通模块常量：

```ts
const defaultColumns = [];
```

真正意义上的固定全局常量可以使用：

```ts
const MAX_FILE_SIZE = 20 * 1024 * 1024;
```

### 4.4 Boolean 变量

尽量使用：

```text
is
has
can
should
```

例如：

```ts
isParsing
hasTextLayer
canExport
shouldUseOcr
```

---

## 5. React 组件规范

一个 React 组件应该尽量只负责一个明确的界面职责。

例如：

```text
PdfUploader
InvoiceTable
InvoiceTableRow
ExportFieldSelector
ParseStatus
SummaryCard
```

不要轻易出现几百行甚至上千行的单个页面组件。

普通业务组件优先使用具名导出：

```ts
export function InvoiceTable() {}
```

页面和 Next.js 特殊文件除外。

---

## 6. React 状态设计

不要把所有数据都放进 `useState`。

首先判断数据属于哪一种：

```text
服务器数据
业务数据
界面状态
计算结果
持久化设置
```

例如：

```ts
const [selectedFields, setSelectedFields] = useState(...);
```

属于界面设置，可以放 State。

但：

```ts
const totalAmount = invoices.reduce(...);
```

属于计算结果，不应该再额外建立：

```ts
const [totalAmount, setTotalAmount] = useState(0);
```

能从已有状态计算出来的数据，尽量不要重复保存。

---

## 7. Hook 使用规范

自定义 Hook 名称必须以 `use` 开头。

例如：

```ts
useInvoiceFiles()
useExportFields()
useLocalStorage()
```

Hook 主要负责：

- 状态组合。
- React 生命周期。
- 浏览器事件。
- UI 与业务模块之间的连接。

不要把复杂的发票识别规则直接写进 Hook。

---

## 8. 业务逻辑规范

发票解析规则统一放入：

```text
packages/invoice-core/
```

例如：

```text
parser/
normalizer/
validator/
types/
fields/
```

React 页面不得出现大量类似：

```ts
text.match(...)
```

这样的发票解析正则。

正确方式：

```ts
const invoice = parseInvoice(text);
```

组件只关心结果，不关心具体解析规则。

---

## 9. 字段统一管理

所有可识别、显示和导出的字段应优先由统一字段注册表管理。

例如：

```ts
export const invoiceFields = [
  {
    key: "invoiceNumber",
    label: "发票号码",
    defaultExport: true,
  },
];
```

禁止分别维护：

```text
一套表格字段
一套 Excel 字段
一套 CSV 字段
一套导出设置字段
```

这些功能应该尽量共享同一个字段定义。

---

## 10. 函数设计规范

一个函数只完成一个主要任务。

例如：

```ts
normalizeInvoiceText()
extractInvoiceNumber()
extractIssueDate()
extractInvoiceAmounts()
validateInvoiceAmounts()
```

优于：

```ts
processEverything()
```

如果函数名称无法简单描述它的职责，通常说明函数承担了太多任务。

---

## 11. 参数设计

参数较少时：

```ts
function formatAmount(value: number, currency: string) {}
```

参数开始变多时：

```ts
interface ExportOptions {
  fields: InvoiceFieldKey[];
  includeSummary: boolean;
  fileName: string;
}

function exportInvoices(options: ExportOptions) {}
```

不要：

```ts
exportInvoices(a, b, true, false, "", 1);
```

---

## 12. 错误处理

不能无提示地吞掉错误。

错误：

```ts
try {
  await parsePdf();
} catch {
}
```

推荐：

```ts
try {
  await parsePdf();
} catch (error) {
  console.error("PDF 解析失败", error);
  // 更新用户可见状态
}
```

用户能够理解的错误，应转换成中文提示。

例如：

```text
无法读取该 PDF 文件。
该文件可能已损坏或受到密码保护。
```

技术错误可以保留在开发日志中。

---

## 13. 异步代码

优先使用：

```text
async / await
```

而不是多层：

```text
.then()
.then()
.then()
.catch()
```

---

## 14. 提前返回

推荐：

```ts
function exportInvoices(rows: InvoiceRecord[]) {
  if (rows.length === 0) {
    return;
  }

  // 正常逻辑
}
```

减少代码嵌套层级。

---

## 15. 避免魔法数字

错误：

```ts
if (text.length < 20) {
}
```

推荐：

```ts
const MIN_VALID_TEXT_LENGTH = 20;

if (text.length < MIN_VALID_TEXT_LENGTH) {
}
```

尤其是以下值应有明确名称：

- 文件大小。
- 金额误差。
- 置信度阈值。
- OCR 判断阈值。

---

## 16. CSS / Tailwind 规范

优先使用 Tailwind CSS 完成常规布局和视觉样式。

不要为了一个简单布局创建大量零散 CSS 文件。

当一个复杂组件出现大量重复样式时，可以抽象为组件。

---

## 17. 文件大小建议

没有绝对行数限制，但可以参考：

```text
普通工具模块：尽量 < 200 行
普通 React 组件：尽量 < 250 行
复杂 Feature：尽量 < 400 行
```

超过后应检查是否可以拆分。

但不要为了满足行数而机械拆文件。

---

## 18. Import 规范

推荐顺序：

```ts
// React / Next.js
import { useState } from "react";

// 第三方库
import * as XLSX from "xlsx";

// 项目模块
import { parseInvoice } from "@invoice-workbench/invoice-core";

// 当前目录模块
import { InvoiceRow } from "./invoice-row";
```

不同类别之间留一个空行。

---

## 19. 浏览器能力边界

Invoice Workbench 第一阶段是本地优先应用。

涉及以下 API 时，应明确其运行环境：

```text
window
document
localStorage
File
Blob
URL.createObjectURL
IndexedDB
```

这些都属于浏览器 API。

在 Next.js 中不要默认所有代码都能在服务器环境运行。

需要浏览器能力的 React 组件应正确使用：

```ts
"use client";
```

同时不要为了方便而给所有组件都添加 `"use client"`。

---

## 20. 安全原则

不得在用户不知情的情况下上传 PDF。

第一阶段原则：

```text
PDF
↓
浏览器本地解析
↓
浏览器本地处理
↓
浏览器本地导出
```

以后加入 OCR 或 AI 云端能力时，必须明确告诉用户文件即将上传。

---

## 21. AI / Codex 修改代码要求

使用 Codex 修改代码前，应优先阅读：

```text
AGENTS.md
README.md
docs/
```

AI 新增业务逻辑时：

1. 优先寻找已有实现。
2. 不重复建立相似模块。
3. 不将业务逻辑塞进页面组件。
4. 不随意更换技术栈。
5. 不破坏 GitHub Pages 静态部署能力。
6. 修改架构后同步更新文档。
7. 新增复杂逻辑时补充必要中文注释。
8. 不为了通过测试而删除校验逻辑。

---

## 22. 总原则

遇到两种都能工作的实现方式时，优先选择：

```text
容易读懂
容易测试
容易修改
容易解释
容易让未来的自己理解
```

而不是代码最短的方式。
