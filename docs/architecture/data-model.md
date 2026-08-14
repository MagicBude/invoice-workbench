# 核心数据模型

核心类型定义位于：

```text
packages/invoice-core/src/types.ts
```

## `InvoiceRecord`

一个 `InvoiceRecord` 对应一个输入 PDF 当前的结构化结果。

关键设计：

- 发票号码始终使用字符串。
- 金额解析结果优先以字符串保存，避免格式化时丢失信息。
- 日期统一为 `YYYY-MM-DD`。
- 文件名信息与发票正文信息分开保存。
- 校验状态独立保存，不覆盖原始字段。

## 状态类型

### 解析状态 `ParseStatus`

```text
success | review | failed
```

### 金额校验状态 `AmountValidationStatus`

```text
valid | invalid | unknown
```

### 重复状态 `DuplicateStatus`

```text
unique | duplicate | unknown
```

## 未来可能增加的字段

后续可能加入：

- `id`
- `rawTextHash`
- `invoiceCode`
- `currency`
- `redLetterFlag`
- `sourceType`
- `parserVersion`
- `validationMessages[]`

但当前阶段不要为了未来可能性过度建模。
