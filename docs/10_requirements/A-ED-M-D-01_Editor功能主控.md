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
| REQ-ED-005 | 状态栏 | Editor 展示 ActiveFile、保存状态和基础统计信息。 | ActiveFile 切换或内容变化后状态栏同步更新。 |
| REQ-ED-006 | TipTap/Markdown 编辑 | md 文件使用 TipTap/ProseMirror 承载编辑体验，并能稳定转换为 Markdown 文本保存；txt 与 md 共用同一 TipTap 实例，走纯文本序列化路径。 | Markdown 读写往返不破坏主流程文本语义；txt 不退回 textarea 或独立 runtime。 |
| REQ-ED-007 | BlockId 定位 | Editor 在文件打开时为可定位文档块生成稳定 BlockId；校验 AI 工具输出的 BlockId 是否有效。 | BlockId 不由模型提供执行权威；缺失或冲突时由 Editor Runtime 修复或拒绝执行；文件打开即可用，不依赖保存动作。 |
| REQ-ED-008 | DiffDecoration 绿增 | Editor 在 pending diff 进入 preapplied 状态时，在已验证 anchor 范围内渲染绿色新增（绿增）效果；不渲染红色删除。 | 绿增只消费已验证 anchor（blockId 或 lineRange）；anchor 无效时不渲染并通知 DE；聊天流显示完整红删绿增；终态后绿增自动移除。 |

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
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-ED-008
name: DiffDecoration 绿增
module: ED
chains: ED-DIFF-RENDER, DE-CREATE-DIFF
priority: P1
status: active
-->

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

### REQ-ED-007 BlockId 定位（ED-BLOCKID-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | ED | .md 文件打开事件 | TipTap 解析 Markdown，创建 ProseMirror 文档节点树 | 节点树 | S02 | ERR-01（解析失败 → 只读降级）|
| S02 | ED | ProseMirror 节点树 | BlockIdExtension 为每个块级节点（paragraph、heading、listItem 等）分配唯一 BlockId | 节点携带 blockId 属性 | S03 | — |
| S03 | ED | blockId 集合 | 维护文档级 blockId 注册表，检测并消除重复 | 注册表就绪 | DONE | ERR-02（冲突 → 重新生成，不阻断打开）|
| S04 | AG | AI 工具返回的 blockId | 校验 blockId 是否在当前文档注册表中存在 | 校验结果 | DONE（有效 → 允许工具执行）| ERR-03（blockId 无效/不存在 → 工具拒绝执行，返回明确错误）|

注：BlockId 由 Editor Runtime 生成，不接受模型直接声明。S04 在 AG 工具调用时触发，不在文件打开流程中。

### REQ-ED-008 DiffDecoration 绿增（ED-DIFFDECORATION-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | DE | PendingDiff（filePath、diffId、appliedRange、DiffAnchorRef）| diff 进入 preapplied（LogicalState 已在 originalText 位置精确替换为 newText），通知 ED 渲染绿增效果 | diffId + appliedRange | S02 | — |
| S02 | ED | diffId + anchor | 校验 anchor 对应的 ProseMirror 节点在当前文档中是否存在 | 校验结果 | S03（有效）| ERR-01（anchor 无效 → 不渲染，通知 DE 失效此 diff）|
| S03 | ED | 有效 anchor 范围 | DiffDecorationExtension 在对应节点范围内渲染绿增效果（ProseMirror Decoration，只显示新增内容绿色覆盖，不显示红删）| 绿增效果可见 | DONE | — |
| S04 | DE | 终态通知（diffId → accepted/rejected/expired）| DE 通知 ED 移除对应绿增 Decoration | — | ED 移除绿增，恢复正常编辑态 | — |

注：编辑器内永远不显示红色删除效果；完整红删绿增 diff 视图只在聊天消息流中展示。Accept（已打开文件）只是移除绿增视觉效果，LogicalState 不变（已含 newText），DiskState 不触碰。

## 8. 已决策约束

以下问题已决策，作为设计约束固化到实现中。

| 类别 | 决策 |
|------|------|
| **BlockId 生成时机** | 文件打开时生成。TipTap 解析文件创建 ProseMirror 节点时即分配 BlockId，不依赖用户操作或保存。打开即可用，可立即为 Diff Review 提供 anchor。对齐 binder-core。 |
| **Markdown 往返一致性损失边界** | 暂不处理。不定义 tiptap-markdown 往返损失的可接受边界，不做往返测试矩阵。已知为底层库特性，用户遭遇格式规范化时视为预期行为。 |
| **readonly 文件编辑尝试** | 拒绝光标。readonly 模式（非 md/txt 文件）下编辑器不渲染可交互光标，禁止文字输入，UI 表现为纯文本展示区，无任何编辑反馈。 |
| **TipTap 实例与多标签生命周期** | 每个 EditorTab 拥有独立 TipTap 实例（每标签一个 editorMachine actor）。标签切换时不销毁实例，保持挂载状态以保留编辑器状态（滚动位置、undo 历史）。对齐 binder-core。 |
| **保存失败恢复路径** | 保持 dirty 标记 + 显示错误提示，editorMachine 回到 editing 状态。用户再次触发 Cmd+S 可重试。不自动重试，不清除 dirty 标记。对齐 binder-core。 |
| **txt 文件与 TipTap 实例** | txt 与 md 使用同一 TipTap 实例和纯文本序列化路径（无 Markdown 格式转换）；BlockId 生成逻辑同样适用于 txt 文件中的块级节点。对齐 binder-core EditorArea.tsx。 |

## 9. 跨模块交互声明

| 方向 | 触发场景 | 数据边界 | 约束 |
|------|----------|----------|------|
| ED → WS | 打开文件时请求文件内容 | filePath（WS 边界内）→ 文件内容 | 路径必须在 workspaceRoot 内；WS 未 active 时 ED 不可打开文件 |
| ED → DE | ActiveFile 有 pending diff 时展示绿增 | diffId、filePath → DiffAnchorRef | ED 只消费 DE 的 preapplied diff 展示绿增效果；不直接修改 diff 状态 |
| WS → ED | WS 关闭或切换时通知 ED | workspaceMachine 状态变化 → ED 关闭所有标签 | dirty 标签必须先处理再允许 WS 切换（反向依赖） |
| DE → ED | diff 创建时立即应用 newText（已打开文件）| LOGICAL_STATE_APPLIED 事件（diffId、originalText、newText、appliedRange）→ ED LogicalState | ED 在 originalText 位置精确替换为 newText，diff 进入 preapplied；绿增效果展示；用户接受时仅移除绿增，LogicalState 不变，不写磁盘；用户拒绝时触发 LogicalState 回滚 |
| DE → ED | preapplied diff 被拒绝时回滚编辑器缓冲区 | diffId、originalText → 编辑器缓冲区内容 | reject 时 ED 必须回滚到 originalText；不得只记录终态而留游离内容 |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义 Editor Phase 9 需求颗粒度和需求 ID |
| 2026-05-23 | v1.1 | 新增 §6 需求标注块、§7 功能流程表、§8 问题暴露清单、§9 跨模块交互声明（G1 合规修复）|
| 2026-05-23 | v1.2 | §8 将全部问题项替换为已决策约束；对齐 binder-core（BlockId 打开时生成、拒绝光标、每标签独立实例、保持 dirty+提示）；明确 Markdown 往返边界暂不处理 |
| 2026-05-23 | v1.3 | REQ-ED-007/008 从 blocked/P2 升为 active/P1（当前阶段即应实现）；§7 补充 BlockId 生成流程表（ED-BLOCKID-FLOW）和 DiffDecoration 渲染流程表（ED-DIFFDECORATION-FLOW），替换"前置...完成后实现"占位描述 |
| 2026-05-23 | v1.4 | §9 拆分 DE→ED 交互为两行：mounted_pending 推送 proposedText（CONTENT_UPDATE）+ reject 回滚；§8 补充 txt/TipTap 实例决策约束（txt 与 md 同实例，BlockId 同样适用） |
| 2026-05-24 | v1.5 | REQ-ED-008 名称"绿审态"改为"绿增"；ED-DIFFDECORATION-FLOW 修订：触发点从 mounted_pending 改为 preapplied（LogicalState 已修改）；绿增只显示新增不显示红删；Accept 只移除绿增不写磁盘；§9 DE→ED 交互更新（diff 创建即推送 proposedText；accept 不写磁盘） |
| 2026-05-24 | v1.6 | 审计修复：REQ-ED-006 明确 txt 共用 TipTap 纯文本序列化路径；REQ-ED-008 和跨模块交互将 proposedText 旧口径替换为 originalText + newText + appliedRange 精确替换链路；ActiveFile 术语替换旧"当前文件"表述 |
