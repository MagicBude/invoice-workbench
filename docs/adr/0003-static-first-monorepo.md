# ADR-0003：静态优先的单仓库结构

- 状态：已接受
- 日期：2026-08-14

## 决策

项目使用一个 GitHub 仓库统一管理 Web、核心解析模块与未来 API。

v0.1 只启用：

```text
apps/web
packages/invoice-core
```

Web 使用 Next.js Static Export（静态导出），并部署到 GitHub Pages。

## 原因

- 第一次提交结构清晰
- 无需提前维护多个仓库
- Codex 容易理解项目全局
- 未来可以增加 `apps/api`，而不破坏现有结构
