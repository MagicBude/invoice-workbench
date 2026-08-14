# 开发环境与快速开始

## 环境要求

推荐：

- Node.js 20+
- pnpm 9+
- Git

## 安装依赖

```bash
pnpm install
```

## 启动开发环境

```bash
pnpm dev
```

## 类型检查

```bash
pnpm typecheck
```

## 测试

```bash
pnpm test
```

## 构建

```bash
pnpm build
```

Next.js 使用 Static Export（静态导出），输出目录为：

```text
apps/web/out
```

## 推荐开发顺序

1. 先为 `invoice-core` 补充解析规则与测试。
2. 再把新字段接入 Web 界面。
3. 再接入统一导出字段注册表。
4. 最后同步更新相关文档。
