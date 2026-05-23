---
文档编号：   SYS-C-T-02
文档状态：   A
负责模块：   SYS,WS,ED,AG,DE,CORE
文档职责：   需求到技术规则映射矩阵
上游约束：   CORE-C-P-01、CORE-C-D-01、WS-M-D-01、ED-M-D-01、AG-M-D-01、DE-M-D-01、SYS-C-T-01
直接承接：   CORE-X-P-02、CORE-X-P-12
使用边界：   记录需求与已注册技术规则的追踪关系，不替代技术规则正文
变更要求：   新增或修改需求、规则、链路、状态机后必须同步本矩阵
---

# 需求规则映射矩阵

## 1. 映射原则

1. 需求描述层使用 `REQ-*` 表达产品与功能需求。
2. 技术设计层使用 `RULE`、`CHAIN`、`CONSTRAINT`、`TERM` 表达代码规则来源。
3. 一个 `REQ-*` 可以映射多个技术规则；一个技术规则也可以承接多个需求。
4. 代码实现必须映射到技术规则，不直接映射到需求 ID。
5. 技术规则未注册前，只能作为候选规则进入计划或设计说明，不得驱动运行时代码。

## 2. Workspace 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 当前状态 |
|---------|----------|-------------------|--------|----------|
| REQ-WS-001 | 打开 Workspace | BR-WS-STATE-001、X-CONST-003 | WS-OPEN | 已覆盖 MVP 打开流程 |
| REQ-WS-002 | Workspace 边界 | BR-WS-DATA-001、X-CONST-001、BR-CORE-GOV-001 | WS-FILE-MANAGE | 已覆盖边界约束 |
| REQ-WS-003 | 递归文件树 | BR-WS-STATE-001、BR-WS-DATA-001、BR-WS-DATA-002 | WS-OPEN、WS-FILE-MANAGE | 已覆盖递归 FileNode |
| REQ-WS-004 | 最近 Workspace | BR-WS-STATE-001、BR-WS-PERSIST-001 | WS-OPEN | 已覆盖用户级持久化规则 |
| REQ-WS-005 | workspace.db 初始化 | BR-WS-STATE-001、BR-WS-STATE-002、X-CONST-003 | WS-OPEN | 已覆盖初始化规则 |
| REQ-WS-006 | 创建文件与目录 | BR-WS-DATA-001、BR-WS-DATA-003、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | 已覆盖创建与冲突协议 |
| REQ-WS-007 | 重命名、移动和删除 | BR-WS-DATA-001、BR-WS-DATA-003、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | 已覆盖结构操作与冲突协议 |
| REQ-WS-008 | 路径冲突协议 | BR-WS-DATA-001、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | 已覆盖 PathConflict 规则 |
| REQ-WS-009 | 关闭和切换 Workspace | BR-WS-STATE-001、BR-WS-STATE-003、X-CONST-003 | WS-OPEN、WS-CLOSE | 已覆盖 dirty/pending 门禁 |
| REQ-WS-010 | 搜索索引 | BR-WS-DATA-001、BR-WS-DATA-005、X-CONST-001 | WS-FILE-MANAGE、WS-SEARCH | 已覆盖 FTS5 索引主路径和递归降级 |

## 3. Editor 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 当前状态 |
|---------|----------|-------------------|--------|----------|
| REQ-ED-001 | 打开文件 | BR-ED-STATE-001、BR-ED-STATE-002、X-CONST-001 | ED-OPEN-FILE | 已覆盖 md/txt MVP 打开、readonly 判定和多标签激活 |
| REQ-ED-002 | 保存文件 | BR-ED-PERSIST-001、X-CONST-001 | ED-SAVE-FILE | 已覆盖当前文件保存 MVP |
| REQ-ED-003 | 多标签编辑 | BR-ED-STATE-002 | ED-OPEN-FILE | 已覆盖多标签数据结构和 active tab 编辑保存 |
| REQ-ED-004 | dirty 标记与关闭保护 | BR-ED-STATE-003、BR-WS-STATE-003 | ED-SAVE-FILE、WS-CLOSE | 已覆盖 dirty tab 关闭保护和 Workspace 切换阻断 |
| REQ-ED-005 | 状态栏 | BR-ED-STATE-004 | ED-OPEN-FILE | 已覆盖 active tab 状态栏派生 |
| REQ-ED-006 | TipTap/Markdown 编辑 | BR-ED-PERSIST-002 | ED-OPEN-FILE、ED-SAVE-FILE | 已覆盖 `.md` TipTap/Markdown 运行时与转换失败保存阻断 |
| REQ-ED-007 | BlockId 定位 | 待升级：ED-CAND-DATA-002 | ED-OPEN-FILE、DE-CREATE-DIFF | 前置：DE-M-T-01 Phase 13-A 数据结构完成后进入 |
| REQ-ED-008 | DiffDecoration 绿审态 | 待升级：ED-CAND-STATE-004 | ED-DIFF-RENDER、DE-CREATE-DIFF | 前置：BlockId 策略确认 + DE-M-T-01 anchor 协议完成后进入 |

## 4. Agent 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 当前状态 |
|---------|----------|-------------------|--------|----------|
| REQ-AG-001 | Provider 配置 | BR-AG-STATE-001 | AG-SEND-MESSAGE | 已覆盖 Provider 校验门控（MVP 本地模拟） |
| REQ-AG-002 | 消息发送与流式响应 | BR-AG-STATE-001 | AG-SEND-MESSAGE | MVP 已有模拟流；真实 SSE 待升级：AG-CAND-STATE-002 |
| REQ-AG-003 | 只读工具 | BR-AG-OBS-001、BR-AG-DATA-001、X-CONST-001 | AG-TOOL-CALL | 已覆盖 read_file/list_files/search_files；工具结果回流待升级：AG-CAND-DATA-002 |
| REQ-AG-004 | 内容编辑工具 | BR-DE-STATE-001、X-CONST-002 | AG-TOOL-CALL、DE-CREATE-DIFF | 已覆盖 edit_current_editor_document → PendingDiff 路由 |
| REQ-AG-005 | 工具执行记录 | BR-AG-OBS-001 | AG-TOOL-CALL | 已覆盖 ToolExecution 记录结构 |
| REQ-AG-006 | InputReference | BR-AG-DATA-001 | AG-SEND-MESSAGE、AG-TOOL-CALL | 已覆盖只读约束；上下文注入待升级：AG-CAND-DATA-004 |
| REQ-AG-007 | Prompt Runtime | 待升级：AG-CAND-DATA-003、AG-CAND-STATE-003 | AG-SEND-MESSAGE | 真实 Provider SSE 和 allowedTools 过滤在 Phase 10-12 实现 |

## 5. Diff Review 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 当前状态 |
|---------|----------|-------------------|--------|----------|
| REQ-DE-001 | PendingDiff 创建 | BR-DE-STATE-001、X-CONST-002 | DE-CREATE-DIFF | 已覆盖 createPendingDiffFromCurrentEditor |
| REQ-DE-002 | 接受 diff | BR-DE-PERSIST-001 | DE-ACCEPT-DIFF | 已覆盖；accept 前校验待升级：DE-CAND-STATE-004 |
| REQ-DE-003 | 拒绝 diff | BR-DE-STATE-002 | DE-REJECT-DIFF | 已覆盖 rejectPendingDiff |
| REQ-DE-004 | Diff 失效 | BR-DE-STATE-003 | DE-EXPIRE-DIFF | 已覆盖 shouldExpirePendingDiff |
| REQ-DE-005 | 终态不可逆 | BR-DE-STATE-001、BR-DE-STATE-002、BR-DE-STATE-003 | DE-ACCEPT-DIFF、DE-REJECT-DIFF、DE-EXPIRE-DIFF | 已覆盖 canExecutePendingDiff 守卫 |
| REQ-DE-006 | Diff 可溯源 | 待升级：DE-CAND-DATA-001 | DE-CREATE-DIFF | Phase 13-A 数据结构扩展时实现 |
| REQ-DE-007 | Diff 持久化与恢复 | 待升级：DE-CAND-PERSIST-002、DE-CAND-STATE-006 | DE-ACCEPT-DIFF、DE-EXPIRE-DIFF | Phase 13-D 持久化协议时实现 |

## 6. 候选规则追踪

以下候选规则尚未注册为正式 RULE；进入对应实现阶段前必须先升级。

| 候选规则 ID | 来源文档 | 承接需求 | 目标阶段 |
|-------------|----------|----------|----------|
| AG-CAND-STATE-002 | AG-M-T-01 | REQ-AG-002 | Phase 10 |
| AG-CAND-DATA-002 | AG-M-T-01 | REQ-AG-003 | Phase 10/11 |
| AG-CAND-DATA-003 | AG-M-T-01 | REQ-AG-007 | Phase 10 |
| AG-CAND-STATE-003 | AG-M-T-01 | REQ-AG-007 | Phase 12 |
| AG-CAND-DATA-004 | AG-M-T-01 | REQ-AG-006 | Phase 12 |
| DE-CAND-DATA-001 | DE-M-T-01 | REQ-DE-006 | Phase 13-A |
| DE-CAND-STATE-004 | DE-M-T-01 | REQ-DE-002 | Phase 13-C |
| DE-CAND-STATE-005 | DE-M-T-01 | REQ-DE-001 | Phase 13-B |
| DE-CAND-PERSIST-002 | DE-M-T-01 | REQ-DE-007 | Phase 13-D |
| DE-CAND-STATE-006 | DE-M-T-01 | REQ-DE-007 | Phase 13-D |
| ED-CAND-DATA-002 | ED-M-T-01 | REQ-ED-007 | Phase 9-E（依赖 Phase 13-A）|
| ED-CAND-STATE-004 | ED-M-T-01 | REQ-ED-008 | Phase 9-F（依赖 Phase 9-E）|

## 7. 实现追踪方式

运行时代码进入实现时，追踪链路为：

`REQ-* → SYS-C-T-02 → SYS-C-T-01 已注册 RULE/CHAIN/CONSTRAINT → @GOV 注释 → 测试覆盖`

任何代码块如果无法落到已注册技术规则，视为游离代码块，不允许合入。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v3.0 | 升级文档状态为 A；新增 AG 和 DE 需求映射表；补充候选规则追踪表；原 R 版本 v2.2 转为 X 状态 |
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
