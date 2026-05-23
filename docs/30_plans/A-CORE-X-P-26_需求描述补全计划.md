---
文档编号：   CORE-X-P-26
文档状态：   A
负责模块：   CORE,WS,ED,AG,DE
文档职责：   需求描述层文档补全计划
上游约束：   CORE-C-P-01、CORE-C-D-01、WS-M-D-01、ED-M-D-01、AG-M-D-01、DE-M-D-01
直接承接：   各模块功能主控文档、SYS-C-T-02
使用边界：   定义需求层文档的补全路线，不替代技术设计规则来源，不写运行时代码
变更要求：   补全项完成后更新本计划状态列
---

# 需求描述补全计划

## 1. 背景与差距评估

### 1.1 当前需求文档体系

| 文档 | 状态 | 覆盖需求 |
|------|------|---------|
| CORE-C-D-01 产品定义与需求边界 | A | 产品级高层需求 |
| WS-M-D-01 Workspace 功能主控 | A | REQ-WS-001~010 |
| ED-M-D-01 Editor 功能主控 | A | REQ-ED-001~008 |
| AG-M-D-01 Agent 功能主控 | A | REQ-AG-001~007 |
| DE-M-D-01 Diff Review 功能主控 | A | REQ-DE-001~007 |

### 1.2 APC G1 门禁完成标准缺口

参照 `CORE-C-P-01 §4.1`，当前需求文档存在以下系统性缺口：

**缺口 1：无 `<!-- REQ -->` 标注块**

所有功能主控文档只有 Markdown 表格形式的需求 ID，未使用 ADU 要求的 `<!-- REQ -->` 标注块格式。这导致治理脚本无法从需求层扫描 REQ 条目，规则追踪链不完整。

**缺口 2：无功能流程图或等价流程表**

APC §4.1 要求每个功能必须有流程图，覆盖：用户入口、前置条件、主流程、分支流程、异常路径、人类确认点、模块交互点、数据读写点、阻断条件、终态。当前功能主控只有需求描述和验收口径，无流程图或流程表。

**缺口 3：无问题暴露清单**

APC §4.1 要求需求阶段必须包含问题暴露清单，分类为 REQ_GAP、BOUNDARY_OPEN、REQ_CONFLICT、FLOW_INCOMPLETE、ACCEPTANCE_MISSING、NEEDS_HUMAN_DECISION、DESIGN_RISK。当前所有功能主控均无此章节。

**缺口 4：跨模块交互未显式声明**

功能需求缺少模块间交互点的明确声明表（入口方向、依赖模块、数据交换边界）。

### 1.3 与孪生项目 binder-core 的颗粒度对比

参考 `/Users/imatstarbucks/binder-core/docs/20_capabilities/` 的文档粒度：

| 模块 | binder-core 专项文档 | binder-mini 现状 | 差距 |
|------|---------------------|-----------------|------|
| AG | 功能主控 + 工具调用体系 + Prompt 架构 + Input References 规范 + Prompt Runtime 设计 + Current Operation 协议 | 功能主控（粗粒度）| 缺 4 份专项文档 |
| DE | 功能主控 + 技术架构 + DiffStore 设计 + Diff 卡视觉规范 + Diff 重构方案 | 功能主控（粗粒度）+ 技术设计 | 缺 DiffStore 和 diff 链路协议专项 |
| WS | 功能主控 + 技术架构 + 拖拽交互层 | 功能主控 + 搜索 FTS5 方案 | 缺 workspace.db 结构专项 |
| ED | 功能主控 + 技术架构 | 功能主控 + 技术架构 | 基本对齐，待补 BlockId 规范 |

## 2. 补全优先级

### 第一优先级：G1 合规修复（所有模块功能主控）

G1 合规是进入任何后续实现阶段的前提。不完成 G1 合规修复，Phase 10-13 均不得通过 G2 门禁。

必须对 4 份功能主控文档（WS/ED/AG/DE）逐一补充：

1. `<!-- REQ -->` 标注块（每条 REQ 一个）
2. 功能流程表（每条 REQ 一张，可优先使用 Flow Table 格式）
3. 问题暴露清单
4. 跨模块交互声明表

### 第二优先级：AG 专项协议文档（Phase 10-12 前置）

AG 模块当前的功能主控颗粒度不足以支撑 Phase 10-12 的设计。binder-core 已有 4 份 AG 专项文档，需要在 Binder Mini 规则体系内重新表达。

### 第三优先级：DE 专项协议文档（Phase 13 前置）

DE 模块需要 DiffStore 设计和 Diff 链路协议，这是 Phase 13 状态机实现的设计基础。

### 第四优先级：WS workspace.db 结构专项

已有 FTS5 搜索方案，但 workspace.db 整体 schema 尚无专项文档。

## 3. 补全任务清单

### 3.1 第一优先级：G1 合规修复

#### Task R-01：WS-M-D-01 G1 合规修复

**文件**：`docs/10_requirements/A-WS-M-D-01_Workspace功能主控.md`

补充内容：

- [ ] 为 REQ-WS-001 至 REQ-WS-010 各添加 `<!-- REQ -->` 标注块
- [ ] 补充 WS-FLOW-TABLE：每条 REQ 一张 Flow Table（优先用于 WS-OPEN、WS-FILE-MANAGE、WS-CLOSE）
- [ ] 补充问题暴露清单（§ 问题暴露清单）
- [ ] 补充跨模块交互声明表（WS → ED、WS → AG、WS → DE 的边界声明）

关键流程需覆盖：
- WS-001：目录选择 → `.binder` 初始化 → workspace.db 初始化 → active 状态
- WS-009：dirty 编辑 / pending diff 检查 → 用户确认 → 关闭或取消
- WS-010：FTS5 索引重建 → 查询 → 降级递归搜索

开放问题（需暴露）：
- workspace.db 迁移策略（版本升级时）
- `.binder` 目录在 git 追踪中的处理方式
- 搜索索引初始化失败时的用户可见错误格式

#### Task R-02：ED-M-D-01 G1 合规修复

**文件**：`docs/10_requirements/A-ED-M-D-01_Editor功能主控.md`

补充内容：

- [ ] 为 REQ-ED-001 至 REQ-ED-008 各添加 `<!-- REQ -->` 标注块
- [ ] 补充 ED-FLOW-TABLE：ED-OPEN-FILE、ED-SAVE-FILE、dirty 关闭确认、Markdown 转换失败路径
- [ ] 补充问题暴露清单
- [ ] 补充跨模块交互声明表（ED → WS、ED → DE 的边界声明）

关键流程需覆盖：
- REQ-ED-001：文件树点击 → 加载 → editable/readonly 判定 → 标签激活
- REQ-ED-004：dirty 标签关闭 → 确认弹窗 → 保存 or 丢弃 or 取消
- REQ-ED-006：Markdown 文件打开 → TipTap 解析 → 编辑 → 序列化 → 保存；转换失败路径

开放问题（需暴露）：
- BlockId 生成时机：打开时还是保存时（影响 Phase 13-A）
- Markdown 转换语义损失的边界（哪些格式不保证往返一致）

#### Task R-03：AG-M-D-01 G1 合规修复

**文件**：`docs/10_requirements/A-AG-M-D-01_Agent功能主控.md`

补充内容：

- [ ] 为 REQ-AG-001 至 REQ-AG-007 各添加 `<!-- REQ -->` 标注块
- [ ] 补充 AG-FLOW-TABLE：Provider 配置校验、发送消息、流式响应、工具调用往返、InputReference 注入
- [ ] 补充问题暴露清单
- [ ] 补充跨模块交互声明表（AG → WS、AG → DE 的边界声明）

关键流程需覆盖：
- REQ-AG-002：用户输入 → Provider 校验 → send_chat_message → SSE 接收 token → 流式渲染 → done/error
- REQ-AG-003：工具调用请求 → 边界校验 → 执行工具 → 结果回流同轮 → 继续流式
- REQ-AG-004：edit_current_editor_document → DE 生成 PendingDiff → diff 卡出现 → 不写文件

开放问题（需暴露）：
- API key 存储位置：Rust Keychain / localStorage / 配置文件（NEEDS_HUMAN_DECISION）
- allowedTools 过滤粒度：按场景动态过滤还是全局静态配置
- 工具调用超时边界（NEEDS_HUMAN_DECISION）

#### Task R-04：DE-M-D-01 G1 合规修复

**文件**：`docs/10_requirements/A-DE-M-D-01_DiffReview功能主控.md`

补充内容：

- [ ] 为 REQ-DE-001 至 REQ-DE-007 各添加 `<!-- REQ -->` 标注块
- [ ] 补充 DE-FLOW-TABLE：PendingDiff 创建、接受（已打开文件）、接受（未打开文件）、拒绝、失效、持久化恢复
- [ ] 补充问题暴露清单
- [ ] 补充跨模块交互声明表（DE → AG、DE → ED、DE → WS 的边界声明）

关键流程需覆盖：
- REQ-DE-001（已打开文件）：工具调用 → DE.createDiff → mounted_pending → preapplied → 绿审展示
- REQ-DE-001（未打开文件）：工具调用 → DE.createDiff → mounted_pending（不进编辑器）
- REQ-DE-002：接受 → 校验 originalText → 写磁盘 → terminal
- REQ-DE-004：文件被外部编辑 → 内容变化检测 → 自动 expire

开放问题（需暴露）：
- "保存即接受当前文件全部 pending"的确认流程（NEEDS_HUMAN_DECISION）
- 批量接受失败时的原子性语义（全部回滚 or 跳过失败继续）
- 持久化存储位置是 workspace.db 还是单独文件（已倾向 workspace.db）

### 3.2 第二优先级：AG 专项协议文档

#### Task R-05：Agent 工具调用协议文档

**参考**：binder-core `A-AG-M-P-01_工具调用体系.md`

**目标文件**：`docs/20_design/A-AG-M-P-01_工具调用协议.md`

覆盖内容：

- 工具定义格式（name、description、parameters schema）
- 工具调用完整往返协议（tool_call → 执行 → tool_result 回流）
- 工具分类：只读工具 vs 结构操作工具 vs 内容写工具
- 工具边界约束矩阵（哪些工具必须走 PathConflict，哪些必须走 Diff Review）
- 工具调用红线（delete 意图、写操作路由、边界越界行为）
- 工具 callId 与 ToolExecution 记录的关联协议

**前置门禁**：Task R-03 完成后进入。

#### Task R-06：Agent Prompt Runtime 需求规范

**参考**：binder-core `A-AG-M-T-04_Prompt Runtime设计文档.md` + `A-AG-M-T-02_Prompt架构.md`

**目标文件**：`docs/20_design/A-AG-M-P-02_PromptRuntime规范.md`（设计层，需求驱动）

覆盖内容：

- PromptRuntime 数据结构定义（对应 AG-M-T-01 §3.6）
- system prompt 组装规则（Workspace 上下文 + Current Operation + Runtime Facts）
- allowedTools 过滤规则和配置来源
- InputReference 注入位置（system / context / user message 哪层）
- 历史裁剪规则（最大 token 窗口、工具结果裁剪策略）
- Forbidden Provider Fields 阻断清单

**前置门禁**：Task R-05 完成后进入。

#### Task R-07：InputReference 规范

**参考**：binder-core `A-AG-M-T-03_Input References与上下文注入.md`

**目标文件**：`docs/20_design/A-AG-M-P-03_InputReference规范.md`

覆盖内容：

- InputReference 数据结构（target、mode、contentSnapshot）
- 用户侧引用入口（拖拽、粘贴、@mention）
- 引用内容注入策略（只读上下文注入，不触发写操作）
- 引用失效条件（Workspace 切换后引用目标不在当前 Workspace）
- 引用内容的 token 预算限制

**前置门禁**：Task R-06 完成后进入。

### 3.3 第三优先级：DE 专项协议文档

#### Task R-08：DiffStore 设计文档

**参考**：binder-core `A-DE-M-P-01_DiffStore设计.md`

**目标文件**：`docs/20_design/A-DE-M-P-01_DiffStore设计.md`

覆盖内容：

- DiffStore 数据结构（Map<diffId, PendingDiff> + TerminalDiffCard[]）
- DiffStore 作为统一网关的收口规则（所有 PendingDiff 操作必须经 DiffStore）
- DiffStore 与 diffMachine 的关系（每个 diff 有独立状态机实例还是共享）
- DiffStore 持久化接口（读写 workspace.db 的 diff 表）
- DiffStore 对外暴露的查询 API（按 filePath 查询 pending diff、按 status 过滤）

**前置门禁**：Task R-04 完成后进入；DE-M-T-01 Phase 13-A 数据结构确定后进入。

#### Task R-09：Diff 链路生命周期协议

**参考**：binder-core `A-DE-M-T-01_对话编辑技术架构.md` §3（已打开/未打开文件链路）

**目标文件**：`docs/20_design/A-DE-M-P-02_Diff链路协议.md`

覆盖内容：

- 已打开文件链路：edit_current_editor_document → PreAppliedPending → 绿审 → accept/reject
- 未打开文件链路：update_file → MountedPending → 打开后 preapply → accept/reject
- 失效触发条件：外部编辑检测、文件删除、Workspace 关闭
- accept 前校验：blockId + originalText 一致性验证
- 批量操作协议：batch_accept / batch_reject 原子语义
- 保存即接受当前文件 pending 的确认流程

**前置门禁**：Task R-08 完成后进入。

### 3.4 第四优先级：WS workspace.db 结构专项

#### Task R-10：workspace.db 数据库结构规范

**目标文件**：`docs/20_design/A-WS-M-P-01_WorkspaceDB结构.md`

覆盖内容：

- workspace.db 文件位置（`.binder/workspace.db`）
- 表结构定义（files 全文索引表、pending_diffs 表、terminal_diff_cards 表、settings 表）
- 初始化流程和迁移策略
- 文件内容 hash 计算方式（用于 baseRevision 和变化检测）
- WAL 模式和并发访问约束

**前置门禁**：WS-M-T-01（workspace 技术设计文档，待创建）完成后进入。

## 4. 执行顺序与依赖关系

```
第一优先级（可并行推进，互相独立）：
  Task R-01  WS-M-D-01 G1 合规修复
  Task R-02  ED-M-D-01 G1 合规修复
  Task R-03  AG-M-D-01 G1 合规修复
  Task R-04  DE-M-D-01 G1 合规修复

第二优先级（依赖 Task R-03）：
  Task R-05  AG 工具调用协议
  Task R-06  PromptRuntime 规范（依赖 R-05）
  Task R-07  InputReference 规范（依赖 R-06）

第三优先级（依赖 Task R-04 + DE-M-T-01 Phase 13-A）：
  Task R-08  DiffStore 设计文档
  Task R-09  Diff 链路协议（依赖 R-08）

第四优先级（可与第二/第三优先级并行）：
  Task R-10  workspace.db 结构规范
```

## 5. 流程表格式规范

本项目统一使用 Flow Table 作为功能流程图等价形式：

```markdown
| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | — | 选择本地目录 | 目录路径 | S02 | 目录无效 → ERR-01 |
| S02 | WS | 目录路径 | 校验并初始化 .binder | workspace.db | S03 | 初始化失败 → ERR-02 |
| S03 | WS | workspace.db | 加载文件树 | FileNode 列表 | DONE | 权限不足 → ERR-03 |
```

actor 枚举：User、WS、ED、AG、DE、SYS（Tauri 后端）、DB（workspace.db）

## 6. `<!-- REQ -->` 标注块格式规范

参照 ADU.md 需求标注格式，每条 REQ 使用以下块：

```html
<!-- REQ
req_id: REQ-WS-001
name: 打开 Workspace
module: WS
chains: WS-OPEN
priority: P0
status: active
-->
```

字段说明：
- `req_id`：唯一需求 ID，格式 REQ-[MODULE]-[NUMBER]
- `name`：需求简称
- `module`：主责模块
- `chains`：对应的实现链路（可多个，逗号分隔）
- `priority`：P0（核心）/ P1（重要）/ P2（扩展）
- `status`：active / deferred / blocked / needs_human_decision

## 7. 补全完成后的 G1 检查清单

每份功能主控文档完成后，必须满足：

- [ ] 所有 active 需求有 `<!-- REQ -->` 标注块
- [ ] 所有 P0 需求有 Flow Table 覆盖
- [ ] P1/P2 需求至少有简要流程描述（入口 + 主流程 + 终态）
- [ ] 问题暴露清单存在且有至少一个条目（即使是 "暂无已知开放问题"）
- [ ] 跨模块交互表覆盖所有涉及其他模块的需求
- [ ] 运行 `governance:generate` 后 REQ 标注块被正确扫描（须确认 generate 脚本支持 REQ 块）

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，基于 APC G1 门禁缺口和 binder-core 颗粒度参考制定需求描述补全计划 |
