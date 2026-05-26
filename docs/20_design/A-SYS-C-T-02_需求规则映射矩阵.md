---
文档编号：   SYS-C-T-02
文档状态：   A
负责模块：   SYS,WS,ED,AG,DE,CORE
文档职责：   需求到技术规则映射矩阵
上游约束：   CORE-C-P-01、CORE-C-D-01、WS-M-D-01、ED-M-D-01、AG-M-D-01、DE-M-D-01、SYS-C-T-01
直接承接：   CORE-X-P-27、SYS-C-UI-01
使用边界：   记录需求与已注册技术规则的检索关系，不替代技术规则正文，不表达实现完成度
变更要求：   新增或修改需求、规则、链路、状态机后必须同步本矩阵；实现状态由 ADUS、测试矩阵和推进台账记录
---

# 需求规则映射矩阵

## 1. 映射原则

1. 需求描述层使用 `REQ-*` 表达产品与功能需求。
2. 技术设计层使用 `RULE`、`CHAIN`、`CONSTRAINT`、`TERM` 表达代码规则来源。
3. 一个 `REQ-*` 可以映射多个技术规则；一个技术规则也可以承接多个需求。
4. 代码实现必须映射到技术规则，不直接映射到需求 ID。
5. 本矩阵只提供检索索引，不承载实现完成度、优先级、阶段判断或验收结论。
6. 技术规则未注册前，只能作为历史候选或设计说明，不得驱动运行时代码。

## 2. Workspace 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 检索入口 |
|---------|----------|-------------------|--------|----------|
| REQ-WS-001 | 打开 Workspace | BR-WS-STATE-001、X-CONST-003 | WS-OPEN | WS-M-D-01、WS-M-T-01、WS-M-P-02 |
| REQ-WS-002 | Workspace 边界 | BR-WS-DATA-001、X-CONST-001、BR-CORE-GOV-001 | WS-FILE-MANAGE | WS-M-T-01、SYS-C-T-01、CORE-C-P-01 |
| REQ-WS-003 | 递归文件树 | BR-WS-STATE-001、BR-WS-DATA-001、BR-WS-DATA-002 | WS-OPEN、WS-FILE-MANAGE | WS-M-T-01、WS-M-P-02 |
| REQ-WS-004 | 最近 Workspace | BR-WS-STATE-001、BR-WS-PERSIST-001 | WS-OPEN | WS-M-P-02、WS-M-P-01 |
| REQ-WS-005 | workspace.db 初始化 | BR-WS-STATE-001、BR-WS-STATE-002、X-CONST-003 | WS-OPEN | WS-M-P-01、WS-M-P-02 |
| REQ-WS-006 | 创建文件与目录 | BR-WS-DATA-001、BR-WS-DATA-003、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | WS-M-T-01、WS-M-P-02、PathConflict |
| REQ-WS-007 | 重命名、移动和删除 | BR-WS-DATA-001、BR-WS-DATA-003、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | WS-M-T-01、WS-M-P-02、PathConflict |
| REQ-WS-008 | 路径冲突协议 | BR-WS-DATA-001、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | WS-M-T-01、PathConflict |
| REQ-WS-009 | 关闭和切换 Workspace | BR-WS-STATE-001、BR-WS-STATE-003、X-CONST-003 | WS-OPEN、WS-CLOSE | WS-M-T-01、WS-M-P-02、DE-M-T-01 |
| REQ-WS-010 | 搜索索引 | BR-WS-DATA-001、BR-WS-DATA-005、X-CONST-001 | WS-FILE-MANAGE、WS-SEARCH | WS-M-T-01、WS-M-P-03 |

## 3. Editor 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 检索入口 |
|---------|----------|-------------------|--------|----------|
| REQ-ED-001 | 打开文件 | BR-ED-STATE-001、BR-ED-STATE-002、X-CONST-001 | ED-OPEN-FILE | ED-M-D-01、ED-M-T-01、Editor Runtime |
| REQ-ED-002 | 保存文件 | BR-ED-PERSIST-001、X-CONST-001 | ED-SAVE-FILE | ED-M-D-01、ED-M-T-01、Editor Runtime |
| REQ-ED-003 | 多标签编辑 | BR-ED-STATE-002 | ED-OPEN-FILE | ED-M-D-01、ED-M-T-01 |
| REQ-ED-004 | dirty 标记与关闭保护 | BR-ED-STATE-003、BR-WS-STATE-003 | ED-SAVE-FILE、WS-CLOSE | ED-M-T-01、WS-M-T-01 |
| REQ-ED-005 | 状态栏 | BR-ED-STATE-004 | ED-OPEN-FILE | ED-M-T-01、Editor Runtime |
| REQ-ED-006 | TipTap/Markdown 编辑 | BR-ED-PERSIST-002、BR-ED-PERSIST-003 | ED-OPEN-FILE、ED-SAVE-FILE | ED-M-T-01、Editor Runtime |
| REQ-ED-007 | BlockId 定位 | BR-ED-DATA-002 | ED-OPEN-FILE、DE-CREATE-DIFF | ED-M-T-01、AG-M-P-02、DE-M-T-01 |
| REQ-ED-008 | DiffDecoration 绿增 | BR-ED-STATE-006、BR-ED-STATE-005、BR-DE-UI-002 | ED-DIFF-RENDER、DE-CREATE-DIFF | ED-M-T-01、DE-M-T-01、DE UI 规则 |

## 4. Agent 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 检索入口 |
|---------|----------|-------------------|--------|----------|
| REQ-AG-001 | Provider 配置 | BR-AG-STATE-001、BR-AG-UI-001 | AG-SEND-MESSAGE | AG-M-D-01 §3；AG-M-P-04 Provider 校验；ProviderConfig UI |
| REQ-AG-001-A | API key 持久化 | BR-AG-SEC-001、BR-AG-PERSIST-002 | AG-SEND-MESSAGE | AG-M-D-01 §8；AG-M-T-01 ProviderCredential；ProviderConfig UI；后端 Provider 凭据存储 |
| REQ-AG-002 | 消息发送与流式响应 | BR-AG-STATE-001、BR-AG-STATE-002 | AG-SEND-MESSAGE | AG-M-P-04 发送状态机；AG-M-T-01 Provider SSE 协议 |
| REQ-AG-003 | 只读与检索工具 | BR-AG-OBS-001、BR-AG-DATA-001、BR-AG-DATA-002、X-CONST-001 | AG-TOOL-CALL | AG-M-P-01 工具矩阵；AG-M-P-02 allowedTools；ToolResult 回流协议 |
| REQ-AG-004 | 内容编辑工具 | BR-DE-STATE-001、BR-AG-DATA-003、BR-AG-DATA-004、X-CONST-002 | AG-TOOL-CALL、DE-CREATE-DIFF | AG-M-P-01 内容写工具；AG-M-P-02 LogicalStateSnapshot；DE-M-T-01 PendingDiff；ED 字符精确替换 |
| REQ-AG-004-B | 结构操作工具 | BR-AG-TOOL-001、BR-WS-DATA-001、BR-WS-DATA-003、BR-WS-DATA-004、X-CONST-001 | AG-TOOL-CALL、WS-FILE-MANAGE | AG-M-P-01 结构工具；WS-M-T-01 PathConflict；Workspace 边界规则 |
| REQ-AG-005 | 工具执行记录 | BR-AG-OBS-001 | AG-TOOL-CALL | AG-M-P-01 ToolExecution / ToolResult；AG-M-P-04 toolCalling |
| REQ-AG-006 | InputReference | BR-AG-DATA-001 | AG-SEND-MESSAGE、AG-TOOL-CALL | AG-M-P-03 InputReference；AG-M-P-02 L1 注入；Diff Review / WS 工具边界 |
| REQ-AG-007 | Prompt Runtime | BR-AG-SEC-001、BR-AG-STATE-003、BR-AG-DATA-004 | AG-SEND-MESSAGE、AG-TOOL-CALL | AG-M-P-02 PromptRuntime L0-L3；AG-M-P-01 allowedTools；Provider payload guard；ED LogicalStateSnapshot |
| REQ-AG-008 | 取消流式响应 | AG-M-P-04 §4（cancelling 状态）、BR-AG-UI-001 | AG-SEND-MESSAGE | AG-M-P-04 cancelling；ChatInput 状态驱动 UI |
| REQ-AG-009 | Chat 状态机 | AG-M-P-04 | AG-SEND-MESSAGE、AG-TOOL-CALL | AG-M-P-04 chatMachine 状态与事件表 |
| REQ-AG-010 | 聊天历史持久化 | BR-AG-PERSIST-001 | AG-SEND-MESSAGE | AG-M-P-04 持久化；WS-M-P-01 workspace.db |
| REQ-AG-011 | 历史 diff 卡片展示 | BR-AG-PERSIST-001 | AG-SEND-MESSAGE、DE-CREATE-DIFF | AG-M-P-04 历史消息恢复；DE 终态 DiffCard |

## 5. Diff Review 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 检索入口 |
|---------|----------|-------------------|--------|----------|
| REQ-DE-001 | PendingDiff 创建 | BR-DE-STATE-001、BR-DE-STATE-005、X-CONST-002、BR-DE-UI-002 | DE-CREATE-DIFF | DE-M-T-01 PendingDiff；AG-M-P-01 内容写工具；ED-DIFF-RENDER |
| REQ-DE-002 | 接受 diff | BR-DE-PERSIST-001、BR-DE-STATE-004、BR-DE-STATE-010、BR-DE-STATE-011、BR-DE-UI-001 | DE-ACCEPT-DIFF | DE-M-T-01 接受流；WS-M-P-01 workspace.db；DiffCard UI |
| REQ-DE-003 | 拒绝 diff | BR-DE-STATE-002、BR-DE-UI-001 | DE-REJECT-DIFF | DE-M-T-01 拒绝流；DiffCard UI |
| REQ-DE-004 | Diff 失效 | BR-DE-STATE-003、BR-DE-STATE-012、BR-DE-UI-001 | DE-EXPIRE-DIFF | DE-M-T-01 失效规则；DiffCard UI |
| REQ-DE-005 | 终态不可逆 | BR-DE-STATE-001、BR-DE-STATE-002、BR-DE-STATE-003 | DE-ACCEPT-DIFF、DE-REJECT-DIFF、DE-EXPIRE-DIFF | DE-M-T-01 终态规则 |
| REQ-DE-006 | Diff 可溯源 | BR-DE-DATA-001 | DE-CREATE-DIFF | DE-M-T-01 PendingDiff 元数据 |
| REQ-DE-007 | Diff 持久化与恢复 | BR-DE-PERSIST-002、BR-DE-STATE-013 | DE-ACCEPT-DIFF、DE-EXPIRE-DIFF | DE-M-T-01 持久化恢复；WS-M-P-01 pending_diffs |
| REQ-DE-008 | 标签关闭时的 diff 处理 | BR-DE-STATE-014 | DE-REJECT-DIFF、DE-ACCEPT-DIFF | DE-M-T-01 Tab 关闭门禁；Editor tab 生命周期 |
| REQ-DE-009 | Workspace 关闭时 pending 不继承 | BR-DE-STATE-013 | DE-EXPIRE-DIFF | DE-M-T-01 Workspace 关闭策略 |
| REQ-DE-010 | 应用意外关闭后恢复 | BR-DE-PERSIST-002 | DE-EXPIRE-DIFF | DE-M-T-01 恢复校验；WS-M-P-01 pending_diffs |
| REQ-DE-011 | diff 叠加处理 | BR-DE-STATE-012 | DE-CREATE-DIFF、DE-EXPIRE-DIFF | DE-M-T-01 LogicalState 变化规则 |
| REQ-DE-012 | 未打开文件 diff 继承流 | BR-DE-STATE-005、BR-DE-DATA-001 | DE-CREATE-DIFF、DE-EXPIRE-DIFF | DE-M-T-01 closed-file/open-file 继承流 |

## 6. 历史候选规则索引

以下条目仅保留历史检索关系，不能作为代码 `@GOV` 映射目标，也不表达实现状态。

| 历史候选规则 ID | 来源文档 | 承接需求 | 现行检索入口 |
|-----------------|----------|----------|--------------|
| ~~AG-CAND-STATE-002~~ | AG-M-T-01 | REQ-AG-002 | BR-AG-STATE-002 |
| ~~AG-CAND-DATA-002~~ | AG-M-T-01 | REQ-AG-003 | BR-AG-DATA-002 |
| ~~AG-CAND-DATA-003~~ | AG-M-T-01 | REQ-AG-007 | BR-AG-SEC-001 |
| ~~AG-CAND-STATE-003~~ | AG-M-T-01 | REQ-AG-007 | BR-AG-STATE-003 |
| ~~AG-CAND-DATA-004~~ | AG-M-T-01 | REQ-AG-006 | BR-AG-DATA-001 |
| ~~AG-CAND-PERSIST-001~~ | AG-M-P-04 | REQ-AG-010,REQ-AG-011 | BR-AG-PERSIST-001 |
| ~~AG-CAND-DATA-005~~ | AG-M-P-01 | REQ-AG-004 | BR-AG-DATA-003 |
| ~~DE-CAND-DATA-001~~ | DE-M-T-01 | REQ-DE-006 | BR-DE-DATA-001 |
| ~~DE-CAND-STATE-004~~ | DE-M-T-01 | REQ-DE-002 | BR-DE-STATE-004 |
| ~~DE-CAND-STATE-005~~ | DE-M-T-01 | REQ-DE-001 | BR-DE-STATE-005 |
| ~~DE-CAND-PERSIST-002~~ | DE-M-T-01 | REQ-DE-007,REQ-DE-010 | BR-DE-PERSIST-002 |
| ~~DE-CAND-STATE-006~~ | DE-M-T-01 | REQ-DE-007,REQ-DE-009 | BR-DE-STATE-013 |
| ~~ED-CAND-DATA-002~~ | ED-M-T-01 | REQ-ED-007 | BR-ED-DATA-002 |
| ~~ED-CAND-STATE-004~~ | ED-M-T-01 | REQ-ED-008 | BR-ED-STATE-006 |

## 7. 检索追踪方式

运行时代码审计时，检索链路为：

`REQ-* → SYS-C-T-02 → SYS-C-T-01 已注册 RULE/CHAIN/CONSTRAINT → @GOV 注释 → 测试覆盖`

本链路只提供定位入口。是否已实现、是否覆盖测试、是否存在功能阻断，必须以 ADUS、测试矩阵、运行验证和代码审计结论为准。任何代码块如果无法落到已注册技术规则，视为游离代码块，不允许合入。

## 8. 冻结声明

截至 2026-05-25，本矩阵作为 `docs/10_requirements` → `docs/20_design` 的冻结检索基线。

冻结口径：

1. 当前有效需求 ID 均有对应的 RULE / CONSTRAINT / 专项状态机设计检索入口；本条不表示实现已完成。
2. `REQ-AG-004-B` 作为独立需求映射到结构操作工具链，不再并入 `REQ-AG-004`。
3. `*-CAND-*` 仅作为历史检索记录保留，不得作为实现代码 `@GOV` 映射目标。
4. 进入开发计划后，任何需求或规则增改必须先更新本矩阵，再进入实现拆解；实现完成度仍由验证文档记录。
5. （v4.0 补充）BR-SYS-UI-001/002、BR-DE-UI-001/002、BR-AG-UI-001 五条 UI 领域规则已注册并回写至对应 REQ-* 行（§3/§4/§5）；跨模块布局约束规则（BR-SYS-UI-001/002）无单一 REQ-* 对应，单独列入 §9。

## 9. UI 层规则映射

以下 UI 规则由 SYS-C-UI-01 定义，约束全局布局和状态驱动渲染，不对应单一功能需求，属跨模块结构约束：

| 规则 ID | 规则简述 | 来源链路 | 约束层 |
|---------|---------|---------|-------|
| BR-SYS-UI-001 | workspaceMachine 状态是所有面板可用性的唯一驱动源；NoWorkspace / Loading → 功能 UI 不可用；Error → 仅错误展示 + 恢复入口 | WS-OPEN、WS-CLOSE | 跨 WS / ED / AG / DE 所有面板 |
| BR-SYS-UI-002 | 三栏布局恒定维持；ResizeHandle 宽度持久化到 localStorage（key: `binder-panel-left-width` / `binder-panel-right-width`）；左栏 180px–480px，右栏 260px–600px，中栏最小 360px | WS-OPEN | SYS / 布局层 |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-25 | v4.2 | 补齐 REQ-AG-001-A API key 持久化映射：新增 BR-AG-PERSIST-002 检索入口，明确 ProviderCredential 为应用级后端持久化，不进入 workspace.db 或前端状态 |
| 2026-05-25 | v4.3 | 补齐 ActiveFile 编辑上下文映射：REQ-AG-004/007 增加 BR-AG-DATA-004，明确 edit_current_editor_document 必须以 ED LogicalStateSnapshot 为上下文源，read_file/DiskState 不得替代当前编辑器逻辑态 |
| 2026-05-25 | v4.1 | 治理修复：本矩阵改为检索索引，不再使用“当前状态/已覆盖/Phase”表达实现完成度；§4 Agent 映射补齐 PromptRuntime、InputReference、工具矩阵、状态机和持久化检索入口；§6 改为历史候选规则索引；§7/§8 明确实现状态由 ADUS、测试矩阵、运行验证和代码审计结论承载 |
| 2026-05-24 | v4.0 | UI 规则映射同步：BR-SYS-UI-001/002（跨模块布局）、BR-DE-UI-001/002（DiffCard 视觉状态）、BR-AG-UI-001（ChatInput 状态驱动）五条规则注册后回写至对应 REQ 行；新增 §9 UI 层规则映射（BR-SYS-UI-001/002 无对应 REQ-* 行）；§8 冻结声明补充第 5 条 UI 规则条款；直接承接更新为 CORE-X-P-27、SYS-C-UI-01 |
| 2026-05-23 | v3.0 | 升级文档状态为 A；新增 AG 和 DE 需求映射表；补充候选规则追踪表；原 R 版本 v2.2 转为 X 状态 |
| 2026-05-23 | v3.1 | §4 REQ-AG-003 名称改为"只读与检索工具"；§4 补充 REQ-AG-008~011 行；§5 补充 REQ-DE-008~011 行 |
| 2026-05-24 | v3.2 | REQ-ED-008 名称"绿审态"改为"绿增"（术语统一） |
| 2026-05-24 | v3.3 | §4 REQ-AG-010 状态改为"持久化为必须需求"（不可延后），添加 AG-CAND-PERSIST-001 追踪；§5 REQ-DE-001/002/004 补充已升级正式规则引用；REQ-DE-011 更名为"diff 叠加处理"并补充设计决策（BR-DE-STATE-012 子场景，非冲突错误）；新增 REQ-DE-012（继承流）；§6 候选规则追踪表增加状态列，标记 6 条已升级候选，新增 AG-CAND-PERSIST-001 |
| 2026-05-24 | v3.4 | §4 REQ-AG-004 状态更新（originalText+newText 精确替换接口，AG-CAND-DATA-005 追踪）；§5 REQ-DE-001 状态更新（字符精确替换 + appliedRange）；§6 候选规则追踪表新增 AG-CAND-DATA-005（精确替换接口约束）|
| 2026-05-24 | v3.6 | 映射修复：§4 REQ-AG-002 引用 BR-AG-STATE-002；REQ-AG-003 引用 BR-AG-DATA-002；REQ-AG-004 引用 BR-AG-DATA-003、BR-AG-TOOL-001；REQ-AG-006 语义升级为结构化内容载体（对齐 BR-AG-DATA-001 v2.8）；REQ-AG-007 引用 BR-AG-SEC-001；REQ-AG-008/009 引用 AG-M-P-04；REQ-AG-010/011 引用 BR-AG-PERSIST-001；§3 REQ-ED-007 引用 BR-ED-DATA-002；REQ-ED-008 引用 BR-ED-STATE-006；§5 REQ-DE-007 引用 BR-DE-PERSIST-002/STATE-013；REQ-DE-008 引用 BR-DE-STATE-014；REQ-DE-009 引用 BR-DE-STATE-013；REQ-DE-010 引用 BR-DE-PERSIST-002；§6 候选规则追踪表标记 AG-CAND-DATA-004/PERSIST-001/DATA-005、DE-CAND-PERSIST-002/STATE-006、ED-CAND-DATA-002/STATE-004 全部已升级或已吸收 |
| 2026-05-24 | v3.7 | 审计修复：REQ-AG-007 补充 BR-AG-STATE-003，AG-CAND-STATE-003 升级为正式 allowedTools 动态过滤与未授权 ToolCall 拒绝规则 |
| 2026-05-24 | v3.8 | 审计修复：REQ-AG-004-B 从 REQ-AG-004 中拆出独立映射行，BR-AG-TOOL-001 专门承接结构操作工具链 |
| 2026-05-24 | v3.9 | 冻结：新增 §8 冻结声明，确认当前有效需求 ID 已全部映射到正式规则、约束或专项状态机设计，`*-CAND-*` 不再作为实现映射目标 |
| 2026-05-24 | v3.5 | §5 REQ-ED-006 已注册规则补充 BR-ED-PERSIST-003，状态说明扩展至包含 `.txt` TipTap 纯文本序列化路径 |
| 2026-05-22 | v2.2 | 将 REQ-ED-006 映射到 Editor Markdown 正式规则 |
| 2026-05-22 | v2.1 | 标记 Editor TipTap/Markdown 技术选型已确认 |
| 2026-05-22 | v2.0 | 将 Editor dirty 关闭保护和状态栏候选规则升级为正式规则映射 |
| 2026-05-22 | v1.9 | 将 Editor 多标签候选规则升级为正式规则映射 |
| 2026-05-22 | v1.8 | 新增 Editor Phase 9 需求与候选规则映射 |
| 2026-05-22 | v1.7 | 将 Workspace 搜索索引候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.6 | 补充 Workspace 搜索索引 FTS5 方案状态 |
| 2026-05-22 | v1.5 | 将 Workspace 关闭切换门禁候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.4 | 标记 Workspace rename/move/delete 结构操作实现完成 |
| 2026-05-22 | v1.3 | 将 Workspace 创建结构操作与 PathConflict 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.2 | 将最近 Workspace 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.1 | 将 Workspace 初始化与递归 FileNode 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.0 | 初始版本，建立 Workspace 需求到技术规则映射 |
