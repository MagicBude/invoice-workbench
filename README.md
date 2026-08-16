# Invoice Workbench（发票工作台）

> 一个以 **本地优先（Local-first）** 为核心设计的 PDF 发票批量整理工作台。

Invoice Workbench 专注于批量导入 PDF 发票，在浏览器本地提取文本并解析发票字段，支持人工复核、金额校验、重复检测、**自定义导出列**以及 Excel / CSV 导出。

当前仓库处于 **v0.1 基础版本**。项目坚持一个明确原则：**能在浏览器本地完成的处理，就不把原始发票上传到服务器。**

## 当前开发进度

v0.1 主链路已经完成，并进入发布前收尾阶段：

- PDF 批量导入与 PDF.js 浏览器本地文本提取
- PDF 视觉顺序恢复与规则解析
- 发票基础字段、购销方、金额、税率和项目名称解析
- 金额校验、重复检测和置信度判断
- 搜索、筛选、排序与批量复核
- PDF 与结构化字段并排人工复核
- 自定义显示 / 导出字段
- Excel / CSV 本地导出
- GitHub Pages 自动部署
- 大批量处理路径与桌面工作台布局优化

当前重点是继续用真实样本回归、完成 200～500 张级别性能验证，并执行 v0.1.0 发布检查清单。

## 项目目标

解决大量 PDF 发票整理中的重复劳动：

1. 批量选择或拖入 PDF 发票。
2. 优先读取 PDF 自带文本层，在浏览器本地完成解析。
3. 提取并标准化发票关键字段。
4. 对金额关系、发票号码、重复记录等进行校验。
5. 对低置信度或异常结果进行人工复核。
6. 允许用户自由选择需要导出的字段。
7. 在浏览器本地生成 Excel / CSV。
8. 后续仅在确有必要时引入 OCR、AI、云端同步等能力。

## 核心设计原则

### 本地优先（Local-first）

默认情况下，PDF 文件只在用户浏览器内处理，不上传服务器。

### 规则优先（Rule-first）

优先使用确定性规则解析标准电子发票。OCR / AI 只作为本地文本层无法可靠识别时的补充能力，而不是默认主路径。

### 渐进式增强（Progressive Enhancement）

v0.1 不依赖后端；未来根据真实需求逐步增加：

- 扫描件 OCR
- AI 辅助结构化提取
- 用户账号与云端历史记录
- 团队协作
- 归档与检索
- 企业级权限与审计

### 导出内容由用户决定

所有可导出字段都通过统一字段注册表管理。用户可以勾选需要的导出列，而不是被固定模板限制。

## v0.1 计划支持的字段

基础字段：

- PDF 文件名
- 文件名日期
- 文件名名称
- 发票类型
- 发票号码
- 开票日期
- 销售方名称
- 销售方纳税人识别号
- 购买方名称
- 购买方纳税人识别号
- 不含税金额
- 税额
- 价税合计
- 税率
- 项目名称
- 备注
- 解析状态
- 置信度
- 重复状态
- 金额校验状态

字段定义与导出策略详见：[`docs/product/field-catalog.md`](docs/product/field-catalog.md)。

## 技术栈

### Web 前端

- Next.js
- React
- TypeScript
- Tailwind CSS
- PDF.js（`pdfjs-dist`）
- SheetJS（`xlsx`）

### 核心解析模块

- TypeScript 纯函数
- 独立 `invoice-core` 包
- 文本标准化
- 文件名解析
- 发票字段解析
- 数据校验
- 重复检测
- 置信度模型（逐步完善）

### 部署方式

v0.1 使用 Next.js Static Export（静态导出），可直接部署到 GitHub Pages。

仓库：`https://github.com/MagicBude/invoice-workbench`

## 本地开发

环境要求：

- Node.js 20+
- pnpm 9+

```bash
pnpm install
pnpm dev
```

默认访问：

```text
http://localhost:3000
```

构建静态站点：

```bash
pnpm build
```

输出目录：

```text
apps/web/out
```

## GitHub Pages 部署

仓库已经包含：

```text
.github/workflows/pages.yml
```

当代码推送到 `main` 分支后，GitHub Actions 会自动构建静态站点并部署到 GitHub Pages。

首次启用时，请在仓库中设置：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

详细步骤见：[`docs/deployment/github-pages.md`](docs/deployment/github-pages.md)。

## 仓库结构

```text
invoice-workbench/
├── apps/
│   └── web/                    # Next.js 浏览器应用
├── packages/
│   └── invoice-core/           # 与界面解耦的发票解析核心
├── docs/
│   ├── product/                # 产品定位、字段、交互设计
│   ├── architecture/           # 技术架构与解析流程
│   ├── development/            # 开发约定与 Codex 协作
│   ├── deployment/             # 部署文档
│   ├── roadmap/                # 发展路线
│   └── adr/                    # 架构决策记录
├── .github/
│   └── workflows/              # CI 与 GitHub Pages 工作流
├── AGENTS.md                   # 给 Codex / AI Agent 的项目规则
├── CONTRIBUTING.md             # 贡献与开发约定
├── SECURITY.md                 # 安全与隐私说明
├── CHANGELOG.md                # 版本变更记录
├── package.json
└── pnpm-workspace.yaml
```

## 文档入口

从 [`docs/README.md`](docs/README.md) 开始阅读。

重点文档：

- [`docs/product/vision.md`](docs/product/vision.md)
- [`docs/product/field-catalog.md`](docs/product/field-catalog.md)
- [`docs/architecture/overview.md`](docs/architecture/overview.md)
- [`docs/architecture/parsing-pipeline.md`](docs/architecture/parsing-pipeline.md)
- [`docs/architecture/local-first.md`](docs/architecture/local-first.md)
- [`docs/architecture/design-direction.md`](docs/architecture/design-direction.md)
- [`docs/roadmap/roadmap.md`](docs/roadmap/roadmap.md)
- [`AGENTS.md`](AGENTS.md)

## 当前边界

v0.1 明确暂不包含：

- OCR
- 后端服务
- 数据库
- 登录系统
- 云端存储
- AI 大模型调用
- 发票真伪查验
- 税务平台接口

这些能力将在本地解析工作流稳定之后，再根据实际需求逐步增加。

## 隐私原则

默认模式下：

```text
PDF → 浏览器内存 → PDF.js → invoice-core → 表格 → 本地导出
```

不会主动把原始发票上传到任何服务端。

未来如加入 OCR / AI 云端能力，必须做到：

1. 明确提示用户文件将上传。
2. 由用户主动触发。
3. 说明处理用途与保存策略。
4. 默认不长期保存原始文件。

## 许可证

项目许可证将在正式公开发布前确定。


Excel 导出支持表头样式、冻结首行/首列、自动筛选、金额格式和合计行。
