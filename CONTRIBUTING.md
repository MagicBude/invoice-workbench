# 贡献与开发约定

## 开发流程

```bash
pnpm install
pnpm dev
```

提交前建议执行：

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 分支建议

- `main`：始终保持可部署
- `feat/*`：功能开发
- `fix/*`：问题修复
- `docs/*`：文档调整
- `refactor/*`：代码重构

## 提交信息建议

推荐使用 Conventional Commits 规范，类型关键字保留英文，描述可以直接使用中文：

```text
feat: 增加发票导出列选择器
fix: 处理 PDF 文本层为空的情况
docs: 补充本地优先架构说明
refactor: 拆分金额解析与发票解析逻辑
```

## 开发前建议阅读

- `AGENTS.md`
- `docs/architecture/overview.md`
- `docs/product/field-catalog.md`
- `docs/roadmap/roadmap.md`
