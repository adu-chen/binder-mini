---
文档编号：   CORE-X-P-12
文档状态：   R
负责模块：   CORE
文档职责：   binder-core 需求颗粒度对齐计划
上游约束：   CORE-C-P-01、CORE-C-D-01、SYS-C-T-01、CORE-X-P-02
直接承接：   后续 Issue Trace、技术设计补全、实现阶段重排
使用边界：   定义颗粒度补齐路线，不替代技术设计规则来源
变更要求：   计划项进入实现前必须先补对应技术设计规则、状态机、接口协议和测试方案
---

# 颗粒度对齐计划

## 1. 背景

当前 Binder Mini 已完成一个治理可运行 MVP：

1. Workspace 打开和顶层文件读取。
2. md/txt 编辑和保存。
3. Agent provider 占位、模拟流式响应、只读工具。
4. 当前编辑器文件的 PendingDiff、接受、拒绝、失效。
5. GitHub 开源发布基础材料。

重新阅读 `/Users/imatstarbucks/binder-core` 的产品定义、模块主控、工具协议、数据结构、Tauri Command 协议和测试矩阵后确认：当前 Binder Mini 的实现颗粒度低于 binder-core 硬范围。后续开发必须从“最小演示核心”升级为“对齐 binder-core 硬范围的开源最小核心”。

## 2. 对齐原则

1. binder-core 文档作为需求和颗粒度参考，不直接成为 Binder Mini 的代码规则来源。
2. Binder Mini 的代码规则仍必须先进入本项目技术设计文档，再进入实现。
3. 每个新增功能链必须先补齐：
   - 功能描述文档
   - 技术设计规则
   - Tauri command / 数据结构协议
   - 状态机或状态流
   - 验收标准和测试方案
   - Issue Trace Scope Lock
4. 不再用粗粒度 Phase 3/4/5 表述直接开发复杂功能；后续必须按模块专项拆分。

## 3. 差异归档

| 模块 | 当前状态 | binder-core 颗粒度 | 差异判断 |
|------|----------|-------------------|----------|
| WS | 打开 workspace、顶层文件列表 | 递归文件树、最近 workspace、创建、删除、重命名、移动、导入、关闭/切换、FTS5 搜索、workspace.db | 严重不足 |
| ED | 单 textarea、单文件、md/txt 保存 | TipTap、Markdown 转换、多标签、dirty 保护、BlockId、DiffDecoration、状态栏 | 严重不足 |
| AG | provider 占位、本地模拟流、只读工具 | 真实 Provider SSE、tool_calls、工具结果同轮回流、多配置、Prompt Runtime、Input References、web_search | 严重不足 |
| DE | 当前文件 pending diff、单条 accept/reject/expire | Mounted/PreApplied、已打开/未打开链路、绿审态、批量操作、持久化、error 卡、定位门禁 | 严重不足 |
| SYS | 首批规则和简化 command | 完整数据结构、Tauri command、错误协议、事件协议、X-INDEX | 不足 |
| VAL | 服务单测和治理审计 | 非法路径矩阵、集成测试、场景测试、Prompt/Tool/Diff 回归门禁 | 不足 |
| OSS | 基础 README/LICENSE/CI | 可发布仓库、示例 workspace、截图、安装说明、发布包检查 | 部分不足 |

## 4. 后续阶段重排

### Phase 7：设计颗粒度补齐

目标：先把本项目文档颗粒度补到可承接 binder-core 硬范围。

交付物：

1. `Workspace 功能主控`：递归文件树、文件操作、搜索、最近 workspace、关闭/切换。
2. `Editor 功能主控`：多标签、dirty、TipTap/Markdown、BlockId、DiffDecoration。
3. `Agent 功能主控`：真实 provider、工具矩阵、配置、Input References、Prompt Runtime。
4. `Diff Review 功能主控`：Mounted/PreApplied、已打开/未打开、批量、持久化、error。
5. `系统接口协议`：数据结构、Tauri command、错误载荷、流式事件。
6. `测试矩阵`：非法路径和模块门禁。

完成标准：

- 技术设计文档中注册新增 MODULE/TERM/CHAIN/CONSTRAINT/RULE。
- ADUS 刷新后无缺口。
- 不写运行时代码。

### Phase 8：Workspace 硬范围

目标：补齐 workspace 作为所有模块基础设施的真实能力。

实施顺序：

1. 递归 `list_directory` 和 FileTree 展开/折叠。
2. 最近 workspace 记录。
3. `.binder/` 目录初始化。
4. `workspace.db` 基础结构。
5. `create_file` / `create_folder`。
6. `rename_item` / `move_item` / `delete_item`。
7. 路径冲突 `PATH_CONFLICT` 结构。
8. 关闭/切换 workspace 的 dirty/pending 门禁。
9. 搜索索引方案：先设计 FTS5，再替换递归搜索。

关键门禁：

- 所有文件操作必须受 workspace 边界约束。
- 结构冲突未确认不得落盘。
- pending diff 或 dirty 文件影响结构移动时必须阻断或进入确认流程。

### Phase 9：Editor 颗粒度对齐

目标：从 textarea MVP 迁移到可承载 diff 定位和多文件编辑的编辑器。

实施顺序：

1. 多标签数据结构和 editorMachine per tab。
2. dirty 标记、关闭保护、状态栏。
3. TipTap/Markdown 技术选型确认。
4. Markdown 读取与保存转换。
5. BlockId 生成和持久化策略。
6. DiffDecoration 绿审态骨架。

关键门禁：

- md/txt 主流程不得回退。
- 保存当前文件前必须检查 pending diff 影响。
- BlockId 不得由模型提供执行权威。

### Phase 10：Agent Provider 与配置主链

目标：把模拟 Agent 改成真实 provider 主链。

实施顺序：

1. 多 provider 配置结构：`binder-ai-configs`。
2. ModelSelectorBar 与配置面板。
3. 后端 `send_chat_message` command。
4. OpenAI compatible SSE。
5. `chat-stream-event` 协议。
6. 取消/错误/超时恢复。
7. Provider payload debug。

关键门禁：

- API key 不得进入日志。
- 流式错误必须收口，UI 不得停在假执行中。
- provider 配置缺失不得发送。

### Phase 11：Agent 工具矩阵

目标：补齐 binder-core 硬范围工具。

实施顺序：

1. 统一 ToolResult 结构。
2. 只读工具结果回流当前聊天轮次。
3. `create_file` / `create_folder`。
4. `rename_file` / `move_file` 冲突确认。
5. `delete_file` 明确删除意图直执和审计字段。
6. `web_search` 最小后端 HTTP 搜索结果卡。
7. `update_file` 设计和实现未打开文件 diff proposal。

关键门禁：

- 内容写工具必须走 Diff Review。
- 结构工具冲突必须先确认。
- 删除必须只在明确删除意图下执行。
- 工具结果不得伪装成 user message。

### Phase 12：Prompt Runtime 与 Input References

目标：让 Agent 请求具备 binder-core 所需的上下文治理颗粒度。

实施顺序：

1. Current Operation 最小结构。
2. Runtime Facts。
3. allowedTools 过滤。
4. Provider-visible prompt assembly。
5. Input References 标签模型。
6. 粘贴 / 拖拽引用入口。
7. 历史裁剪和 sanitizer。
8. forbidden provider fields 阻断。

关键门禁：

- 引用不得生成执行目标权威。
- 历史不得补当前事实。
- provider-visible tools 必须来自 allowedTools。
- `edit_current_editor_document` 不接受模型提供 path/blockId/offset/hiddenAnchor。

### Phase 13：Diff Review v2

目标：把当前 PendingDiff MVP 升级到 binder-core 的审阅状态模型。

实施顺序：

1. Diff 数据结构扩展：`mounted_pending`、`preapplied_pending`、终态、source、baseRevision。
2. diffStore 或等价 gateway 收口。
3. `edit_current_editor_document` 当前文件链路。
4. `update_file` 未打开文件链路。
5. 编辑器绿审态。
6. 聊天区 diff 卡事实源改为 diff store。
7. 单条 accept/reject。
8. 批量 accept/reject。
9. 保存即接受当前文件 pending 的确认流程。
10. workspace 关闭/切换时 pending 统一 expired。
11. 持久化和恢复。

关键门禁：

- 工具执行完成但未生成 diff 不得显示成功态。
- Accept 前必须校验原文和定位。
- Reject 只对 PreAppliedPending 回滚正文。
- Expire 不回滚正文。
- 终态不可回到 pending。

### Phase 14：验证矩阵与发布收敛

目标：把测试从“服务单测”提升到“规则门禁”。

实施顺序：

1. 扩展测试矩阵文档。
2. Workspace command 集成测试。
3. Agent stream/tool mixed 结算测试。
4. Diff opened/unopened 生命周期测试。
5. Input References 非法路径测试。
6. Prompt Runtime allowedTools / forbidden fields 测试。
7. CI 分层脚本。
8. 示例 workspace 和截图。
9. 发布包检查。

完成标准：

- 本地 `check:all` 通过。
- GitHub Actions 通过。
- 核心非法路径均有覆盖。
- README 限制说明与真实实现一致。

## 5. 优先级建议

第一优先级：

1. Phase 7 设计颗粒度补齐。
2. Phase 8 Workspace 硬范围。
3. Phase 13 Diff Review v2 的数据结构设计。

第二优先级：

1. Phase 10 真实 Provider。
2. Phase 11 工具矩阵。
3. Phase 12 Prompt Runtime。

第三优先级：

1. Phase 9 TipTap/BlockId。
2. Phase 14 完整验证矩阵。

理由：Workspace 与 Diff 数据事实是后续 Agent 工具、Prompt Runtime 和编辑器高亮的基础。如果先做真实 Provider 或复杂 Prompt，缺少 workspace.db、diff 状态和文件操作协议会导致后续返工。

## 6. 下一个建议任务

下一步不要直接继续写功能代码。建议执行：

`Phase 7-A：补 Workspace 功能主控与技术设计`

Scope 建议：

- 新增 Workspace 功能主控文档。
- 新增/扩展 Workspace 技术设计规则。
- 注册文件操作、最近 workspace、workspace.db、搜索索引、关闭/切换链路。
- 不写运行时代码。

完成后再进入 `Phase 8-A：递归文件树与 workspace 初始化`。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，基于 binder-core 需求颗粒度差异补齐后续开发计划 |
