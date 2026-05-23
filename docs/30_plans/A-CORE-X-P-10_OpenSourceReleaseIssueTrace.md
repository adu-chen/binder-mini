---
文档编号：   CORE-X-P-10
文档状态：   R
负责模块：   CORE
文档职责：   开源发布准备范围
上游约束：   ADP.md、CORE-X-P-02
直接承接：   Phase 6 开源发布准备
使用边界：   记录本次发布准备任务范围，不替代技术设计
变更要求：   Scope 扩展必须追加记录
---

# Open Source Release Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

完成 Phase 6 的开源发布准备最小闭环：

1. 编写 README，说明项目定位、能力、开发命令、治理规则和当前限制。
2. 添加 MIT LICENSE。
3. 添加 CONTRIBUTING，说明贡献流程、治理门禁和 Issue Trace 要求。
4. 添加 CHANGELOG，记录当前 MVP 版本。
5. 添加发布检查清单，覆盖构建、治理、版本、GitHub 发布准备。
6. 添加 GitHub Actions 基础 CI，执行 install、治理审计、类型检查、测试、Rust 检查。
7. 将 `package.json` 从私有包标记调整为可开源仓库元数据。

## 3. 静态规则来源

- `BR-CORE-GOV-001`
- `X-CONST-004`

## 4. TERM 前置门禁

本任务不新增业务 TERM。

## 5. Scope Lock

allowed_files:

- `docs/30_plans/R-CORE-X-P-10_OpenSourceReleaseIssueTrace.md` # 本 Issue Trace
- `README.md` # 开源项目说明
- `LICENSE` # 开源许可
- `CONTRIBUTING.md` # 贡献说明
- `CHANGELOG.md` # 版本说明
- `docs/30_plans/R-CORE-X-P-11_ReleaseChecklist.md` # 发布部署检查
- `.github/` # GitHub Actions 配置目录
- `.github/workflows/ci.yml` # GitHub Actions 基础检查
- `package.json` # 开源元数据
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引

forbidden_files:

- `ADU.md`
- `ADP.md`
- `CLAUDE.md`
- `docs/00_core/A-CORE-C-P-01_APC.md`
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`
- `src/`
- `src-tauri/`
- `tests/`

confirmation: YES

scope_reason: Phase 6 当前步骤为开源发布准备，不修改运行时代码和技术规则来源。

## Allowed Files

- docs/30_plans/R-CORE-X-P-10_OpenSourceReleaseIssueTrace.md
- README.md
- LICENSE
- CONTRIBUTING.md
- CHANGELOG.md
- docs/30_plans/R-CORE-X-P-11_ReleaseChecklist.md
- .github/
- .github/workflows/ci.yml
- package.json
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- src/
- src-tauri/
- tests/

## Expected Behavior

仓库具备 GitHub 开源展示和协作最低材料；CI 能在 pull request 和 main push 时执行基础检查；发布前检查项明确。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-10_OpenSourceReleaseIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- npm run build

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录开源发布准备 Scope Lock |
