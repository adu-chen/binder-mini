---
文档编号：CORE-GOV-01
文档状态：A
负责模块：CORE
文档职责：ADU 派生检索索引
上游约束：CORE-GOV-00
直接承接：ADU / ADP / CLAUDE 的规则、链路、代码块检索
使用边界：不定义治理规则，不定义开发过程，不替代 adu.md、ADP.md 或 CLAUDE.md
变更要求：运行 npm run governance:generate 刷新自动生成区
---

# ADU 派生检索索引

本文件由 `governance:generate` 自动生成。
所有索引内容来自设计文档标注块、源代码 @GOV 标注、测试覆盖注释和 triage 报告。
运行 `npm run governance:generate` 刷新。

边界：
- adu.md 是静态治理规则源。
- ADP.md 是开发过程运行时协议。
- CLAUDE.md 是 AI 会话入口与执行路由协议。
- adus.md 只提供派生检索索引，不定义规则、不定义过程、不承载人类裁决。

自动生成边界：
- `## 【自动生成区】` 之前仅保留元信息头部，包括文档头、边界说明和变更记录。
- 元信息头部不得写入规则、链路、模块、约束、裁决或索引内容。
- `## 【自动生成区】` 及之后内容禁止人工编辑，应由 `npm run governance:generate` 刷新。

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-21 | v1.0 | 初始版本 |

---

## 【自动生成区】

<!-- 自动生成。禁止人工编辑。-->
<!-- 运行：npm run governance:generate -->
<!-- 最后生成时间：2026-05-21T18:59:09.853Z -->

### 模块编码表

| module_code | module_name         | description               | 来源文档                                      |
| ----------- | ------------------- | ------------------------- | ----------------------------------------- |
| CORE        | Core Governance     | 项目身份、治理边界、文档体系和规则来源       | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| SYS         | System Architecture | 系统架构、跨模块协议和公共技术约束         | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| WS          | Workspace           | 工作区生命周期、文件树、搜索和文件操作边界     | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| ED          | Editor              | 文档打开、编辑、保存和编辑器内 diff 呈现   | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| AG          | Agent               | AI Provider、消息流、工具执行和输入引用 | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| DE          | Diff Review         | diff 生成、审阅、接受、拒绝、失效和终态记录  | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |

### 规则域注册表

| domain_code | description      | 来源 |
| ----------- | ---------------- | -- |
| STATE       | 状态语义、生命周期、阶段闭合   | 内置 |
| DATA        | 数据结构、字段定义、schema | 内置 |
| PERSIST     | 持久化、恢复、重建        | 内置 |
| VERIFY      | 验证、审计、一致性检查      | 内置 |
| GOV         | 文档治理、命名、变更控制     | 内置 |
| OBS         | 可观测性、错误处理、恢复     | 内置 |

### 链路注册表

| chain_id        | 主责模块 | status | 集成测试 |
| --------------- | ---- | ------ | ---- |
| WS-OPEN         | WS   | active |      |
| WS-FILE-MANAGE  | WS   | active |      |
| ED-OPEN-FILE    | ED   | active |      |
| ED-SAVE-FILE    | ED   | active |      |
| AG-SEND-MESSAGE | AG   | active |      |
| AG-TOOL-CALL    | AG   | active |      |
| DE-CREATE-DIFF  | DE   | active |      |
| DE-ACCEPT-DIFF  | DE   | active |      |
| DE-REJECT-DIFF  | DE   | active |      |
| DE-EXPIRE-DIFF  | DE   | active |      |

### 规则注册表

| rule_id           | 域       | 主链路                                                 | 来源文档                                      | registry_status | 测试覆盖                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ------- | --------------------------------------------------- | ----------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-WS-STATE-001   | STATE   | WS-OPEN                                             | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::Phase 2 governance skeleton, tests/workspaceService.test.ts::Workspace MVP service behavior                                                                                                                                                                                                  |
| BR-WS-DATA-001    | DATA    | WS-FILE-MANAGE                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::Phase 2 governance skeleton, tests/workspaceService.test.ts::recognizes PathConflict mutation results without treating them as success                                                                                                                                                       |
| BR-WS-STATE-002   | STATE   | WS-OPEN                                             | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::Phase 2 governance skeleton, tests/workspaceService.test.ts::sorts recursive FileNode children without flattening directories                                                                                                                                                                |
| BR-WS-DATA-002    | DATA    | WS-FILE-MANAGE                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::Phase 2 governance skeleton, tests/workspaceService.test.ts::sorts Workspace entries with directories first                                                                                                                                                                                  |
| BR-WS-PERSIST-001 | PERSIST | WS-OPEN                                             | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::Phase 2 governance skeleton, tests/workspaceService.test.ts::requires Workspace database metadata before treating a snapshot as initialized                                                                                                                                                  |
| BR-WS-DATA-003    | DATA    | WS-FILE-MANAGE                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::Phase 2 governance skeleton, tests/workspaceService.test.ts::deduplicates recent Workspaces by root path and keeps newest first                                                                                                                                                              |
| BR-WS-DATA-004    | DATA    | WS-FILE-MANAGE                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::Phase 2 governance skeleton, tests/workspaceService.test.ts::deduplicates recent Workspaces by root path and keeps newest first                                                                                                                                                              |
| BR-ED-STATE-001   | STATE   | ED-OPEN-FILE                                        | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/editorService.test.ts::Editor MVP service behavior, tests/governance.phase2.test.ts::keeps Workspace targets inside the active Workspace                                                                                                                                                                                |
| BR-ED-PERSIST-001 | PERSIST | ED-SAVE-FILE                                        | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/editorService.test.ts::uses editable mode for md and txt files only, tests/governance.phase2.test.ts::keeps Workspace targets inside the active Workspace                                                                                                                                                               |
| BR-AG-STATE-001   | STATE   | AG-SEND-MESSAGE                                     | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/agentService.test.ts::Agent Provider MVP service behavior, tests/agentService.test.ts::keeps InputReference readonly and message content normalized, tests/agentService.test.ts::summarizes read and search tool results, tests/governance.phase2.test.ts::keeps Editor save readiness tied to editable dirty documents |
| BR-AG-OBS-001     | OBS     | AG-TOOL-CALL                                        | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/agentService.test.ts::requires configured provider and non-empty model before sending, tests/agentService.test.ts::normalizes ProviderConfig model text, tests/governance.phase2.test.ts::keeps Editor save readiness tied to editable dirty documents                                                                  |
| BR-AG-DATA-001    | DATA    | AG-TOOL-CALL                                        | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/agentService.test.ts::creates pending ToolExecution records, tests/governance.phase2.test.ts::keeps Editor save readiness tied to editable dirty documents                                                                                                                                                              |
| BR-DE-STATE-001   | STATE   | DE-CREATE-DIFF                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/diffService.test.ts::Diff Review MVP service behavior, tests/diffService.test.ts::creates PendingDiff from current editor without mutating content, tests/governance.phase2.test.ts::keeps Agent requests behind provider validation and readonly InputReference                                                        |
| BR-DE-PERSIST-001 | PERSIST | DE-ACCEPT-DIFF                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/diffService.test.ts::allows a PendingDiff for an empty current editor document, tests/governance.phase2.test.ts::keeps Agent requests behind provider validation and readonly InputReference                                                                                                                            |
| BR-DE-STATE-002   | STATE   | DE-REJECT-DIFF                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/diffService.test.ts::accepts PendingDiff only when current content still matches original, tests/governance.phase2.test.ts::keeps Agent requests behind provider validation and readonly InputReference                                                                                                                 |
| BR-DE-STATE-003   | STATE   | DE-EXPIRE-DIFF                                      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/diffService.test.ts::rejects PendingDiff without producing write content, tests/governance.phase2.test.ts::keeps Agent requests behind provider validation and readonly InputReference                                                                                                                                  |
| BR-SYS-GOV-001    | GOV     | WS-OPEN,ED-OPEN-FILE,AG-SEND-MESSAGE,DE-CREATE-DIFF | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::keeps PendingDiff execution and terminal cards explicit                                                                                                                                                                                                                                      |
| BR-CORE-GOV-001   | GOV     | WS-OPEN,ED-OPEN-FILE,AG-SEND-MESSAGE,DE-CREATE-DIFF | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md | registered      | tests/governance.phase2.test.ts::keeps PendingDiff execution and terminal cards explicit                                                                                                                                                                                                                                      |

### 跨模块约束表（X-INDEX）

| constraint_id | 摘要                              | 涉及模块                 | 链路影响                                                                                                                                      | 来源文档                                      |
| ------------- | ------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| X-CONST-001   | 所有文件操作必须受 Workspace 边界约束        | WS,ED,AG,DE          | WS-OPEN,WS-FILE-MANAGE,ED-OPEN-FILE,AG-TOOL-CALL,DE-CREATE-DIFF                                                                           | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| X-CONST-002   | 内容编辑工具必须生成 PendingDiff，不得直接写入文档 | AG,DE,ED             | AG-TOOL-CALL,DE-CREATE-DIFF,DE-ACCEPT-DIFF                                                                                                | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| X-CONST-003   | 适合状态化表达的核心链路必须先设计状态机            | WS,ED,AG,DE          | WS-OPEN,ED-OPEN-FILE,AG-SEND-MESSAGE,DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF                                                         | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| X-CONST-004   | 代码块不得游离于技术设计文档注册规则体系之外          | CORE,SYS,WS,ED,AG,DE | WS-OPEN,WS-FILE-MANAGE,ED-OPEN-FILE,ED-SAVE-FILE,AG-SEND-MESSAGE,AG-TOOL-CALL,DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF,DE-EXPIRE-DIFF | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |

### 术语注册表

| term_id       | 所属链路                                                        | 正式中文名  | 正式英文名             | 禁用别名                   | 来源文档                                      |
| ------------- | ----------------------------------------------------------- | ------ | ----------------- | ---------------------- | ----------------------------------------- |
| TERM-CORE-001 | WS-OPEN,AG-SEND-MESSAGE,DE-CREATE-DIFF                      | 工作区    | Workspace         | 项目目录, 当前目录, 工作目录       | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-DE-001   | DE-CREATE-DIFF,DE-ACCEPT-DIFF,DE-REJECT-DIFF,DE-EXPIRE-DIFF | 待审差异   | PendingDiff       | 修改候选, diff候选, 待处理修改    | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-DE-002   | DE-ACCEPT-DIFF,DE-REJECT-DIFF,DE-EXPIRE-DIFF                | 终态差异卡  | TerminalDiffCard  | 结果卡, 结束卡, 历史卡          | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-AG-001   | AG-TOOL-CALL                                                | 工具执行   | ToolExecution     | 工具调用过程, 执行动作, tool run | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-AG-002   | AG-SEND-MESSAGE,AG-TOOL-CALL                                | 输入引用   | InputReference    | 附件, 知识库引用, @引用         | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-WS-001   | WS-FILE-MANAGE                                              | 文件节点   | FileNode          | 文件项, 文件记录, tree item   | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-WS-002   | WS-OPEN                                                     | 工作区数据库 | WorkspaceDatabase | 项目数据库, 本地库, db文件       | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-WS-003   | WS-OPEN                                                     | 最近工作区  | RecentWorkspace   | 最近项目, 最近目录, 历史工作区      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |
| TERM-WS-004   | WS-FILE-MANAGE                                              | 路径冲突   | PathConflict      | 覆盖提示, 文件冲突, 已存在错误      | docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md |

### 链路视图

#### AG-SEND-MESSAGE

| codes                                                                                                                                                                                                                 | type | rules                                                                           | 文件                           | 行号 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- | ---------------------------- | -- |
| BR-SYS-GOV-001-RB-SYS-WS-OPEN-001, BR-CORE-GOV-001-RB-SYS-WS-OPEN-001                                                                                                                                                 | RB   | BR-SYS-GOV-001, BR-CORE-GOV-001                                                 | src/App.tsx                  | 46 |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004, BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005, BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006 | DATA | BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/agentMachine.ts | 4  |
| BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007, BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008, BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009, BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010                                              | RB   | BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-CORE-GOV-001                 | src/services/agentService.ts | 16 |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-001, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-001, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-002                                                                                          | DATA | BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001                                  | src/types/agent.ts           | 5  |

#### AG-TOOL-CALL

| codes                                                                                                                                                                                                                 | type | rules                                                                           | 文件                           | 行号 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- | ---------------------------- | -- |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004, BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005, BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006 | DATA | BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/agentMachine.ts | 4  |
| BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007, BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008, BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009, BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010                                              | RB   | BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-CORE-GOV-001                 | src/services/agentService.ts | 16 |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-001, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-001, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-002                                                                                          | DATA | BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001                                  | src/types/agent.ts           | 5  |

#### DE-ACCEPT-DIFF

| codes                                                                                                                                                                                                                                                                   | type | rules                                                                                                 | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- | --------------------------- | -- |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-CORE-GOV-001                 | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003                                  | src/types/diff.ts           | 2  |

#### DE-CREATE-DIFF

| codes                                                                                                                                                                                                                                                                   | type | rules                                                                                                 | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- | --------------------------- | -- |
| BR-SYS-GOV-001-RB-SYS-WS-OPEN-001, BR-CORE-GOV-001-RB-SYS-WS-OPEN-001                                                                                                                                                                                                   | RB   | BR-SYS-GOV-001, BR-CORE-GOV-001                                                                       | src/App.tsx                 | 46 |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-CORE-GOV-001                 | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003                                  | src/types/diff.ts           | 2  |

#### DE-EXPIRE-DIFF

| codes                                                                                                                                                                                                                                                                   | type | rules                                                                                                 | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- | --------------------------- | -- |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-CORE-GOV-001                 | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003                                  | src/types/diff.ts           | 2  |

#### DE-REJECT-DIFF

| codes                                                                                                                                                                                                                                                                   | type | rules                                                                                                 | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- | --------------------------- | -- |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-CORE-GOV-001                 | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003                                  | src/types/diff.ts           | 2  |

#### ED-OPEN-FILE

| codes                                                                                                                                                                   | type | rules                                                               | 文件                            | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- | ----------------------------- | -- |
| BR-SYS-GOV-001-RB-SYS-WS-OPEN-001, BR-CORE-GOV-001-RB-SYS-WS-OPEN-001                                                                                                   | RB   | BR-SYS-GOV-001, BR-CORE-GOV-001                                     | src/App.tsx                   | 46 |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-002, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-002, BR-SYS-GOV-001-DATA-ED-ED-OPEN-FILE-003, BR-CORE-GOV-001-DATA-ED-ED-OPEN-FILE-004 | DATA | BR-ED-STATE-001, BR-ED-PERSIST-001, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/editorMachine.ts | 4  |
| BR-ED-STATE-001-GUARD-ED-ED-OPEN-FILE-005, BR-ED-PERSIST-001-RB-ED-ED-SAVE-FILE-003, BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-004                                             | RB   | BR-ED-STATE-001, BR-ED-PERSIST-001, BR-CORE-GOV-001                 | src/services/editorService.ts | 5  |
| BR-ED-STATE-001-QUERY-ED-ED-OPEN-FILE-006, BR-ED-PERSIST-001-EFFECT-ED-ED-SAVE-FILE-006, BR-CORE-GOV-001-RB-ED-ED-OPEN-FILE-006                                         | RB   | BR-ED-STATE-001, BR-ED-PERSIST-001, BR-CORE-GOV-001                 | src/services/editorService.ts | 19 |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-001, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-001                                                                                    | DATA | BR-ED-STATE-001, BR-ED-PERSIST-001                                  | src/types/editor.ts           | 2  |

#### ED-SAVE-FILE

| codes                                                                                                                                                                   | type | rules                                                               | 文件                            | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- | ----------------------------- | -- |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-002, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-002, BR-SYS-GOV-001-DATA-ED-ED-OPEN-FILE-003, BR-CORE-GOV-001-DATA-ED-ED-OPEN-FILE-004 | DATA | BR-ED-STATE-001, BR-ED-PERSIST-001, BR-SYS-GOV-001, BR-CORE-GOV-001 | src/machines/editorMachine.ts | 4  |
| BR-ED-STATE-001-GUARD-ED-ED-OPEN-FILE-005, BR-ED-PERSIST-001-RB-ED-ED-SAVE-FILE-003, BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-004                                             | RB   | BR-ED-STATE-001, BR-ED-PERSIST-001, BR-CORE-GOV-001                 | src/services/editorService.ts | 5  |
| BR-ED-STATE-001-QUERY-ED-ED-OPEN-FILE-006, BR-ED-PERSIST-001-EFFECT-ED-ED-SAVE-FILE-006, BR-CORE-GOV-001-RB-ED-ED-OPEN-FILE-006                                         | RB   | BR-ED-STATE-001, BR-ED-PERSIST-001, BR-CORE-GOV-001                 | src/services/editorService.ts | 19 |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-001, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-001                                                                                    | DATA | BR-ED-STATE-001, BR-ED-PERSIST-001                                  | src/types/editor.ts           | 2  |

#### WS-FILE-MANAGE

| codes                                                                                                                                                                                                                                                                                       | type   | rules                                                                                                               | 文件                               | 行号  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --- |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-002, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002, BR-SYS-GOV-001-DATA-WS-WS-OPEN-003, BR-CORE-GOV-001-DATA-WS-WS-OPEN-004                                                                                                                                     | DATA   | BR-WS-STATE-001, BR-WS-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001                                                    | src/machines/workspaceMachine.ts | 2   |
| BR-WS-STATE-001-GUARD-WS-WS-OPEN-005, BR-WS-DATA-001-GUARD-WS-WS-FILE-MANAGE-003, BR-CORE-GOV-001-GUARD-WS-WS-FILE-MANAGE-004                                                                                                                                                               | GUARD  | BR-WS-STATE-001, BR-WS-DATA-001, BR-CORE-GOV-001                                                                    | src/services/workspaceService.ts | 12  |
| BR-WS-STATE-001-QUERY-WS-WS-OPEN-006, BR-WS-STATE-002-QUERY-WS-WS-OPEN-006, BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006, BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006                                                                                        | QUERY  | BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-PERSIST-001, BR-WS-DATA-001, BR-CORE-GOV-001                                | src/services/workspaceService.ts | 35  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-010, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-010                                                                                                          | EFFECT | BR-WS-DATA-001, BR-WS-DATA-003, BR-WS-DATA-004, BR-CORE-GOV-001                                                     | src/services/workspaceService.ts | 89  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-011, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-011                                                                                                          | EFFECT | BR-WS-DATA-001, BR-WS-DATA-003, BR-WS-DATA-004, BR-CORE-GOV-001                                                     | src/services/workspaceService.ts | 111 |
| BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-007, BR-CORE-GOV-001-DATA-WS-WS-FILE-MANAGE-007                                                                                                                                                                                                       | DATA   | BR-WS-DATA-002, BR-CORE-GOV-001                                                                                     | src/services/workspaceService.ts | 157 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA   | BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-PERSIST-001, BR-WS-DATA-001, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004 | src/types/workspace.ts           | 2   |

#### WS-OPEN

| codes                                                                                                                                                                                                                                                                                       | type  | rules                                                                                                               | 文件                               | 行号  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --- |
| BR-SYS-GOV-001-RB-SYS-WS-OPEN-001, BR-CORE-GOV-001-RB-SYS-WS-OPEN-001                                                                                                                                                                                                                       | RB    | BR-SYS-GOV-001, BR-CORE-GOV-001                                                                                     | src/App.tsx                      | 46  |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-002, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002, BR-SYS-GOV-001-DATA-WS-WS-OPEN-003, BR-CORE-GOV-001-DATA-WS-WS-OPEN-004                                                                                                                                     | DATA  | BR-WS-STATE-001, BR-WS-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001                                                    | src/machines/workspaceMachine.ts | 2   |
| BR-WS-STATE-001-GUARD-WS-WS-OPEN-005, BR-WS-DATA-001-GUARD-WS-WS-FILE-MANAGE-003, BR-CORE-GOV-001-GUARD-WS-WS-FILE-MANAGE-004                                                                                                                                                               | GUARD | BR-WS-STATE-001, BR-WS-DATA-001, BR-CORE-GOV-001                                                                    | src/services/workspaceService.ts | 12  |
| BR-WS-STATE-001-QUERY-WS-WS-OPEN-006, BR-WS-STATE-002-QUERY-WS-WS-OPEN-006, BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006, BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006                                                                                        | QUERY | BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-PERSIST-001, BR-WS-DATA-001, BR-CORE-GOV-001                                | src/services/workspaceService.ts | 35  |
| BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-008, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-008                                                                                                                                                                                                                | QUERY | BR-WS-PERSIST-001, BR-CORE-GOV-001                                                                                  | src/services/workspaceService.ts | 52  |
| BR-WS-PERSIST-001-DATA-WS-WS-OPEN-009, BR-CORE-GOV-001-DATA-WS-WS-OPEN-009                                                                                                                                                                                                                  | DATA  | BR-WS-PERSIST-001, BR-CORE-GOV-001                                                                                  | src/services/workspaceService.ts | 66  |
| BR-WS-STATE-002-GUARD-WS-WS-OPEN-007, BR-CORE-GOV-001-GUARD-WS-WS-OPEN-007                                                                                                                                                                                                                  | GUARD | BR-WS-STATE-002, BR-CORE-GOV-001                                                                                    | src/services/workspaceService.ts | 139 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA  | BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-PERSIST-001, BR-WS-DATA-001, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004 | src/types/workspace.ts           | 2   |

### 规则视图

#### BR-AG-DATA-001

| codes                                                                                                                                                                                                                 | type | chain                         | 文件                           | 行号 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------- | ---------------------------- | -- |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004, BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005, BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006 | DATA | AG-SEND-MESSAGE, AG-TOOL-CALL | src/machines/agentMachine.ts | 4  |
| BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007, BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008, BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009, BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010                                              | RB   | AG-SEND-MESSAGE, AG-TOOL-CALL | src/services/agentService.ts | 16 |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-001, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-001, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-002                                                                                          | DATA | AG-SEND-MESSAGE, AG-TOOL-CALL | src/types/agent.ts           | 5  |

#### BR-AG-OBS-001

| codes                                                                                                                                                                                                                 | type | chain                         | 文件                           | 行号 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------- | ---------------------------- | -- |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004, BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005, BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006 | DATA | AG-SEND-MESSAGE, AG-TOOL-CALL | src/machines/agentMachine.ts | 4  |
| BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007, BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008, BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009, BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010                                              | RB   | AG-SEND-MESSAGE, AG-TOOL-CALL | src/services/agentService.ts | 16 |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-001, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-001, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-002                                                                                          | DATA | AG-SEND-MESSAGE, AG-TOOL-CALL | src/types/agent.ts           | 5  |

#### BR-AG-STATE-001

| codes                                                                                                                                                                                                                 | type | chain                         | 文件                           | 行号 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------- | ---------------------------- | -- |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004, BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005, BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006 | DATA | AG-SEND-MESSAGE, AG-TOOL-CALL | src/machines/agentMachine.ts | 4  |
| BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007, BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008, BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009, BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010                                              | RB   | AG-SEND-MESSAGE, AG-TOOL-CALL | src/services/agentService.ts | 16 |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-001, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-001, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-002                                                                                          | DATA | AG-SEND-MESSAGE, AG-TOOL-CALL | src/types/agent.ts           | 5  |

#### BR-CORE-GOV-001

| codes                                                                                                                                                                                                                                                                   | type   | chain                                                          | 文件                               | 行号  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------- | -------------------------------- | --- |
| BR-SYS-GOV-001-RB-SYS-WS-OPEN-001, BR-CORE-GOV-001-RB-SYS-WS-OPEN-001                                                                                                                                                                                                   | RB     | WS-OPEN, ED-OPEN-FILE, AG-SEND-MESSAGE, DE-CREATE-DIFF         | src/App.tsx                      | 46  |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004, BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005, BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006                                                   | DATA   | AG-SEND-MESSAGE, AG-TOOL-CALL                                  | src/machines/agentMachine.ts     | 4   |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA   | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/machines/diffMachine.ts      | 4   |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-002, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-002, BR-SYS-GOV-001-DATA-ED-ED-OPEN-FILE-003, BR-CORE-GOV-001-DATA-ED-ED-OPEN-FILE-004                                                                                                 | DATA   | ED-OPEN-FILE, ED-SAVE-FILE                                     | src/machines/editorMachine.ts    | 4   |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-002, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002, BR-SYS-GOV-001-DATA-WS-WS-OPEN-003, BR-CORE-GOV-001-DATA-WS-WS-OPEN-004                                                                                                                 | DATA   | WS-OPEN, WS-FILE-MANAGE                                        | src/machines/workspaceMachine.ts | 2   |
| BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007, BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008, BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009, BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010                                                                                                | RB     | AG-SEND-MESSAGE, AG-TOOL-CALL                                  | src/services/agentService.ts     | 16  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB     | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/services/diffService.ts      | 8   |
| BR-ED-STATE-001-GUARD-ED-ED-OPEN-FILE-005, BR-ED-PERSIST-001-RB-ED-ED-SAVE-FILE-003, BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-004                                                                                                                                             | RB     | ED-OPEN-FILE, ED-SAVE-FILE                                     | src/services/editorService.ts    | 5   |
| BR-ED-STATE-001-QUERY-ED-ED-OPEN-FILE-006, BR-ED-PERSIST-001-EFFECT-ED-ED-SAVE-FILE-006, BR-CORE-GOV-001-RB-ED-ED-OPEN-FILE-006                                                                                                                                         | RB     | ED-OPEN-FILE, ED-SAVE-FILE                                     | src/services/editorService.ts    | 19  |
| BR-WS-STATE-001-GUARD-WS-WS-OPEN-005, BR-WS-DATA-001-GUARD-WS-WS-FILE-MANAGE-003, BR-CORE-GOV-001-GUARD-WS-WS-FILE-MANAGE-004                                                                                                                                           | GUARD  | WS-OPEN, WS-FILE-MANAGE                                        | src/services/workspaceService.ts | 12  |
| BR-WS-STATE-001-QUERY-WS-WS-OPEN-006, BR-WS-STATE-002-QUERY-WS-WS-OPEN-006, BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006, BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006                                                                    | QUERY  | WS-OPEN, WS-FILE-MANAGE                                        | src/services/workspaceService.ts | 35  |
| BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-008, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-008                                                                                                                                                                                            | QUERY  | WS-OPEN                                                        | src/services/workspaceService.ts | 52  |
| BR-WS-PERSIST-001-DATA-WS-WS-OPEN-009, BR-CORE-GOV-001-DATA-WS-WS-OPEN-009                                                                                                                                                                                              | DATA   | WS-OPEN                                                        | src/services/workspaceService.ts | 66  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-010, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-010                                                                                      | EFFECT | WS-FILE-MANAGE                                                 | src/services/workspaceService.ts | 89  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-011, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-011                                                                                      | EFFECT | WS-FILE-MANAGE                                                 | src/services/workspaceService.ts | 111 |
| BR-WS-STATE-002-GUARD-WS-WS-OPEN-007, BR-CORE-GOV-001-GUARD-WS-WS-OPEN-007                                                                                                                                                                                              | GUARD  | WS-OPEN                                                        | src/services/workspaceService.ts | 139 |
| BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-007, BR-CORE-GOV-001-DATA-WS-WS-FILE-MANAGE-007                                                                                                                                                                                   | DATA   | WS-FILE-MANAGE                                                 | src/services/workspaceService.ts | 157 |

#### BR-DE-PERSIST-001

| codes                                                                                                                                                                                                                                                                   | type | chain                                                          | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- | --------------------------- | -- |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/types/diff.ts           | 2  |

#### BR-DE-STATE-001

| codes                                                                                                                                                                                                                                                                   | type | chain                                                          | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- | --------------------------- | -- |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/types/diff.ts           | 2  |

#### BR-DE-STATE-002

| codes                                                                                                                                                                                                                                                                   | type | chain                                                          | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- | --------------------------- | -- |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/types/diff.ts           | 2  |

#### BR-DE-STATE-003

| codes                                                                                                                                                                                                                                                                   | type | chain                                                          | 文件                          | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- | --------------------------- | -- |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/machines/diffMachine.ts | 4  |
| BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005, BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006, BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007, BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008, BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009                                           | RB   | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/services/diffService.ts | 8  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001                                                                                        | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/types/diff.ts           | 2  |

#### BR-ED-PERSIST-001

| codes                                                                                                                                                                   | type | chain                      | 文件                            | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- | ----------------------------- | -- |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-002, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-002, BR-SYS-GOV-001-DATA-ED-ED-OPEN-FILE-003, BR-CORE-GOV-001-DATA-ED-ED-OPEN-FILE-004 | DATA | ED-OPEN-FILE, ED-SAVE-FILE | src/machines/editorMachine.ts | 4  |
| BR-ED-STATE-001-GUARD-ED-ED-OPEN-FILE-005, BR-ED-PERSIST-001-RB-ED-ED-SAVE-FILE-003, BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-004                                             | RB   | ED-OPEN-FILE, ED-SAVE-FILE | src/services/editorService.ts | 5  |
| BR-ED-STATE-001-QUERY-ED-ED-OPEN-FILE-006, BR-ED-PERSIST-001-EFFECT-ED-ED-SAVE-FILE-006, BR-CORE-GOV-001-RB-ED-ED-OPEN-FILE-006                                         | RB   | ED-OPEN-FILE, ED-SAVE-FILE | src/services/editorService.ts | 19 |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-001, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-001                                                                                    | DATA | ED-OPEN-FILE, ED-SAVE-FILE | src/types/editor.ts           | 2  |

#### BR-ED-STATE-001

| codes                                                                                                                                                                   | type | chain                      | 文件                            | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- | ----------------------------- | -- |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-002, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-002, BR-SYS-GOV-001-DATA-ED-ED-OPEN-FILE-003, BR-CORE-GOV-001-DATA-ED-ED-OPEN-FILE-004 | DATA | ED-OPEN-FILE, ED-SAVE-FILE | src/machines/editorMachine.ts | 4  |
| BR-ED-STATE-001-GUARD-ED-ED-OPEN-FILE-005, BR-ED-PERSIST-001-RB-ED-ED-SAVE-FILE-003, BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-004                                             | RB   | ED-OPEN-FILE, ED-SAVE-FILE | src/services/editorService.ts | 5  |
| BR-ED-STATE-001-QUERY-ED-ED-OPEN-FILE-006, BR-ED-PERSIST-001-EFFECT-ED-ED-SAVE-FILE-006, BR-CORE-GOV-001-RB-ED-ED-OPEN-FILE-006                                         | RB   | ED-OPEN-FILE, ED-SAVE-FILE | src/services/editorService.ts | 19 |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-001, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-001                                                                                    | DATA | ED-OPEN-FILE, ED-SAVE-FILE | src/types/editor.ts           | 2  |

#### BR-SYS-GOV-001

| codes                                                                                                                                                                                                                                                                   | type | chain                                                          | 文件                               | 行号 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- | -------------------------------- | -- |
| BR-SYS-GOV-001-RB-SYS-WS-OPEN-001, BR-CORE-GOV-001-RB-SYS-WS-OPEN-001                                                                                                                                                                                                   | RB   | WS-OPEN, ED-OPEN-FILE, AG-SEND-MESSAGE, DE-CREATE-DIFF         | src/App.tsx                      | 46 |
| BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002, BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003, BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004, BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005, BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006                                                   | DATA | AG-SEND-MESSAGE, AG-TOOL-CALL                                  | src/machines/agentMachine.ts     | 4  |
| BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002, BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002, BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002, BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002, BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003, BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004 | DATA | DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | src/machines/diffMachine.ts      | 4  |
| BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-002, BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-002, BR-SYS-GOV-001-DATA-ED-ED-OPEN-FILE-003, BR-CORE-GOV-001-DATA-ED-ED-OPEN-FILE-004                                                                                                 | DATA | ED-OPEN-FILE, ED-SAVE-FILE                                     | src/machines/editorMachine.ts    | 4  |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-002, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002, BR-SYS-GOV-001-DATA-WS-WS-OPEN-003, BR-CORE-GOV-001-DATA-WS-WS-OPEN-004                                                                                                                 | DATA | WS-OPEN, WS-FILE-MANAGE                                        | src/machines/workspaceMachine.ts | 2  |

#### BR-WS-DATA-001

| codes                                                                                                                                                                                                                                                                                       | type   | chain                   | 文件                               | 行号  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- | -------------------------------- | --- |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-002, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002, BR-SYS-GOV-001-DATA-WS-WS-OPEN-003, BR-CORE-GOV-001-DATA-WS-WS-OPEN-004                                                                                                                                     | DATA   | WS-OPEN, WS-FILE-MANAGE | src/machines/workspaceMachine.ts | 2   |
| BR-WS-STATE-001-GUARD-WS-WS-OPEN-005, BR-WS-DATA-001-GUARD-WS-WS-FILE-MANAGE-003, BR-CORE-GOV-001-GUARD-WS-WS-FILE-MANAGE-004                                                                                                                                                               | GUARD  | WS-OPEN, WS-FILE-MANAGE | src/services/workspaceService.ts | 12  |
| BR-WS-STATE-001-QUERY-WS-WS-OPEN-006, BR-WS-STATE-002-QUERY-WS-WS-OPEN-006, BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006, BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006                                                                                        | QUERY  | WS-OPEN, WS-FILE-MANAGE | src/services/workspaceService.ts | 35  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-010, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-010                                                                                                          | EFFECT | WS-FILE-MANAGE          | src/services/workspaceService.ts | 89  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-011, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-011                                                                                                          | EFFECT | WS-FILE-MANAGE          | src/services/workspaceService.ts | 111 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA   | WS-OPEN, WS-FILE-MANAGE | src/types/workspace.ts           | 2   |

#### BR-WS-DATA-002

| codes                                                                                                                                                                                                                                                                                       | type | chain                   | 文件                               | 行号  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------- | -------------------------------- | --- |
| BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-007, BR-CORE-GOV-001-DATA-WS-WS-FILE-MANAGE-007                                                                                                                                                                                                       | DATA | WS-FILE-MANAGE          | src/services/workspaceService.ts | 157 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA | WS-OPEN, WS-FILE-MANAGE | src/types/workspace.ts           | 2   |

#### BR-WS-DATA-003

| codes                                                                                                                                                                                                                                                                                       | type   | chain                   | 文件                               | 行号  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- | -------------------------------- | --- |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-010, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-010                                                                                                          | EFFECT | WS-FILE-MANAGE          | src/services/workspaceService.ts | 89  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-011, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-011                                                                                                          | EFFECT | WS-FILE-MANAGE          | src/services/workspaceService.ts | 111 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA   | WS-OPEN, WS-FILE-MANAGE | src/types/workspace.ts           | 2   |

#### BR-WS-DATA-004

| codes                                                                                                                                                                                                                                                                                       | type   | chain                   | 文件                               | 行号  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- | -------------------------------- | --- |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-010, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-010, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-010                                                                                                          | EFFECT | WS-FILE-MANAGE          | src/services/workspaceService.ts | 89  |
| BR-WS-DATA-001-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-003-EFFECT-WS-WS-FILE-MANAGE-011, BR-WS-DATA-004-GUARD-WS-WS-FILE-MANAGE-011, BR-CORE-GOV-001-EFFECT-WS-WS-FILE-MANAGE-011                                                                                                          | EFFECT | WS-FILE-MANAGE          | src/services/workspaceService.ts | 111 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA   | WS-OPEN, WS-FILE-MANAGE | src/types/workspace.ts           | 2   |

#### BR-WS-PERSIST-001

| codes                                                                                                                                                                                                                                                                                       | type  | chain                   | 文件                               | 行号 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------- | -------------------------------- | -- |
| BR-WS-STATE-001-QUERY-WS-WS-OPEN-006, BR-WS-STATE-002-QUERY-WS-WS-OPEN-006, BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006, BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006                                                                                        | QUERY | WS-OPEN, WS-FILE-MANAGE | src/services/workspaceService.ts | 35 |
| BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-008, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-008                                                                                                                                                                                                                | QUERY | WS-OPEN                 | src/services/workspaceService.ts | 52 |
| BR-WS-PERSIST-001-DATA-WS-WS-OPEN-009, BR-CORE-GOV-001-DATA-WS-WS-OPEN-009                                                                                                                                                                                                                  | DATA  | WS-OPEN                 | src/services/workspaceService.ts | 66 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA  | WS-OPEN, WS-FILE-MANAGE | src/types/workspace.ts           | 2  |

#### BR-WS-STATE-001

| codes                                                                                                                                                                                                                                                                                       | type  | chain                   | 文件                               | 行号 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------- | -------------------------------- | -- |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-002, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002, BR-SYS-GOV-001-DATA-WS-WS-OPEN-003, BR-CORE-GOV-001-DATA-WS-WS-OPEN-004                                                                                                                                     | DATA  | WS-OPEN, WS-FILE-MANAGE | src/machines/workspaceMachine.ts | 2  |
| BR-WS-STATE-001-GUARD-WS-WS-OPEN-005, BR-WS-DATA-001-GUARD-WS-WS-FILE-MANAGE-003, BR-CORE-GOV-001-GUARD-WS-WS-FILE-MANAGE-004                                                                                                                                                               | GUARD | WS-OPEN, WS-FILE-MANAGE | src/services/workspaceService.ts | 12 |
| BR-WS-STATE-001-QUERY-WS-WS-OPEN-006, BR-WS-STATE-002-QUERY-WS-WS-OPEN-006, BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006, BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006                                                                                        | QUERY | WS-OPEN, WS-FILE-MANAGE | src/services/workspaceService.ts | 35 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA  | WS-OPEN, WS-FILE-MANAGE | src/types/workspace.ts           | 2  |

#### BR-WS-STATE-002

| codes                                                                                                                                                                                                                                                                                       | type  | chain                   | 文件                               | 行号  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------- | -------------------------------- | --- |
| BR-WS-STATE-001-QUERY-WS-WS-OPEN-006, BR-WS-STATE-002-QUERY-WS-WS-OPEN-006, BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006, BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006, BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006                                                                                        | QUERY | WS-OPEN, WS-FILE-MANAGE | src/services/workspaceService.ts | 35  |
| BR-WS-STATE-002-GUARD-WS-WS-OPEN-007, BR-CORE-GOV-001-GUARD-WS-WS-OPEN-007                                                                                                                                                                                                                  | GUARD | WS-OPEN                 | src/services/workspaceService.ts | 139 |
| BR-WS-STATE-001-DATA-WS-WS-OPEN-001, BR-WS-STATE-002-DATA-WS-WS-OPEN-001, BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001, BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001, BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001 | DATA  | WS-OPEN, WS-FILE-MANAGE | src/types/workspace.ts           | 2   |

### triage 汇总

（triage 报告存在后自动生成）

| codes | 文件 | 分类 | 已解决 |
|-------|------|------|--------|
| （待生成） | | | |

注：triage 汇总为精简视图，只包含 codes、文件、分类、已解决四列。
完整的七字段记录（含原因、已采取动作、需要人类介入）
保存在各模块的 [模块]_triage.md 报告文件中。
