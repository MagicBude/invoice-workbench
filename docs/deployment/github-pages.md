# GitHub Pages 部署说明

## 目标

v0.1 是纯静态应用：

```text
Next.js Static Export
→ GitHub Actions
→ GitHub Pages
```

## 仓库地址

```text
https://github.com/MagicBude/invoice-workbench
```

## 自动部署工作流

仓库包含：

```text
.github/workflows/pages.yml
```

工作流会依次执行：

1. 检出代码
2. 安装 pnpm 与 Node.js
3. 执行 `pnpm install`
4. 执行 `pnpm build`
5. 上传 `apps/web/out`
6. 使用 `deploy-pages` 部署

## Base Path 配置

项目 Pages 地址通常包含仓库名：

```text
https://magicbude.github.io/invoice-workbench/
```

因此 CI 构建时设置：

```text
NEXT_PUBLIC_BASE_PATH=/invoice-workbench
```

`next.config.mjs` 会读取该变量设置 `basePath` 与 `assetPrefix`。

本地开发不设置该变量，因此仍使用根路径 `/`。

## GitHub 首次配置

第一次部署前，在仓库中进入：

```text
Repository
→ Settings
→ Pages
→ Build and deployment
→ Source: GitHub Actions
```

## 静态导出阶段的约束

当前阶段不要依赖：

- Server Actions
- 需要服务器运行时的 API Route
- 仅支持 SSR 的功能
- 服务端数据库

未来后端独立部署后，前端仍可以继续保持静态托管。
