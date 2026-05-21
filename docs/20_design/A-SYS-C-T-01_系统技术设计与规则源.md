---
文档编号：   SYS-C-T-01
文档状态：   A
负责模块：   SYS
文档职责：   系统规则来源
上游约束：   CORE-C-P-01、CORE-C-D-01
直接承接：   全部实现模块、ADUS
使用边界：   定义首批技术规则，不展开全部实现细节
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
| workspaceMachine | WS | WS-OPEN、WS-FILE-MANAGE | noWorkspace、opening、active、refreshing、error |
| editorMachine | ED | ED-OPEN-FILE、ED-SAVE-FILE | closed、loading、editing、saving、readonly、error |
| agentMachine | AG | AG-SEND-MESSAGE、AG-TOOL-CALL | idle、validatingProvider、sending、streaming、toolCalling、error |
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
rule_id: BR-ED-STATE-001
主链路: ED-OPEN-FILE
域: STATE
-->

Editor 打开文件时必须根据文件类型进入 editable 或 readonly 状态；md/txt 可编辑，其他文件只读。

<!-- RULE
rule_id: BR-ED-PERSIST-001
主链路: ED-SAVE-FILE
域: PERSIST
-->

Editor 保存动作只能写入当前打开文件，并必须保持保存后的编辑器状态与磁盘内容一致。

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

## 7. 验收与测试入口

首批测试方案：

1. Workspace 路径边界测试覆盖 `BR-WS-DATA-001`。
2. Editor 文件类型状态测试覆盖 `BR-ED-STATE-001`。
3. Provider 缺失阻断测试覆盖 `BR-AG-STATE-001`。
4. PendingDiff 创建、接受、拒绝、失效测试覆盖 `BR-DE-STATE-001`、`BR-DE-PERSIST-001`、`BR-DE-STATE-002`、`BR-DE-STATE-003`。
5. 状态机定义存在性审计覆盖 `BR-SYS-GOV-001`。
6. @GOV / triage 游离代码块审计覆盖 `BR-CORE-GOV-001`。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，注册首批模块、术语、链路、约束和规则 |
