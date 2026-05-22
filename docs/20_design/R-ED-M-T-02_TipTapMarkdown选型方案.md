---
文档编号：   ED-M-T-02
文档状态：   R
负责模块：   ED
文档职责：   TipTap/Markdown 技术选型方案
上游约束：   CORE-C-P-01、ED-M-D-01、ED-M-T-01、SYS-C-T-02、binder-core/A-ED-M-D-01
直接承接：   后续 TipTap/Markdown 运行时实现 Issue Trace
使用边界：   定义依赖、适用范围、转换边界和验收口径，不安装依赖、不写运行时代码
变更要求：   修改依赖、转换策略或文件类型边界必须同步 ED-M-T-01、SYS-C-T-02 和测试
---

# TipTap/Markdown 选型方案

## 1. 目标

为 `REQ-ED-006` 确认 Editor 从 textarea MVP 迁移到 TipTap/Markdown 的技术路线。

目标不是一次性完成运行时代码，而是确定下一步实现的规则来源：

1. `.md` 文件使用 TipTap / ProseMirror 承载编辑体验。
2. `.md` 保存时输出 Markdown 文本。
3. `.txt` 文件暂时保持纯文本 textarea 路径，避免把 Markdown 转换风险带入 txt 主流程。
4. Markdown 转换失败不得覆盖磁盘内容。

## 2. 参考来源

本方案参考 `/Users/imatstarbucks/binder-core` 当前实现与文档：

1. `binder-core/docs/20_capabilities/editor/A-ED-M-D-01_编辑器功能主控.md`
2. `binder-core/docs/20_capabilities/editor/A-ED-M-T-01_编辑器技术架构.md`
3. `binder-core/package.json`
4. `binder-core/src/components/Editor/EditorArea.tsx`

参考结论：

1. binder-core 使用 `@tiptap/react`、`@tiptap/starter-kit`、`@tiptap/extension-placeholder`、`@tiptap/pm`。
2. binder-core 使用 `tiptap-markdown` 暴露 Markdown storage。
3. binder-core 后续 DiffReview 依赖 Markdown 源文本坐标与 ProseMirror 坐标的转换，不应把二者混用。

## 3. 选型决策

本项目采用以下技术栈作为下一步实现候选：

| 能力 | 选型 | 说明 |
|------|------|------|
| TipTap React 绑定 | `@tiptap/react` | 负责 React 组件接入和 editor 实例生命周期 |
| ProseMirror 基础能力 | `@tiptap/starter-kit` | 覆盖 paragraph、heading、list、blockquote、codeBlock 等基础结构 |
| Placeholder | `@tiptap/extension-placeholder` | 空文档占位提示 |
| ProseMirror 类型与插件 | `@tiptap/pm` | 后续 BlockId / DiffDecoration 需要显式 PM 类型和插件能力 |
| Markdown 转换 | `tiptap-markdown` | 作为 Markdown 读写适配层；实现前必须用回归测试验证基础语义 |

暂不采用：

| 方案 | 不采用原因 |
|------|------------|
| 自研完整 Markdown parser/serializer | 范围过大，且容易引入语义漂移 |
| 直接污染 Markdown 源文保存 BlockId | 会改变用户源文件，需等 BlockId 专项再决策 |
| `.txt` 立即迁移到 TipTap | 当前收益有限，会扩大主流程回归面 |

## 4. 文件类型边界

| 文件类型 | 下一步实现路径 | 保存路径 |
|----------|----------------|----------|
| `.md` | TipTap + Markdown storage | Markdown 文本 |
| `.txt` | 继续 textarea 纯文本 | 原纯文本写回 |
| 其他文件 | readonly | 不保存 |

约束：

1. `.md` 转换失败时，Editor 必须保留 dirty 状态并展示错误。
2. `.md` 转换失败不得调用保存写盘。
3. `.txt` 主流程不得因 TipTap 引入回退。
4. 其他格式不得被 TipTap 改造成可编辑格式。

## 5. Markdown 转换验收口径

下一步实现必须至少覆盖以下 Markdown 语义：

| 语义 | 验收 |
|------|------|
| 标题 | `#` / `##` 往返后标题文本保留 |
| 段落 | 普通段落文本保留 |
| 列表 | 无序列表文本和列表边界保留 |
| 引用 | blockquote 文本保留 |
| 代码块 | fenced code block 内容保留 |
| 行内标记 | bold / italic / inline code 至少不丢文本 |

允许的最小口径：

1. 格式符号可以在下一轮初始实现中存在轻微规范化。
2. 文本语义不得丢失。
3. 任一失败不得覆盖磁盘文件。

## 6. 与 Diff / BlockId 的边界

TipTap/Markdown 选型只解决编辑器渲染和 Markdown 保存问题，不解决 DiffReview 定位。

后续约束：

1. Markdown 字符偏移和 ProseMirror position 是不同坐标系。
2. DiffDecoration 只能消费已验证 range/anchor。
3. BlockId 由 Editor Runtime 生成或校验，不由模型输出直接决定执行位置。
4. `tiptap-markdown` 输出 Markdown 可作为 DiskState / LogicalState 同步文本，但不能替代 PatchValidation。

## 7. 后续实现顺序

1. 依赖安装 Issue：安装 TipTap 和 Markdown 适配依赖。
2. `.md` EditorArea 运行时 Issue：为 `.md` tab 使用 TipTap，`.txt` 保持 textarea。
3. Markdown 转换测试 Issue：补读写往返和失败保护测试。
4. BlockId 策略 Issue：确认 workspace.db 映射表或其他方案。
5. DiffDecoration 骨架 Issue：接入 ProseMirror Decoration。

## 8. 当前规则状态

本方案承接候选规则：

`ED-CAND-DATA-001`

候选规则意图：

Markdown 转换失败不得覆盖磁盘内容。

升级要求：

1. 运行时代码实现前，必须在 `SYS-C-T-01` 注册正式 RULE。
2. 代码 `@GOV` 必须映射正式 RULE，不得映射候选规则。
3. 测试必须覆盖转换成功和失败保护。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，确认 TipTap/Markdown 技术选型 |
