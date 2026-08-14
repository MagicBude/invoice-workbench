# 项目文档中心

本目录是 Invoice Workbench 的长期项目知识库，用于记录产品定位、技术架构、开发约定、部署方式与发展路线。

## 文档分类

### `product/`：产品设计

回答“我们要做什么、为谁做、有哪些字段、用户如何使用”。

- `vision.md`：产品定位、价值与边界
- `field-catalog.md`：字段目录与可选导出列设计
- `workflow.md`：用户工作流与状态设计

### `architecture/`：技术架构

回答“系统如何工作、为什么这样设计”。

- `overview.md`：总体架构
- `local-first.md`：本地优先设计
- `parsing-pipeline.md`：PDF 到结构化数据的解析流水线
- `data-model.md`：核心数据模型
- `design-direction.md`：关键技术方向与设计取舍

### `development/`：开发协作

回答“开发者与 Codex 如何继续维护和开发项目”。

- `getting-started.md`：开发环境与常用命令
- `codex-workflow.md`：Codex 协作方式
- `coding-guidelines.md`：编码约定

### `deployment/`：部署

- `github-pages.md`：v0.1 静态部署方式
- `future-backend.md`：未来后端能力与部署方向

### `roadmap/`：发展路线

- `roadmap.md`：版本规划与阶段目标

### `adr/`：架构决策记录

ADR（Architecture Decision Record）用于记录不应被随意推翻的重要技术决策。

当前包括：

- `0001-local-first.md`：默认本地优先
- `0002-rule-first.md`：规则优先，AI 作为补充
- `0003-static-first-monorepo.md`：静态优先的单仓库结构

## 文档维护原则

代码负责实现，文档负责保存项目意图。

如果开发者或 AI Agent 修改了架构、字段、隐私策略或发展方向，应同步修改对应文档，避免代码和设计意图逐渐脱节。
