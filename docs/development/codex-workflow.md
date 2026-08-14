# Codex 协作开发方式

本仓库已经提供根目录 `AGENTS.md`，Codex 开始工作前应先读取它。

## 推荐的任务拆分方式

不要一次下达“把整个网站做完”这样的宽泛任务。

推荐按垂直切片推进，每次完成一个可以测试和验证的能力。

### 示例 1：增强金额解析

```text
阅读 AGENTS.md 和 docs/architecture/parsing-pipeline.md。
改进 invoice-core 的金额解析：优先识别“价税合计（小写）”“合计”“税额”附近的金额，最大值/最小值策略只作为兜底。补充单元测试，不修改部署架构。
```

### 示例 2：增加销售方识别

```text
在不破坏 Local-first（本地优先）的前提下，为 invoice-core 增加 sellerName 和 sellerTaxId 的规则解析，增加测试，并更新 docs/product/field-catalog.md。
```

### 示例 3：增加 PDF 并排复核

```text
实现 P1 的 PDF + 字段并排复核界面。解析仍在本地完成，不增加后端、不上传 PDF，并保持 Next.js Static Export 可构建。
```

## 让 AI Agent 先读文档再修改代码

每个较大任务都建议附一句：

```text
先阅读 AGENTS.md 及相关 docs，再修改代码。
```

## 避免方向漂移

如果 AI Agent 建议直接增加数据库、登录、Server Actions 或云端 AI，应先检查这些能力是否属于当前路线图阶段。

项目以当前阶段目标为优先，不为了“技术上更完整”而提前增加不必要复杂度。
