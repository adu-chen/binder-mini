---
文档编号：   ED-M-D-01
文档状态：   A
负责模块：   ED
文档职责：   Editor 功能主控需求
上游约束：   CORE-C-P-01、CORE-C-D-01、CORE-X-P-12、binder-core/A-ED-M-D-01
直接承接：   ED-M-T-01、SYS-C-T-02
使用边界：   定义 Editor 功能需求颗粒度，不直接定义代码规则
变更要求：   需求 ID 或需求边界变化必须同步技术设计和映射矩阵
---

# Editor 功能主控

## 1. 需求层 ID 规则

需求描述层使用 `REQ-ED-*` 标识 Editor 产品需求。`REQ-ED-*` 不是技术规则 ID，不直接作为代码实现的 `@GOV` 映射目标。

代码实现必须映射到技术设计文档已注册规则；技术规则再通过 `SYS-C-T-02` 映射回本需求文档。

## 2. 功能定义

Editor 是 Binder Mini 的中央文档编辑运行时，负责打开、编辑、保存当前 Workspace 内的文档，并为 Diff Review 提供可定位的编辑上下文。

Editor 需求必须满足以下原则：

1. Editor 只能处理当前 Workspace 内的文件。
2. md/txt 打开与保存主流程不得被后续 TipTap 改造破坏。
3. 多标签是编辑会话管理能力，不改变磁盘文件结构。
4. dirty、pending diff、BlockId 和 DiffDecoration 是后续 Agent 编辑与 Diff Review 正确性的基础。
5. BlockId 和编辑器定位事实由 Editor Runtime 生成或校验，不能由模型输出直接决定。

## 3. 需求清单

| 需求 ID | 名称 | 需求描述 | 验收口径 |
|---------|------|----------|----------|
| REQ-ED-001 | 打开文件 | 用户可以从 Workspace 文件树打开文件到 Editor。 | md/txt 进入 editable；其他文件进入 readonly 或拒绝编辑。 |
| REQ-ED-002 | 保存文件 | 用户可以保存当前 editable 文件。 | 保存只写回当前打开文件，成功后 dirty=false，磁盘内容与编辑器内容一致。 |
| REQ-ED-003 | 多标签编辑 | 用户可以同时打开多个 Workspace 文件。 | 每个标签保留独立路径、内容快照、dirty 状态和状态机实例或等价状态。 |
| REQ-ED-004 | dirty 标记与关闭保护 | 用户修改内容后标签进入 dirty；关闭 dirty 标签或切换 Workspace 前必须处理未保存状态。 | 未确认时不得丢弃 dirty 内容；非 dirty 标签可直接关闭。 |
| REQ-ED-005 | 状态栏 | Editor 展示当前文件、保存状态和基础统计信息。 | 当前标签切换或内容变化后状态栏同步更新。 |
| REQ-ED-006 | TipTap/Markdown 编辑 | md 文件使用 TipTap/ProseMirror 承载编辑体验，并能稳定转换为 Markdown 文本保存。 | Markdown 读写往返不破坏主流程文本语义；txt 可继续按纯文本路径保存。 |
| REQ-ED-007 | BlockId 定位 | Editor 为可定位文档块生成稳定 BlockId 或等价 anchor。 | BlockId 不由模型提供执行权威；缺失或冲突时由 Editor Runtime 修复或拒绝执行。 |
| REQ-ED-008 | DiffDecoration 绿审态 | Editor 可展示当前文件 pending diff 的绿审态高亮骨架。 | 高亮只消费已验证 range/anchor；不得用全文搜索伪造执行位置。 |

## 4. 非功能要求

1. Editor 状态必须可被测试验证，不允许只存在于 DOM 隐式状态。
2. 保存前必须允许 Diff Review 或 Workspace guard 判断 pending diff 和 dirty 影响。
3. 多标签关闭、切换和保存失败必须返回可审计状态。
4. TipTap 引入不得扩大文件类型承诺；正式承诺仍以 md/txt 为主。

## 5. 与 binder-core 的颗粒度差异

binder-core 已具备 TipTap、editorStore、editorMachine、BlockIdExtension 和 DiffDecorationExtension 等更完整实现。本项目不直接搬运代码，而是按 Binder Mini 的规则体系重新拆分：

1. 先保留 md/txt MVP 的稳定打开保存能力。
2. 再补多标签和 dirty 保护。
3. 再确认 TipTap/Markdown 读写转换。
4. 最后接入 BlockId 和 DiffDecoration，作为后续 Diff Review v2 的定位基础。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义 Editor Phase 9 需求颗粒度和需求 ID |
