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
4. 执行 `pnpm typecheck`
5. 执行 `pnpm test`
6. 执行 `pnpm build`
7. 上传 `apps/web/out`
8. 使用 `deploy-pages` 部署到 GitHub Pages

## GitHub 首次配置

第一次部署前，在仓库中进入：

```text
Repository
→ Settings
→ Pages
→ Build and deployment
→ Source: GitHub Actions
```

选择 `GitHub Actions` 后即可，不需要再点击页面下方的 Jekyll 或 Static HTML `Configure`。
项目已经维护自己的 `.github/workflows/pages.yml`，应由该工作流负责构建 Next.js 并部署。

## 如何触发部署

工作流当前支持两种方式：

```text
push 到 main
→ 自动构建并部署
```

或：

```text
Repository
→ Actions
→ Deploy GitHub Pages
→ Run workflow
```

如果构建失败，应优先打开对应 workflow run 查看 `Typecheck`、`Test` 或 `Build static site` 的错误，而不是重新创建 Pages 模板工作流。

## 部署成功后的地址

项目 Pages 地址：

```text
https://magicbude.github.io/invoice-workbench/
```

第一次启用或重新部署后，以 GitHub Actions 的 `Deploy to GitHub Pages` 作业实际给出的 URL 为准。

## Base Path 配置

项目 Pages 地址包含仓库名：

```text
/invoice-workbench/
```

因此 CI 构建时设置：

```text
NEXT_PUBLIC_BASE_PATH=/invoice-workbench
```

`next.config.mjs` 会读取该变量设置 `basePath` 与 `assetPrefix`。

本地开发不设置该变量，因此仍使用根路径 `/`。

## 静态导出阶段的约束

当前阶段不要依赖：

- Server Actions
- 需要服务器运行时的 API Route
- 仅支持 SSR 的功能
- 服务端数据库

未来后端独立部署后，前端仍可以继续保持静态托管。
