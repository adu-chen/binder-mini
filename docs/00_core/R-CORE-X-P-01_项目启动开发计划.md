---
文档编号：   CORE-X-P-01
文档状态：   R
负责模块：   CORE
文档职责：   项目启动步骤计划
上游约束：   ADU.md、ADP.md、CLAUDE.md、/Users/imatstarbucks/binder-core
直接承接：   APC 草案、阶段一文档治理、阶段二代码治理
使用边界：   本文是启动计划，不是 APC，不定义最终规则
变更要求：   APC 确认后同步更新或废弃本文
---

# Binder Mini 项目启动开发计划

## 0. 当前状态

`/Users/imatstarbucks/binder-mini` 已清空旧项目内容，并复制 `/Users/imatstarbucks/adu` 治理模板。

当前根目录应只承担治理 bootstrap 入口职责：

- `ADU.md`：通用静态治理规则源
- `ADP.md`：单次任务运行时协议
- `CLAUDE.md`：AI 会话入口与执行路由协议
- `governance.config.json`：项目路径配置，当前仍处于 bootstrap 前状态
- `scripts/generate_adus.mjs`：ADUS 生成脚本
- `scripts/audit_taskflow_governance.mjs`：治理审计脚本
- `package.json`：治理脚本入口

`/Users/imatstarbucks/binder-core` 作为项目事实参考源，不直接原样复制旧治理文档。

## 1. 启动原则

1. 新项目按 ADU / ADP / CLAUDE 的新治理逻辑重新开始。
2. 不从旧 `binder-mini` 迁移任何业务代码或旧 ADUS。
3. 不把 `binder-core` 旧文档直接作为新项目权威源。
4. 先完成 APC 和阶段一文档治理，再进入代码搬迁或重写。
5. 所有新规则、链路、模块必须通过标注块生成 ADUS，不人工编辑 ADUS。
6. 代码阶段必须使用块注释格式 `/** @GOV ... */`，禁止行注释 @GOV。

## 2. 项目事实提取

从 `/Users/imatstarbucks/binder-core` 提取以下事实作为 APC 和 L1/L2 文档输入：

| 主题 | 初始事实 |
|------|----------|
| 产品定位 | 本地优先 AI 文档编辑器最小核心 |
| 核心交互 | 用户通过对话让 AI 生成 diff，用户接受或拒绝后才写入文件 |
| 应用形态 | Tauri 2 + React + TypeScript + Rust 桌面应用 |
| 数据边界 | workspace 是本地目录边界 |
| 主要模块 | CORE、WS、ED、AG、DE、SYS |
| 状态管理事实 | workspace/editor 有 XState；chat/diff 当前以 Zustand store 为实现事实 |
| AI Provider | OpenAI、Anthropic、DeepSeek |
| 硬范围工具 | read_file、list_files、search_files、create_file、delete_file、move_file、rename_file、create_folder、edit_current_editor_document、update_file、web_search |
| 核心安全约束 | AI 内容修改生成 diff，不直接写盘；文件操作按明确意图执行 |

## 3. Phase 0：Bootstrap 决策

目标：完成项目宪章确认，解除模板 bootstrap 状态。

步骤：

1. 确认项目身份
   - 项目名：`binder-mini`
   - 产品来源：参考 `binder-core`
   - 产品目标：本地优先 AI 文档编辑器最小核心
   - 明确不做：多人协同、云服务、Office 套件、知识库平台、插件市场

2. 确认 APC 路径
   - 推荐：`docs/00_core/A-CORE-C-P-01_APC.md`
   - APC 创建后文档状态必须为 `A`

3. 确认 ADUS 路径
   - 推荐：`docs/00_core/A-CORE-C-R-01_ADUS.md`
   - ADUS 由脚本生成，禁止人工编辑自动生成区

4. 确认 `governance.config.json`
   - `project_root`: `.`
   - `apc_path`: 等 APC 路径确认后写入
   - `adus_path`: 等 ADUS 路径确认后写入

5. 生成 APC 草案
   - §1 项目身份
   - §2 开发方法论
   - §3 文档体系声明
   - §4 ADU/ADP 启用声明
   - §5 AI 执行边界
   - §6 版本与变更管理

6. 等待人类确认
   - 未确认前不得创建 APC
   - 未确认前不得写入 `apc_path` / `adus_path`
   - 未确认前不得运行 `governance:generate`

完成标准：

- APC 内容和路径被人类明确确认
- `governance.config.json` 写入 `project_root`、`apc_path`、`adus_path`
- APC 文件创建完成
- `npm run governance:generate` 可生成初始 ADUS

## 4. Phase 1：文档体系初始化

目标：建立新项目的 L1 / L2 设计文档骨架。

步骤：

1. 创建 L1 项目级文档
   - `docs/00_core/A-CORE-C-D-01_产品定位与范围.md`
   - `docs/10_system/A-SYS-C-T-01_系统总体架构.md`
   - `docs/10_system/A-SYS-I-P-01_数据结构定义.md`
   - `docs/10_system/A-SYS-I-P-02_Tauri命令协议.md`
   - `docs/10_system/A-SYS-I-P-03_跨模块约束.md`

2. 创建 L2 模块级文档
   - `docs/20_capabilities/WS/A-WS-M-T-01_Workspace生命周期.md`
   - `docs/20_capabilities/ED/A-ED-M-T-01_Editor运行时.md`
   - `docs/20_capabilities/AG/A-AG-M-T-01_Agent运行时.md`
   - `docs/20_capabilities/DE/A-DE-M-T-01_DiffReview生命周期.md`

3. 写入标准文档头
   - 每份 A 状态文档必须使用 ADU §2.2 文档头
   - 每份 A 状态文档尾部必须有变更记录

4. 写入 MODULE 标注块
   - CORE：项目核心与治理
   - SYS：系统架构与协议
   - WS：workspace 生命周期与文件管理
   - ED：编辑器运行时
   - AG：Agent 与工具调用
   - DE：diff 生成、审阅、终态

5. 写入 Terminology Registry
   - Workspace
   - WorkspaceDatabase
   - PendingDiff
   - MountedPending
   - PreAppliedPending
   - TerminalDiffCard
   - InputReference
   - ToolExecution

完成标准：

- L1 / L2 文档存在且文档头合规
- 核心模块均有 `&lt;!-- MODULE --&gt;` 标注块
- 核心术语均有 `&lt;!-- TERM --&gt;` 标注块
- 运行 `npm run governance:generate` 后 ADUS 出现模块编码表和术语注册表

## 5. Phase 2：核心链路定义

目标：在写业务代码前先定义系统主链路。

步骤：

1. 定义 workspace 链路
   - `WS-OPEN`：打开 workspace
   - `WS-FILE-MANAGE`：文件创建、删除、重命名、移动
   - `WS-SEARCH`：全文搜索

2. 定义 editor 链路
   - `ED-OPEN-FILE`：打开文件
   - `ED-EDIT-SAVE`：编辑并保存
   - `ED-DIFF-RENDER`：编辑器内 diff 高亮

3. 定义 agent 链路
   - `AG-SEND-MESSAGE`：发送用户消息
   - `AG-TOOL-CALL`：工具调用执行
   - `AG-PROVIDER-CONFIG`：Provider 配置与选择

4. 定义 diff 链路
   - `DE-CREATE-DIFF`：AI 生成 pending diff
   - `DE-ACCEPT-DIFF`：接受 diff
   - `DE-REJECT-DIFF`：拒绝 diff
   - `DE-EXPIRE-DIFF`：内容变化导致 diff 失效
   - `DE-BULK-ACTION`：批量接受或拒绝

5. 定义跨模块约束
   - diff 修改不得绕过用户审阅
   - workspace 是所有文件操作边界
   - Provider API key 不进入文档内容和日志
   - chat/diff 当前实现真值不得误写为 XState 机器已落地

完成标准：

- 核心链路均有 `&lt;!-- CHAIN --&gt;` 标注块
- 跨模块约束均有 `&lt;!-- CONSTRAINT --&gt;` 标注块
- ADUS 链路注册表和跨模块约束表有实质内容

## 6. Phase 3：核心规则生成

目标：为每条核心链路生成最小可执行规则集。

步骤：

1. CORE / SYS 规则
   - 文档权威源规则
   - 模块边界规则
   - Tauri command 协议规则
   - 本地优先数据边界规则

2. WS 规则
   - workspace 必须作为文件操作边界
   - 文件树状态必须与文件系统操作结果一致
   - 删除、移动、重命名必须处理 diff 失效或路径迁移

3. ED 规则
   - 编辑器只处理 md/txt 的完整编辑能力
   - 非 md/txt 文件只读打开
   - 保存动作必须与 pending diff 状态协调

4. AG 规则
   - 未配置 Provider 时不得发送 AI 请求
   - 工具调用必须记录执行阶段
   - 编辑类工具必须生成 diff，不直接写文件
   - Input Reference 只读注入 prompt，不触发文件写入

5. DE 规则
   - pending diff 必须有明确文件路径和定位
   - accept 才能写入内容
   - reject 必须丢弃候选修改
   - expire 后不得继续接受或拒绝
   - 终态卡不得承载可执行动作

完成标准：

- 每个模块至少有 5 条核心规则
- 每条规则有 `&lt;!-- RULE --&gt;` 标注块
- 每条规则绑定至少一条主链路
- ADUS 规则注册表有实质内容

## 7. Phase 4：项目骨架创建

目标：在阶段一文档可用后创建最小可运行工程骨架。

步骤：

1. 初始化 package 信息
   - 项目名改为 `binder-mini`
   - 保留治理脚本
   - 增加 Vite、React、TypeScript、Tauri、Vitest 等脚本

2. 创建前端骨架
   - `src/main.tsx`
   - `src/App.tsx`
   - `src/index.css`
   - `src/types/`
   - `src/stores/`
   - `src/services/`

3. 创建 Tauri 骨架
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/src/lib.rs`
   - `src-tauri/src/main.rs`

4. 建立测试骨架
   - `tests/` 或 colocated `*.test.ts`
   - 每个测试文件按 ADU 要求添加 `// covers: BR-...`

5. 建立基础 UI
   - workspace 选择入口
   - 文件树占位
   - 编辑器占位
   - chat panel 占位
   - diff card 占位

完成标准：

- `npm install` 可完成依赖安装
- `npm run build` 可完成前端构建
- `npm run governance:audit` 不出现 P0/P1 治理错误
- 工程可启动最小窗口

## 8. Phase 5：阶段二代码治理接入

目标：为核心代码块建立 @GOV 标注和 triage 闭环。

步骤：

1. 为 DATA 类型添加 @GOV
   - workspace 类型
   - editor 类型
   - agent message 类型
   - diff 类型
   - provider config 类型

2. 为 GUARD 类型添加 @GOV
   - 文件类型判断
   - provider 配置完整性判断
   - diff 可操作性判断
   - workspace 边界判断

3. 为 EFFECT 类型添加 @GOV
   - store 状态变更
   - Tauri command 调用
   - 文件写入
   - diff 持久化

4. 为 RB 类型添加 @GOV
   - open workspace 流程协调
   - send message 流程协调
   - accept / reject diff 流程协调

5. 为 IO / API / QUERY / UTIL 分类
   - Tauri command 边界为 API
   - 文件读写适配为 IO
   - 只读查询为 QUERY
   - 无业务语义工具为 UTIL

6. 生成 triage 报告
   - 每个模块一份 `*_triage.md`
   - 所有 `rules: []` 块必须分类
   - RULE_MISSING 必须进入偏差报告或补规则

完成标准：

- 核心链路上的代码块均有块注释 @GOV
- ADUS 代码块索引有实质内容
- 无未处理 `NEEDS_HUMAN_DECISION`
- 无阻断性的 `RULE_MISSING`

## 9. Phase 6：最小可用产品实现顺序

目标：在治理闭环内实现可运行 MVP。

步骤：

1. Workspace MVP
   - 打开本地目录
   - 展示文件树
   - 读取 md/txt 文件
   - 最近 workspace

2. Editor MVP
   - TipTap 加载 md/txt
   - 编辑内容
   - 保存文件
   - 只读打开非 md/txt

3. Provider MVP
   - Provider 配置存储
   - 模型选择
   - 未配置提示
   - OpenAI 优先打通，Anthropic / DeepSeek 作为后续同协议扩展

4. Agent MVP
   - 发送消息
   - 流式响应
   - read_file / list_files / search_files
   - edit_current_editor_document 生成 diff

5. Diff MVP
   - pending diff 创建
   - 聊天区 diff card
   - accept / reject 单条
   - accepted / rejected 终态卡

6. Persistence MVP
   - workspace `.binder/` 目录
   - pending diff 持久化
   - reload 后恢复 pending / 终态卡

7. Search MVP
   - 文件内容索引
   - search_files 工具
   - 搜索结果展示

完成标准：

- 用户可以打开 workspace
- 用户可以编辑并保存 md/txt
- 用户可以配置 Provider 并发送消息
- AI 可生成 diff
- 用户可接受或拒绝 diff
- 接受后文件内容改变，拒绝后不改变

## 10. Phase 7：验证与发布前收敛

目标：把 MVP 收敛到可审阅、可演示、可继续开发的状态。

步骤：

1. 治理验证
   - `npm run governance:generate`
   - `npm run governance:audit`
   - 检查 ADUS 模块、链路、规则、代码块、测试覆盖表

2. 类型与测试
   - `npm run check:ts`
   - `npm run test`
   - Rust 侧 `cargo check`

3. 手工验收
   - 新建 workspace
   - 打开文件
   - AI 生成 diff
   - accept / reject
   - 重启应用后恢复状态

4. 偏差收敛
   - 汇总 RULE_MISSING
   - 汇总 NEEDS_HUMAN_DECISION
   - 决定补规则、修代码或延期

5. 文档收敛
   - 更新变更记录
   - 将失效参考文档标记为 X 或保留 R
   - 提议 APC 从 draft 升级到 baseline，但不自动升级

完成标准：

- 无 P0/P1 治理审计错误
- MVP 主链路可演示
- 阶段二核心 @GOV 覆盖完成
- 未解决事项全部进入运行报告或偏差报告

## 11. 近期执行顺序

建议下一轮按以下顺序执行：

1. 你确认 APC 草案的六个主题决策。
2. 我生成 APC 草案和推荐路径。
3. 你确认 APC 内容与路径。
4. 我写入 `governance.config.json`，创建 APC，运行 `governance:generate`。
5. 我创建阶段一 L1/L2 文档骨架。
6. 我写入 MODULE / TERM / CHAIN / RULE / CONSTRAINT 标注块。
7. 我刷新 ADUS 并运行治理审计。
8. 阶段一通过后，再开始创建代码骨架。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-21 | v0.1 | 初始版本，定义 binder-mini 按新 ADU 治理重启的分阶段计划 |
