# AI Agent 开发规则

本文件用于约束 Codex、ChatGPT、Claude Code 等 AI Agent 在本仓库中的开发行为。

## 1. 项目核心目标

Invoice Workbench 是一个发票批量整理工具，而不是泛化的“万能 PDF AI 平台”。

当前阶段优先把以下闭环做好：

```text
批量导入 PDF
→ 本地文本提取
→ 发票字段解析
→ 数据校验
→ 人工复核
→ 自定义导出列
→ Excel / CSV 导出
```

底层模块可以保持通用性，但产品体验必须优先服务发票场景。

## 2. 不可破坏的架构原则

### 2.1 本地优先（Local-first）

v0.1 不应引入任何“上传 PDF 到服务器才能完成基本解析”的依赖。

能在浏览器完成的功能必须优先在浏览器完成：

- PDF 文本层读取
- 字段规则解析
- 金额校验
- 重复检测
- 编辑
- 导出

### 2.2 规则优先（Rule-first）

禁止默认把所有 PDF 文本直接发送给 AI。

优先级：

```text
确定性字段规则
→ 位置 / 上下文规则
→ 启发式规则
→ OCR
→ AI 辅助
→ 人工复核
```

### 2.3 保持 GitHub Pages 兼容

v0.1 必须维持 Next.js Static Export（静态导出）兼容性。

除非路线图明确进入后端阶段，否则不要引入：

- Server Actions
- 需要 Node.js Runtime 的 Route Handlers
- 强依赖 SSR 的功能
- 服务端 Session
- 服务端数据库

### 2.4 核心逻辑与界面解耦

解析逻辑必须优先放在：

```text
packages/invoice-core
```

不要把大量正则和业务规则散落在 React 组件中。

### 2.5 导出列由统一注册表驱动

可导出字段必须统一定义在字段注册表中。

新增一个字段时，应同步考虑：

- 类型定义
- 字段标签
- 默认是否导出
- 是否可编辑
- Excel / CSV 序列化
- 空值策略
- 文档说明

禁止在多个组件里分别硬编码不同字段列表。

## 3. 当前目录职责

### `apps/web`

负责：

- 页面
- 拖拽上传
- PDF.js 调用
- 表格编辑
- 导出列选择
- Excel / CSV 下载
- 用户状态提示

### `packages/invoice-core`

负责：

- 数据结构
- 文本标准化
- 文件名解析
- 发票字段解析
- 金额关系校验
- 重复检测
- 状态与置信度计算

不得依赖 React。

## 4. 数据处理原则

金额在解析阶段优先保留字符串表示，计算时再显式转换为 Number，并避免直接使用浮点数相等比较。

金额校验建议：

```text
abs((不含税金额 + 税额) - 价税合计) <= 0.01
```

发票号码不要转 Number，始终使用字符串。

日期统一标准化为：

```text
YYYY-MM-DD
```

原始文本如有必要可保留，但不要默认持久化原始 PDF 内容。

## 5. 解析策略

解析函数应尽可能：

- 使用纯函数
- 可单元测试
- 单一职责
- 对异常格式返回可处理结果，而不是抛出不可恢复错误

建议按以下函数逐步拆分：

```text
normalizeInvoiceText()
parseFilenameMetadata()
detectInvoiceType()
extractInvoiceNumber()
extractIssueDate()
extractSeller()
extractBuyer()
extractAmounts()
extractTaxRate()
extractItemName()
validateAmountRelation()
calculateConfidence()
```

## 6. 用户体验约束

批量处理时：

- 单个文件失败不能中断整个批次。
- 必须显示文件级处理状态。
- 异常结果要可人工修改。
- 原始文件名始终保留，便于追溯。
- 导出列必须可选，并记住用户偏好。

## 7. 隐私与安全

任何未来的 OCR / AI 云端请求都必须：

- 明确区分“本地处理”和“云端处理”。
- 在上传前告知用户。
- 由用户主动触发。
- 不允许静默上传原始 PDF。

## 8. 文档同步规则

修改以下内容时必须同步更新文档：

- 架构变化 → `docs/architecture/`
- 字段变化 → `docs/product/field-catalog.md`
- 里程碑变化 → `docs/roadmap/roadmap.md`
- 重大技术取舍 → 新增 `docs/adr/XXXX-*.md`
- 开发方式变化 → `docs/development/`

## 9. 提交前自检

至少执行：

```bash
pnpm typecheck
pnpm test
pnpm build
```

如果因为环境或网络无法执行，必须在提交说明中明确写出未验证项。

## 10. 当前优先级

### P0

- PDF 批量导入
- PDF.js 文本提取
- 字段解析
- 可编辑表格
- 可选导出列
- Excel / CSV 导出
- 金额校验
- 重复检测

### P1

- PDF 与字段并排复核
- 更完善的字段解析
- 低置信度提示
- 文件名规则配置
- 导出模板
- 批量性能优化
