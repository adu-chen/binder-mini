---
文档编号：   CORE-X-P-02
文档状态：   X
负责模块：   CORE
文档职责：   开发实施计划
上游约束：   CORE-C-P-01、CORE-C-D-01、SYS-C-T-01
直接承接：   代码实现、版本管理、发布准备
使用边界：   定义落地顺序，不替代技术设计规则来源
变更要求：   计划变更影响实现规则时必须同步技术设计文档
---

# 开发实施计划

## 1. 落地顺序

### Phase 1：文档治理闭环

1. 建立功能需求描述、技术设计、开发计划三层文档体系。
2. 在技术设计文档中注册 MODULE、TERM、CHAIN、CONSTRAINT、RULE。
3. 运行 `npm run governance:generate` 刷新 ADUS。
4. 运行 `npm run governance:audit` 检查治理缺口。

完成标准：ADUS 具有模块编码表、术语注册表、链路注册表、规则注册表和跨模块约束表。

### Phase 2：工程骨架

1. 初始化 Git 仓库。
2. 建立 Tauri 2 + React + TypeScript + Rust 项目骨架。
3. 创建 workspace、editor、agent、diff 的目录和状态机文件。
4. 添加最小测试环境。
5. 为骨架代码添加第一批 @GOV 标注。

完成标准：项目可构建，核心骨架无游离代码块。

### Phase 3：Workspace 与 Editor MVP

1. 实现打开 workspace。
2. 实现文件树读取。
3. 实现 md/txt 打开与编辑。
4. 实现只读打开非 md/txt 文件。
5. 实现保存当前文件。

完成标准：用户可打开目录、打开文件、编辑并保存 md/txt。

### Phase 4：Agent 与 Provider MVP

1. 实现 Provider 配置。
2. 实现消息输入和流式响应。
3. 实现 read_file、list_files、search_files。
4. 实现 ToolExecution 记录。

完成标准：用户可配置 Provider，Agent 可在 workspace 边界内读取和搜索文件。

### Phase 5：Diff Review MVP

1. 实现 edit_current_editor_document 生成 PendingDiff。
2. 实现 diff card 展示。
3. 实现接受 diff 写入文件。
4. 实现拒绝 diff 不写文件。
5. 实现 expired 终态。

完成标准：AI 内容修改必须经过 PendingDiff，用户接受后才写入。

### Phase 6：开源发布准备

1. 完成 README、LICENSE、贡献说明。
2. 完成 GitHub Actions 基础检查。
3. 完成版本说明。
4. 完成发布部署检查。

完成标准：仓库满足 GitHub 开源展示和协作最低要求。

## 2. Git 版本管理计划

项目使用 git 管理版本，面向 GitHub 开源协作。

推荐分支：

| 分支 | 用途 |
|------|------|
| main | 稳定主线 |
| dev | 日常集成 |
| feature/* | 功能开发 |
| fix/* | 缺陷修复 |

合并门禁：

1. 相关技术设计文档已更新。
2. ADUS 已刷新。
3. 治理审计无阻断项，或阻断项已记录并由人类裁决。
4. 相关测试通过。

## 3. 发布部署计划

开源发布前必须具备：

1. 可运行桌面应用。
2. README 包含定位、安装、开发、限制说明。
3. LICENSE 明确。
4. 治理文档和技术设计文档不含本地绝对路径依赖。
5. 示例 workspace 或截图可用于演示。

## 4. 近期执行计划

1. 完成 Phase 1 文档治理闭环。
2. 初始化 Git 仓库。
3. 创建工程骨架。
4. 先实现状态机，再实现对应 UI 和 Tauri command。
5. 每完成一个核心链路，刷新 ADUS 并运行审计。

## 5. 颗粒度对齐补充

Phase 1-6 已完成 Binder Mini 的治理可运行 MVP。重新对照 `/Users/imatstarbucks/binder-core` 的产品定义、模块主控、工具协议、数据结构、Tauri Command 协议和测试矩阵后，后续开发必须进入颗粒度补齐阶段。

补充计划入口：

- `docs/30_plans/R-CORE-X-P-12_颗粒度对齐计划.md`

后续开发不得继续按粗粒度 MVP 阶段直接推进复杂功能；进入代码实现前，必须先按 P12 补齐对应功能主控、技术设计、接口协议、状态流、验收标准和 Issue Trace。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义项目落地顺序、Git 策略和发布准备计划 |
| 2026-05-22 | v1.1 | 增加颗粒度对齐补充计划入口，声明 Phase 1-6 为治理可运行 MVP |
