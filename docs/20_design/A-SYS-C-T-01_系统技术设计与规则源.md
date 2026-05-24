---
文档编号：   SYS-C-T-01
文档状态：   A
负责模块：   SYS
文档职责：   系统规则来源
上游约束：   CORE-C-P-01、CORE-C-D-01
直接承接：   全部实现模块、ADUS
使用边界：   定义首批技术规则、状态机入口和需求映射约定
变更要求：   修改规则、链路、模块或术语后必须刷新 ADUS
---

# 系统技术设计与规则源

## 0. Terminology Registry

<!-- TERM
term_id: TERM-CORE-001
chains: WS-OPEN,AG-SEND-MESSAGE,DE-CREATE-DIFF
zh: 工作区
en: Workspace
forbidden: 项目目录, 当前目录, 工作目录
-->

<!-- TERM
term_id: TERM-DE-001
chains: DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF,DE-EXPIRE-DIFF
zh: 待审差异
en: PendingDiff
forbidden: 修改候选, diff候选, 待处理修改
-->

<!-- TERM
term_id: TERM-DE-002
chains: DE-ACCEPT-DIFF,DE-REJECT-DIFF,DE-EXPIRE-DIFF
zh: 终态差异卡
en: TerminalDiffCard
forbidden: 结果卡, 结束卡, 历史卡
-->

<!-- TERM
term_id: TERM-AG-001
chains: AG-TOOL-CALL
zh: 工具执行
en: ToolExecution
forbidden: 工具调用过程, 执行动作, tool run
-->

<!-- TERM
term_id: TERM-AG-002
chains: AG-SEND-MESSAGE,AG-TOOL-CALL
zh: 输入引用
en: InputReference
forbidden: 附件, 知识库引用, @引用
-->

<!-- TERM
term_id: TERM-WS-001
chains: WS-FILE-MANAGE
zh: 文件节点
en: FileNode
forbidden: 文件项, 文件记录, tree item
-->

<!-- TERM
term_id: TERM-WS-002
chains: WS-OPEN
zh: 工作区数据库
en: WorkspaceDatabase
forbidden: 项目数据库, 本地库, db文件
-->

<!-- TERM
term_id: TERM-WS-003
chains: WS-OPEN
zh: 最近工作区
en: RecentWorkspace
forbidden: 最近项目, 最近目录, 历史工作区
-->

<!-- TERM
term_id: TERM-WS-004
chains: WS-FILE-MANAGE
zh: 路径冲突
en: PathConflict
forbidden: 覆盖提示, 文件冲突, 已存在错误
-->

<!-- TERM
term_id: TERM-DE-003
chains: DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF
zh: 差异定位引用
en: DiffAnchorRef
forbidden: diff锚点, 定位锚, anchor
-->

<!-- TERM
term_id: TERM-AG-003
chains: AG-SEND-MESSAGE
zh: Prompt运行时
en: PromptRuntime
forbidden: prompt组装, prompt结构, 提示词组装
-->

<!-- TERM
term_id: TERM-AG-004
chains: AG-SEND-MESSAGE,AG-TOOL-CALL
zh: 对话状态机
en: chatMachine
forbidden: agentMachine, agent状态机, 聊天机器
-->

<!-- TERM
term_id: TERM-ED-001
chains: ED-OPEN-FILE,ED-SAVE-FILE
zh: 编辑器标签页
en: EditorTab
forbidden: 编辑标签, tab页, 编辑器tab
-->

<!-- TERM
term_id: TERM-DOC-001
chains: DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-EXPIRE-DIFF,ED-SAVE-FILE
zh: 磁盘状态
en: DiskState
forbidden: 文件状态, 存储状态, 持久化内容
-->

<!-- TERM
term_id: TERM-DOC-002
chains: DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF,ED-OPEN-FILE,ED-SAVE-FILE
zh: 逻辑状态
en: LogicalState
forbidden: 编辑器缓冲区内容, 内存内容, buffer内容
-->

<!-- TERM
term_id: TERM-DOC-003
chains: ED-OPEN-FILE,ED-DIFF-RENDER
zh: 显示状态
en: DisplayState
forbidden: 渲染状态, 视图内容, 展示内容
-->

<!-- TERM
term_id: TERM-DE-004
chains: DE-CREATE-DIFF,DE-ACCEPT-DIFF,ED-DIFF-RENDER
zh: 绿增
en: GreenAddition
forbidden: 绿审, 绿审态, 绿审态骨架, DiffDecoration高亮
code_identifier: 渲染层 React 组件命名为 GreenAdditionOverlay；TipTap 扩展命名为 GreenAdditionDecoration
-->

<!-- TERM
term_id: TERM-DE-005
chains: DE-CREATE-DIFF,DE-EXPIRE-DIFF
zh: 基准版本
en: baseRevision
definition: diff 创建时记录的目标文件 DiskState 全量内容 hash（非 originalText 的 hash）；用于在 accept（未打开文件路径）或 Inherit 流程中校验当前 DiskState 是否被外部修改；hash 不一致时 diff 转 expired，不执行写入。
forbidden: 原始版本, 基础版本, 内容快照hash
-->

<!-- TERM
term_id: TERM-AG-005
chains: AG-TOOL-CALL
zh: 工具调用标识
en: callId
definition: 单次工具调用的唯一标识，由后端在组装 Provider payload 时生成；ToolExecution 和 ToolResult 通过 callId 关联；同一轮次内 callId 唯一，跨轮次不保证。
forbidden: toolId, requestId, executionId
-->

<!-- TERM
term_id: TERM-ED-002
chains: ED-OPEN-FILE,ED-SAVE-FILE,AG-SEND-MESSAGE,AG-TOOL-CALL
zh: 激活文件
en: ActiveFile
definition: 当前 editorSession 中处于 focus 状态的 tab 所对应的文件；由 editorMachine 通过 activeTabId 标识，PromptRuntime 以 activeFilePath 字段注入 Provider payload；两者指向同一概念。
forbidden: 当前文件, active file, 当前打开文件
-->

<!-- TERM
term_id: TERM-DE-006
chains: DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-EXPIRE-DIFF,AG-TOOL-CALL
zh: 精确原文
en: originalText
definition: 模型在内容编辑工具调用中提供的待替换精确原文字符串；是主定位器（IR-RANGE-005 原则），系统通过 ProseMirror 文本搜索在文档中定位匹配位置后执行字符精确替换；originalText 不匹配时 diff 进入 error 终态，不 fallback 为全量替换。
forbidden: 原始文本, 原始内容, 文件快照, 全文内容
-->

<!-- TERM
term_id: TERM-DE-007
chains: DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF,AG-TOOL-CALL
zh: 替换内容
en: newText
definition: 模型在内容编辑工具调用中提供的替换内容字符串；与 originalText 配对使用，系统在定位 originalText 后将其精确替换为 newText；是字符级精确替换片段，不是全文内容。
forbidden: 建议内容, 修改内容, proposedText, 新全文
-->

<!-- TERM
term_id: TERM-DE-008
chains: DE-CREATE-DIFF,ED-DIFF-RENDER
zh: 已应用范围
en: appliedRange
definition: diff 字符精确替换执行成功后，由 Editor Runtime 记录的 ProseMirror 绝对位置范围 {from, to}，标识 newText 在文档中的当前位置；用于 DiffDecoration 绑定绿增 overlay 和 syncPendingDiffsWithDocument 的 originalText 一致性检测。
forbidden: 位置范围, diff位置, 高亮范围
-->

## 1. 模块注册

<!-- MODULE
module_code: CORE
module_name: Core Governance
description: 项目身份、治理边界、文档体系和规则来源
-->

<!-- MODULE
module_code: SYS
module_name: System Architecture
description: 系统架构、跨模块协议和公共技术约束
-->

<!-- MODULE
module_code: WS
module_name: Workspace
description: 工作区生命周期、文件树、搜索和文件操作边界
-->

<!-- MODULE
module_code: ED
module_name: Editor
description: 文档打开、编辑、保存和编辑器内 diff 呈现
-->

<!-- MODULE
module_code: AG
module_name: Agent
description: AI Provider、消息流、工具执行和输入引用
-->

<!-- MODULE
module_code: DE
module_name: Diff Review
description: diff 生成、审阅、接受、拒绝、失效和终态记录
-->

## 2. 架构原则

系统采用 Tauri 2 + React + TypeScript + Rust 桌面架构。

前端负责用户交互、编辑器渲染、Agent 消息流、diff 卡状态呈现和状态机协调。后端负责文件系统访问、workspace 数据存储、搜索索引、Provider 请求代理和持久化边界。

项目使用状态机驱动开发。适合状态化表达的核心功能链必须先定义状态机，再进入代码实现。

## 3. 核心链路

<!-- CHAIN
chain_id: WS-OPEN
主责模块: WS
status: active
-->

`WS-OPEN` 描述用户选择本地目录、初始化工作区上下文、加载文件树和最近 workspace 记录的流程。

<!-- CHAIN
chain_id: WS-FILE-MANAGE
主责模块: WS
status: active
-->

`WS-FILE-MANAGE` 描述文件创建、删除、移动、重命名和文件树刷新流程。

<!-- CHAIN
chain_id: WS-CLOSE
主责模块: WS
status: active
-->

`WS-CLOSE` 描述关闭或切换 Workspace 前的 dirty editor 和 pending diff 门禁流程。

<!-- CHAIN
chain_id: WS-SEARCH
主责模块: WS
status: active
-->

`WS-SEARCH` 描述 Workspace 搜索索引重建、查询和降级搜索流程。

<!-- CHAIN
chain_id: ED-OPEN-FILE
主责模块: ED
status: active
-->

`ED-OPEN-FILE` 描述从文件树打开文件、加载编辑器内容和选择只读/可编辑模式的流程。

<!-- CHAIN
chain_id: ED-SAVE-FILE
主责模块: ED
status: active
-->

`ED-SAVE-FILE` 描述编辑器保存当前文件内容的流程。

<!-- CHAIN
chain_id: AG-SEND-MESSAGE
主责模块: AG
status: active
-->

`AG-SEND-MESSAGE` 描述用户消息提交、Provider 配置校验、流式响应和消息记录的流程。

<!-- CHAIN
chain_id: AG-TOOL-CALL
主责模块: AG
status: active
-->

`AG-TOOL-CALL` 描述 Agent 工具执行、结果回传和执行记录的流程。

<!-- CHAIN
chain_id: DE-CREATE-DIFF
主责模块: DE
status: active
-->

`DE-CREATE-DIFF` 描述编辑类工具根据文件内容生成 pending diff 的流程。

<!-- CHAIN
chain_id: DE-ACCEPT-DIFF
主责模块: DE
status: active
-->

`DE-ACCEPT-DIFF` 描述用户接受 pending diff 并写入文件的流程。

<!-- CHAIN
chain_id: DE-REJECT-DIFF
主责模块: DE
status: active
-->

`DE-REJECT-DIFF` 描述用户拒绝 pending diff 并丢弃候选修改的流程。

<!-- CHAIN
chain_id: DE-EXPIRE-DIFF
主责模块: DE
status: active
-->

`DE-EXPIRE-DIFF` 描述文件内容变化或定位失效后 pending diff 转为不可执行终态的流程。

## 4. 状态机设计入口

首批必须设计状态机的逻辑链：

| 状态机 | 主责模块 | 覆盖链路 | 最小状态 |
|--------|----------|----------|----------|
| workspaceMachine | WS | WS-OPEN、WS-FILE-MANAGE、WS-CLOSE | NoWorkspace、Loading、Active、Closing、Error |
| editorMachine | ED | ED-OPEN-FILE、ED-SAVE-FILE | closed、loading、editing、dirty、saving、readonly、error |
| chatMachine | AG | AG-SEND-MESSAGE、AG-TOOL-CALL | noWorkspace、ready、validatingProvider、sending、streaming、toolCalling、cancelling、error |
| diffMachine | DE | DE-CREATE-DIFF、DE-ACCEPT-DIFF、DE-REJECT-DIFF、DE-EXPIRE-DIFF | none、pending、accepting、rejecting、expired、terminal、error |

## 5. 跨模块约束

<!-- CONSTRAINT
constraint_id: X-CONST-001
摘要: 所有文件操作必须受 Workspace 边界约束
涉及模块: WS,ED,AG,DE
链路影响: WS-OPEN,WS-FILE-MANAGE,ED-OPEN-FILE,AG-TOOL-CALL,DE-CREATE-DIFF
-->

文件读取、搜索、写入、移动、删除、diff 生成和上下文注入必须以当前 Workspace 为边界。

<!-- CONSTRAINT
constraint_id: X-CONST-002
摘要: 内容编辑工具必须生成 PendingDiff，不得直接写入文档
涉及模块: AG,DE,ED
链路影响: AG-TOOL-CALL,DE-CREATE-DIFF,DE-ACCEPT-DIFF
-->

Agent 的内容编辑能力必须经由 Diff Review 链路，只有接受 diff 后才能写入文件。

<!-- CONSTRAINT
constraint_id: X-CONST-003
摘要: 适合状态化表达的核心链路必须先设计状态机
涉及模块: WS,ED,AG,DE
链路影响: WS-OPEN,ED-OPEN-FILE,AG-SEND-MESSAGE,DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF
-->

核心功能链若存在多状态、异步、副作用或终态，必须先定义状态机后实现。

<!-- CONSTRAINT
constraint_id: X-CONST-004
摘要: 代码块不得游离于技术设计文档注册规则体系之外
涉及模块: CORE,SYS,WS,ED,AG,DE
链路影响: WS-OPEN,WS-FILE-MANAGE,ED-OPEN-FILE,ED-SAVE-FILE,AG-SEND-MESSAGE,AG-TOOL-CALL,DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF,DE-EXPIRE-DIFF
-->

所有代码块必须直接映射技术设计文档已注册规则，或作为已注册规则的功能分支、辅助功能、依赖功能或附属代码块进入 @GOV 与 triage 闭环。

## 6. 首批规则

<!-- RULE
rule_id: BR-WS-STATE-001
主链路: WS-OPEN
域: STATE
-->

Workspace 打开流程必须先建立有效 Workspace 边界，后续文件树、搜索、编辑器和 Agent 工具才能进入可用状态。

<!-- RULE
rule_id: BR-WS-DATA-001
主链路: WS-FILE-MANAGE
域: DATA
-->

文件管理操作的目标路径必须位于当前 Workspace 内，不得解析到 Workspace 边界之外。

<!-- RULE
rule_id: BR-WS-STATE-002
主链路: WS-OPEN
域: STATE
需求映射: REQ-WS-001,REQ-WS-005
-->

Workspace active 前必须完成 `.binder` 和 workspace.db 初始化；初始化失败时不得返回 active Workspace snapshot。

<!-- RULE
rule_id: BR-WS-DATA-002
主链路: WS-FILE-MANAGE
域: DATA
需求映射: REQ-WS-003
-->

Workspace 文件树必须以 Workspace 根目录为边界递归生成 FileNode，且不得暴露 `.binder` 内部数据。

<!-- RULE
rule_id: BR-WS-PERSIST-001
主链路: WS-OPEN
域: PERSIST
需求映射: REQ-WS-004
-->

最近 Workspace 必须作为用户级元数据持久化，不得写入 Workspace 内容目录；记录必须按最近打开时间去重排序。

<!-- RULE
rule_id: BR-WS-DATA-003
主链路: WS-FILE-MANAGE
域: DATA
需求映射: REQ-WS-006,REQ-WS-007
-->

创建、重命名、移动和删除等 Workspace 结构操作必须通过 Workspace 边界守卫，且操作成功后必须刷新 Workspace 文件树。

<!-- RULE
rule_id: BR-WS-DATA-004
主链路: WS-FILE-MANAGE
域: DATA
需求映射: REQ-WS-008
-->

Workspace 结构操作遇到目标路径冲突时必须返回 PathConflict；未经用户确认不得覆盖既有文件或目录。

<!-- RULE
rule_id: BR-WS-STATE-003
主链路: WS-CLOSE
域: STATE
需求映射: REQ-WS-009
-->

关闭或切换 Workspace 前必须处理 dirty editor 和 pending diff；存在未处理状态时不得清空或替换当前 Workspace。

<!-- RULE
rule_id: BR-WS-DATA-005
主链路: WS-SEARCH
域: DATA
需求映射: REQ-WS-010
-->

Workspace 搜索索引必须可重建，搜索结果必须限制在当前 Workspace；索引不可用时必须降级或返回可审计错误。

<!-- RULE
rule_id: BR-ED-STATE-001
主链路: ED-OPEN-FILE
域: STATE
-->

Editor 打开文件时必须根据文件类型进入 editable 或 readonly 状态；md/txt 可编辑，其他文件只读。

<!-- RULE
rule_id: BR-ED-STATE-002
主链路: ED-OPEN-FILE
域: STATE
需求映射: REQ-ED-003
-->

Editor 多标签会话必须为每个打开文件保留独立路径、内容快照、dirty 状态和可审计状态；打开已存在文件时必须复用并激活既有标签。

<!-- RULE
rule_id: BR-ED-STATE-003
主链路: ED-SAVE-FILE
域: STATE
需求映射: REQ-ED-004
-->

Editor dirty 标签关闭或 Workspace 切换前必须确认、保存或阻断；未经确认不得丢弃未保存内容。

<!-- RULE
rule_id: BR-ED-STATE-004
主链路: ED-OPEN-FILE
域: STATE
需求映射: REQ-ED-005
-->

Editor 状态栏必须从当前 active tab 派生文件路径、保存状态和基础内容统计，不得维护独立事实源。

<!-- RULE
rule_id: BR-ED-PERSIST-001
主链路: ED-SAVE-FILE
域: PERSIST
-->

Editor 保存动作只能写入当前打开文件，并必须保持保存后的编辑器状态与磁盘内容一致。

<!-- RULE
rule_id: BR-ED-PERSIST-002
主链路: ED-OPEN-FILE,ED-SAVE-FILE
域: PERSIST
需求映射: REQ-ED-006
-->

Editor Markdown 文件必须通过 TipTap/Markdown 运行时维护逻辑 Markdown 文本；转换失败时必须展示错误并阻断保存，不得覆盖磁盘内容。

<!-- RULE
rule_id: BR-AG-STATE-001
主链路: AG-SEND-MESSAGE
域: STATE
-->

Agent 发送消息前必须完成 Provider 配置校验；Provider 缺失或无效时不得发起 AI 请求。

<!-- RULE
rule_id: BR-AG-OBS-001
主链路: AG-TOOL-CALL
域: OBS
-->

Agent 工具执行必须记录工具名称、输入边界、执行结果和错误状态，供消息流和调试审计使用。

<!-- RULE
rule_id: BR-AG-DATA-001
主链路: AG-TOOL-CALL
域: DATA
-->

InputReference 是只读上下文，只能注入 Agent 请求，不得触发文件写入、文件移动或 diff 接受。

<!-- RULE
rule_id: BR-DE-STATE-001
主链路: DE-CREATE-DIFF
域: STATE
-->

内容编辑工具生成的文档修改必须进入 PendingDiff 状态，不得直接写入目标文件。

<!-- RULE
rule_id: BR-DE-PERSIST-001
主链路: DE-ACCEPT-DIFF
域: PERSIST
-->

只有用户接受 PendingDiff 后，系统才能把对应修改写入目标文件。

<!-- RULE
rule_id: BR-DE-STATE-002
主链路: DE-REJECT-DIFF
域: STATE
-->

用户拒绝 PendingDiff 后，候选修改必须进入不可执行终态，并不得改变目标文件内容。

<!-- RULE
rule_id: BR-DE-STATE-003
主链路: DE-EXPIRE-DIFF
域: STATE
-->

PendingDiff 因内容变化、定位失效或冲突进入 expired 后，不得继续执行接受或拒绝动作。

<!-- RULE
rule_id: BR-SYS-GOV-001
主链路: WS-OPEN,ED-OPEN-FILE,AG-SEND-MESSAGE,DE-CREATE-DIFF
域: GOV
-->

适合状态化表达的核心功能链必须在技术设计文档中定义状态机后再进入代码实现。

<!-- RULE
rule_id: BR-CORE-GOV-001
主链路: WS-OPEN,ED-OPEN-FILE,AG-SEND-MESSAGE,DE-CREATE-DIFF
域: GOV
-->

代码实现不得存在游离代码块；所有代码块必须能追溯到技术设计文档已注册规则体系。

<!-- RULE
rule_id: BR-DE-STATE-010
主链路: DE-ACCEPT-DIFF,ED-SAVE-FILE
域: STATE
需求映射: REQ-DE-002,REQ-ED-002
-->

DiskState 唯一写入路径：仅用户执行 Cmd+S 保存（已打开文件路径）或 accepted（未打开文件路径接受时）才能修改 DiskState；任何其他路径（包括 Accept 已打开文件、reject、expire、preapply）不得修改 DiskState。

<!-- RULE
rule_id: BR-DE-STATE-011
主链路: DE-ACCEPT-DIFF
域: STATE
需求映射: REQ-DE-002
-->

Accept（已打开文件路径）不写 DiskState：接受操作仅移除编辑器绿增 overlay，LogicalState 保持不变（已含 newText，字符精确替换结果），DiskState 不触碰，文件保持 dirty 状态；DiskState 只在用户后续 Cmd+S 时更新。

<!-- RULE
rule_id: BR-DE-STATE-012
主链路: DE-EXPIRE-DIFF
域: STATE
需求映射: REQ-DE-004,REQ-DE-011
-->

统一失效规则：diff 所在文本区域 LogicalState 发生任何变化（用户编辑命中 diff 区域、新 diff 覆盖同区域、reject 回滚），或 DiskState 被外部写入，该 diff 自动进入 expired 状态（发出 EXPIRE_REQUESTED）；diff-on-diff 场景属于此规则自然覆盖的子场景，不返回冲突错误。

<!-- RULE
rule_id: BR-ED-STATE-005
主链路: ED-OPEN-FILE,ED-DIFF-RENDER
域: STATE
需求映射: REQ-ED-008
-->

DisplayState 只读派生规则：DisplayState 派生自 LogicalState 加绿增 overlay，无独立存储路径；任何对 DisplayState 的写入必须转为修改 LogicalState 或注册 overlay；不得绕过此规则直接向渲染层注入内容。

<!-- RULE
rule_id: BR-AG-SEC-001
主链路: AG-SEND-MESSAGE
域: SEC
需求映射: REQ-AG-007
-->

Provider API key 不得在前端持有、传递或出现在前端日志中；由后端安全存储读取，前端只感知 apiKeyConfigured 布尔状态；forbidden provider fields（apiKey 等）必须在后端组装 Provider payload 时过滤，不得透传给模型。

<!-- RULE
rule_id: BR-AG-STATE-002
主链路: AG-SEND-MESSAGE
域: STATE
需求映射: REQ-AG-002
-->

真实 Provider SSE 流发生网络错误、超时或 Provider 错误时，必须终止流、向 chatMachine 发出 FAILED 事件，并在 UI 显示可识别失败状态（error.message 包含可读原因）；不得静默丢弃错误或保留 streaming 状态。

<!-- RULE
rule_id: BR-AG-DATA-002
主链路: AG-TOOL-CALL
域: DATA
需求映射: REQ-AG-003
-->

工具结果必须在同一对话轮次内以 tool_result 事件形式通过 chat-stream-event 通道回流；不得作为独立 user message 注入对话历史；ToolResult 必须携带 callId 与对应 ToolExecution 关联。

<!-- RULE
rule_id: BR-DE-DATA-001
主链路: DE-CREATE-DIFF
域: DATA
需求映射: REQ-DE-006
-->

PendingDiff 创建时必须携带 sourceToolId（生成它的 ToolExecution.id）、baseRevision（原始内容 hash）、createdAt（Unix timestamp）和 effectivePath（"open-file" 或 "closed-file"）；缺少可溯源字段的 diff 不得进入 pending 状态。

<!-- RULE
rule_id: BR-DE-STATE-004
主链路: DE-ACCEPT-DIFF
域: STATE
需求映射: REQ-DE-002
-->

Accept（未打开文件路径）写入 DiskState 前，必须校验当前 DiskState hash 与 PendingDiff.baseRevision 一致；不一致时 diff 转 expired，不执行写入。

<!-- RULE
rule_id: BR-DE-STATE-005
主链路: DE-CREATE-DIFF,DE-ACCEPT-DIFF
域: STATE
需求映射: REQ-DE-001
-->

preapplied 状态只适用于已打开文件链路：diff 创建时立即在 originalText 位置精确替换为 newText（字符级精确替换，非全文替换；pending 为短暂过渡态，立即触发 LOGICAL_STATE_APPLIED）；未打开文件保持 pending 直到用户决策；Accept（已打开文件）只移除绿增，不写 DiskState。

## 7. 验收与测试入口

首批测试方案：

1. Workspace 路径边界测试覆盖 `BR-WS-DATA-001`。
2. Editor 文件类型状态测试覆盖 `BR-ED-STATE-001`。
3. Provider 缺失阻断测试覆盖 `BR-AG-STATE-001`。
4. PendingDiff 创建、接受、拒绝、失效测试覆盖 `BR-DE-STATE-001`、`BR-DE-PERSIST-001`、`BR-DE-STATE-002`、`BR-DE-STATE-003`。
5. 状态机定义存在性审计覆盖 `BR-SYS-GOV-001`。
6. @GOV / triage 游离代码块审计覆盖 `BR-CORE-GOV-001`。

## 8. 需求到规则映射约定

需求描述层使用 `REQ-*` 标识产品和功能需求；技术设计层使用 `RULE`、`CHAIN`、`CONSTRAINT`、`TERM` 作为代码实现规则来源。

技术规则到需求的映射由 `SYS-C-T-02` 维护。已注册 `RULE` 可以承接一个或多个 `REQ-*`；实现代码必须映射到已注册技术规则，不能只映射到需求 ID。

新增功能进入代码实现前，必须完成以下链路：

`REQ-* -> SYS-C-T-02 -> SYS-C-T-01 已注册 RULE/CHAIN/CONSTRAINT -> @GOV 注释 -> 测试覆盖`

## 9. Agent 候选规则（Phase 10-12，进入实现前升级为正式规则）

以下候选规则来自 `AG-M-T-01`，进入 Phase 10-12 代码实现前必须升级为正式 RULE 块、补充 `@GOV` 标注和测试覆盖。

| 候选规则 ID | 承接需求 | 建议链路 | 设计意图 | 状态 |
|-------------|----------|----------|----------|------|
| ~~AG-CAND-STATE-002~~ | REQ-AG-002 | AG-SEND-MESSAGE | 真实 Provider SSE 流必须在错误时终止并向 UI 返回可识别失败状态。 | **已升级 → BR-AG-STATE-002** |
| ~~AG-CAND-DATA-002~~ | REQ-AG-003 | AG-TOOL-CALL | 工具结果必须在同一对话轮次内以 tool_result 形式回流，不得注入为 user message。 | **已升级 → BR-AG-DATA-002** |
| ~~AG-CAND-DATA-003~~ | REQ-AG-007 | AG-SEND-MESSAGE | Provider API key 不得在前端持有、传递或出现在日志中；由后端安全存储读取。 | **已升级 → BR-AG-SEC-001** |
| AG-CAND-STATE-003 | REQ-AG-007 | AG-SEND-MESSAGE | Agent 只能向 Provider 暴露 allowedTools 中的工具，不得暴露全部已注册工具。 | 待升级（Phase 12）|
| AG-CAND-DATA-004 | REQ-AG-006 | AG-TOOL-CALL | InputReference 只注入 Provider 请求上下文，不触发任何文件副作用。 | 待升级（Phase 12）|
| AG-CAND-PERSIST-001 | REQ-AG-010 | AG-SEND-MESSAGE | 聊天消息必须在 WORKSPACE_CLOSED 时持久化到 workspace.db，WORKSPACE_OPENED 时读取恢复；不得在切换 Workspace 时直接清空内存 messages 而不落盘。 | 待升级（Phase 12）|
| AG-CAND-DATA-005 | REQ-AG-004 | AG-TOOL-CALL | 内容编辑工具（edit_current_editor_document、update_file）必须使用 originalText（精确原文字符串）+ newText（替换内容）接口；系统通过 PM 文本搜索定位 originalText 后执行字符精确替换；不得使用全量 proposedText 替换整个文件内容；originalText 找不到时返回结构化错误，不 fallback 为全量替换。 | 待升级（Phase 9 重写时）|

## 10. Diff Review 候选规则（Phase 13，进入实现前升级为正式规则）

以下候选规则来自 `DE-M-T-01`，进入 Phase 13 代码实现前必须升级为正式 RULE 块、补充 `@GOV` 标注和测试覆盖。

| 候选规则 ID | 承接需求 | 建议链路 | 设计意图 | 状态 |
|-------------|----------|----------|----------|------|
| ~~DE-CAND-DATA-001~~ | REQ-DE-006 | DE-CREATE-DIFF | PendingDiff 必须携带 sourceToolId、baseRevision、createdAt、effectivePath，可追溯到生成它的 ToolExecution。 | **已升级 → BR-DE-DATA-001** |
| ~~DE-CAND-STATE-004~~ | REQ-DE-002 | DE-ACCEPT-DIFF | Accept（未打开文件路径）前必须校验 DiskState hash 与 baseRevision 一致；不一致时转 expired，不执行写入。 | **已升级 → BR-DE-STATE-004** |
| ~~DE-CAND-STATE-005~~ | REQ-DE-001 | DE-CREATE-DIFF、DE-ACCEPT-DIFF | preapplied 状态只适用于已打开文件链路；diff 创建时立即修改 LogicalState；Accept（已打开文件）不写 DiskState。 | **已升级 → BR-DE-STATE-005** |
| DE-CAND-PERSIST-002 | REQ-DE-007 | DE-ACCEPT-DIFF、DE-REJECT-DIFF | PendingDiff 状态必须持久化到 workspace.db，应用重启后可恢复或转 expired。 | 待升级（Phase 13-D）|
| DE-CAND-STATE-006 | REQ-DE-007 | DE-EXPIRE-DIFF | Workspace 关闭时，所有非终态 PendingDiff 必须转 expired 并写入持久化存储。 | 待升级（Phase 13-D）|

## 11. Editor 候选规则（Phase 9 剩余项，进入实现前升级为正式规则）

以下候选规则来自 `ED-M-T-01`，进入 Phase 9 步骤 5-6 代码实现前必须升级为正式 RULE 块，且须先完成 DE-M-T-01 Phase 13-A 数据结构。

| 候选规则 ID | 承接需求 | 建议链路 | 设计意图 | 状态 |
|-------------|----------|----------|----------|------|
| ED-CAND-DATA-002 | REQ-ED-007 | ED-OPEN-FILE | BlockId / Anchor 必须由 Editor Runtime 生成或校验，不由模型输出直接决定执行位置。 | 待升级（Phase 9-E）|
| ED-CAND-STATE-004 | REQ-ED-008 | ED-DIFF-RENDER | DiffDecoration 只能消费已验证 range/anchor；无法解析时不渲染伪高亮。 | 待升级（Phase 9-F）|

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.9 | 注册 Editor Markdown 读取保存转换规则 |
| 2026-05-22 | v1.8 | 注册 Editor dirty 关闭保护与状态栏规则 |
| 2026-05-22 | v1.7 | 注册 Editor 多标签正式规则 |
| 2026-05-22 | v1.6 | 注册 Workspace 搜索索引链路与正式规则 |
| 2026-05-22 | v1.5 | 注册 Workspace 关闭切换 dirty/pending 门禁规则 |
| 2026-05-22 | v1.4 | 注册 Workspace 创建结构操作与 PathConflict 规则 |
| 2026-05-22 | v1.3 | 注册最近 Workspace 用户级持久化规则 |
| 2026-05-22 | v1.2 | 注册 Workspace 初始化与递归 FileNode 正式规则 |
| 2026-05-22 | v1.1 | 增加需求到规则映射约定和 Workspace 颗粒度候选规则 |
| 2026-05-23 | v2.0 | 注册 AG Phase 10-12 和 DE Phase 13 候选规则；补充 ED Phase 9 剩余候选规则；原 §9 候选规则表补全为 §9-11 分模块候选规则表 |
| 2026-05-23 | v2.1 | §0 补充 TERM 块：DiffAnchorRef、PromptRuntime、chatMachine、EditorTab；§4 工作流机：workspaceMachine 状态改为 PascalCase 并加 Closing；editorMachine 补充 dirty 状态；agentMachine 改名 chatMachine 并更新状态列表；删除变更记录重复条目 |
| 2026-05-24 | v2.2 | §0 新增 TERM 块：DiskState（TERM-DOC-001）、LogicalState（TERM-DOC-002）、DisplayState（TERM-DOC-003）、GreenAddition/绿增（TERM-DE-004，forbidden: 绿审/绿审态）；§10 DE-CAND-STATE-005 描述移除 mounted_pending，改为 preapplied 仅适用已打开文件链路 |
| 2026-05-24 | v2.3 | §0 TERM-DE-004 补充 code_identifier（GreenAdditionOverlay/GreenAdditionDecoration）；新增 TERM-DE-005（baseRevision）、TERM-AG-005（callId）、TERM-ED-002（ActiveFile）；§6 注册 BR-DE-STATE-010/011/012（DiskState 写入边界、accept 不写盘、统一 expire）、BR-ED-STATE-005（DisplayState 只读派生）、BR-AG-SEC-001（API key 安全）、BR-AG-STATE-002（SSE 错误终止）、BR-AG-DATA-002（工具结果回流）、BR-DE-DATA-001（PendingDiff 可溯源字段）、BR-DE-STATE-004（accept 前校验）、BR-DE-STATE-005（preapplied 三态）共 10 条正式规则；§9 升级 AG-CAND-STATE-002/DATA-002/DATA-003 为正式规则，新增 AG-CAND-PERSIST-001；§10 升级 DE-CAND-DATA-001/STATE-004/STATE-005 为正式规则；§11 候选表增加状态列 |
| 2026-05-24 | v2.4 | §9 新增 AG-CAND-STRUCT-001（edit_document_block blockId 来源与校验约束，Phase 13-B）|
| 2026-05-24 | v2.5 | 精确编辑架构（D-01/D-02/D-10）：§0 新增 TERM-DE-006（originalText，精确原文主定位器）、TERM-DE-007（newText，替换内容片段）、TERM-DE-008（appliedRange，已应用 PM 位置范围）；§6 BR-DE-STATE-005 改为字符精确替换语义（非全文替换）；BR-DE-STATE-011 更新（LogicalState 含 newText 不变）；§9 移除 AG-CAND-STRUCT-001（edit_document_block 已移除），新增 AG-CAND-DATA-005（originalText+newText 精确替换接口约束） |
