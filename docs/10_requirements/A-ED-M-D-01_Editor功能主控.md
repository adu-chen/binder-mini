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

## 6. 需求标注块

<!-- REQ
req_id: REQ-ED-001
name: 打开文件
module: ED
chains: ED-OPEN-FILE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-ED-002
name: 保存文件
module: ED
chains: ED-SAVE-FILE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-ED-003
name: 多标签编辑
module: ED
chains: ED-OPEN-FILE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-ED-004
name: dirty 标记与关闭保护
module: ED
chains: ED-SAVE-FILE, WS-CLOSE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-ED-005
name: 状态栏
module: ED
chains: ED-OPEN-FILE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-ED-006
name: TipTap/Markdown 编辑
module: ED
chains: ED-OPEN-FILE, ED-SAVE-FILE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-ED-007
name: BlockId 定位
module: ED
chains: ED-OPEN-FILE, DE-CREATE-DIFF
priority: P2
status: blocked
-->
<!-- 前置: DE-M-T-01 Phase 13-A -->

<!-- REQ
req_id: REQ-ED-008
name: DiffDecoration 绿审态
module: ED
chains: ED-DIFF-RENDER, DE-CREATE-DIFF
priority: P2
status: blocked
-->
<!-- 前置: BlockId + anchor 协议 -->

## 7. 功能流程表

### REQ-ED-001 打开文件（ED-OPEN-FILE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | 文件路径 | 点击文件树节点 | 打开文件请求 | S02 | — |
| S02 | ED | 文件路径 | 判断标签是否已打开（按路径查找） | 已有标签 or 无 | S03（已有: 激活现有标签 → DONE） | S04 |
| S03 | ED | 文件路径 | 激活对应标签（editorMachine → active） | 激活标签 | DONE | — |
| S04 | SYS | 文件路径 | 读取文件内容 | 文件内容 + 扩展名 | S05 | 读取失败 → ERR-01（只读/不存在） |
| S05 | ED | 扩展名 | 判断可编辑性（md/txt → editable，其他 → readonly） | editable/readonly 标记 | S06 | — |
| S06 | ED | 文件内容 + editable | 初始化标签（路径、内容快照、dirty=false） | 新标签状态 | S07 | — |
| S07 | ED | 新标签状态 | 激活为当前标签 | active 标签 | DONE | — |

### REQ-ED-002 保存文件（ED-SAVE-FILE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | — | 触发保存（Cmd+S 或 UI 按钮） | 保存请求 | S02 | — |
| S02 | ED | active 标签 | 检查标签是否 editable 且 dirty | editable+dirty 判断 | S03（editable+dirty） | END（非 dirty: 跳过） |
| S03 | ED | 编辑器内容 + 文件类型 | 序列化内容（md: TipTap→Markdown；txt: 直接字符串） | 序列化文本 | S04 | 序列化失败 → ERR-01（转换失败，阻断保存） |
| S04 | SYS | 序列化文本 + 路径 | 写入磁盘 | 写入结果 | S05 | 写入失败 → ERR-02（权限/磁盘） |
| S05 | ED | 写入成功 | 清除 dirty 标记（dirty=false） | 更新标签状态 | DONE | — |

### REQ-ED-003 多标签编辑

用户点击文件树节点时，ED 检查路径是否已有标签（已有则激活，否则新建）。每个标签保持独立的路径、内容快照和 dirty 状态；标签间切换不影响其他标签的编辑内容。

### REQ-ED-004 dirty 标记与关闭保护（ED-DIRTY-CLOSE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | — | 触发关闭 dirty 标签或切换 Workspace | 关闭/切换请求 | S02 | — |
| S02 | ED | 当前标签列表 | 检查是否有 dirty 标签 | dirty 标签列表 | S03（有 dirty） | END（无 dirty: 直接关闭） |
| S03 | User | dirty 提示弹窗 | 确认"保存"/"丢弃"/"取消" | 用户选择 | S04（保存）/ S05（丢弃）/ END（取消，保留状态） | — |
| S04 | ED | 选择"保存" | 触发保存流程（→ ED-SAVE-FILE-FLOW） | 保存结果 | S06（保存成功） | ERR-01（保存失败，阻断关闭） |
| S05 | ED | 选择"丢弃" | 直接关闭标签，丢弃 dirty 内容 | 标签移除 | DONE | — |
| S06 | ED | 保存成功 | 关闭标签（dirty=false 后执行） | 标签移除 | DONE | — |

### REQ-ED-005 状态栏

当前 active 标签变化或内容编辑时，状态栏从 editorMachine 状态派生当前路径、dirty 标记和基础统计（字数/行数）；无 active 标签时状态栏清空。

### REQ-ED-006 TipTap/Markdown 编辑（ED-MARKDOWN-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | ED | 文件路径（.md 扩展名） | 判断为 Markdown 文件 | 类型标记 | S02 | — |
| S02 | SYS | .md 文件路径 | 读取 Markdown 文本内容 | rawMarkdown | S03 | 读取失败 → ERR-01 |
| S03 | ED | rawMarkdown | TipTap 解析 Markdown → ProseMirror 文档结构 | TipTap 文档 | S04（解析成功） | ERR-02（解析失败 → 只读降级或提示） |
| S04 | User | TipTap 文档 | 用户在 TipTap 富文本编辑器中编辑 | 编辑后 TipTap 文档 | S05（触发保存） | — |
| S05 | ED | TipTap 文档 | 序列化 TipTap → Markdown 文本（tiptap-markdown） | Markdown 文本 | S06 | ERR-03（序列化失败 → 阻断保存） |
| S06 | SYS | Markdown 文本 + 路径 | 写入磁盘 | 写入结果 | DONE | ERR-04（写入失败） |

### REQ-ED-007 BlockId 定位

前置 DE-M-T-01 Phase 13-A 完成后实现。Editor Runtime 在打开或保存时为可定位块生成 BlockId，并校验 AI 工具输出的 BlockId 是否有效。

### REQ-ED-008 DiffDecoration 绿审态

前置 BlockId 策略和 DE anchor 协议确认后实现。Editor 从 diffStore 读取当前文件的 pending diff，在已验证 anchor 范围内渲染绿色高亮骨架。

## 8. 问题暴露清单

- **NEEDS_HUMAN_DECISION**: BlockId 生成时机 — 在文件打开时生成还是保存时生成？打开时生成可立即为 Diff Review 提供 anchor，但可能与磁盘内容不一致；保存时生成更可靠但 Agent 请求的 BlockId 需要先保存才有效。
- **BOUNDARY_OPEN**: Markdown 转换语义损失边界 — tiptap-markdown 不保证所有 Markdown 语法的往返一致（例如自定义 HTML、复杂表格、GFM 扩展语法）。当前不明确哪些格式在保存后会被规范化或丢失。
- **REQ_GAP**: readonly 文件的编辑尝试 — 当用户尝试编辑 readonly 文件（非 md/txt）时，应展示只读提示还是直接拒绝编辑光标？当前只定义了 readonly 标记，未定义 UI 交互行为。
- **DESIGN_RISK**: TipTap 实例与多标签的生命周期 — 每个标签是否有独立 TipTap 实例？切换标签时销毁/重建 TipTap 还是保持挂载？不同策略影响内存和初始化性能。
- **FLOW_INCOMPLETE**: 保存失败恢复路径 — 当磁盘写入失败时（ERR-02），dirty 标记应保持还是清除？用户是否可以重试？当前需求未定义保存失败后的用户交互和状态恢复。

## 9. 跨模块交互声明

| 方向 | 触发场景 | 数据边界 | 约束 |
|------|----------|----------|------|
| ED → WS | 打开文件时请求文件内容 | filePath（WS 边界内）→ 文件内容 | 路径必须在 workspaceRoot 内；WS 未 active 时 ED 不可打开文件 |
| ED → DE | 当前文件有 pending diff 时展示绿审态 | diffId、filePath → DiffAnchorRef | ED 只消费 DE 的 pending diff 展示；不直接修改 diff 状态 |
| WS → ED | WS 关闭或切换时通知 ED | workspaceMachine 状态变化 → ED 关闭所有标签 | dirty 标签必须先处理再允许 WS 切换（反向依赖） |
| DE → ED | accept preapplied diff 时回滚编辑器缓冲区 | diffId、originalText → 编辑器缓冲区内容 | preapplied → reject 时 ED 必须回滚；不得只记录终态而留游离内容 |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义 Editor Phase 9 需求颗粒度和需求 ID |
| 2026-05-23 | v1.1 | 新增 §6 需求标注块、§7 功能流程表、§8 问题暴露清单、§9 跨模块交互声明（G1 合规修复）|
