---
文档编号：   CORE-X-P-11
文档状态：   R
负责模块：   CORE
文档职责：   发布部署检查清单
上游约束：   CORE-X-P-02
直接承接：   GitHub 开源发布准备
使用边界：   发布前检查，不替代技术设计或 Issue Trace
变更要求：   发布门禁变化时同步更新
---

# Release Checklist

## 1. Repository

- [ ] `README.md` describes product scope, development commands, governance, and current limitations.
- [ ] `LICENSE` exists and matches the intended open-source license.
- [ ] `CONTRIBUTING.md` describes Issue Trace and validation requirements.
- [ ] `CHANGELOG.md` records the release version and notable changes.
- [ ] `.gitignore` excludes local build output, dependencies, logs, and local env files.

## 2. Governance

- [ ] `docs/00_core/A-CORE-C-P-01_APC.md` is approved.
- [ ] `docs/00_core/A-CORE-C-R-01_ADUS.md` is generated.
- [ ] `npm run governance:generate` passes.
- [ ] `npm run governance:audit` passes.
- [ ] Current release changes have an Issue Trace.

## 3. Engineering

- [ ] `npm ci` succeeds from a clean checkout.
- [ ] `npm run check:ts` passes.
- [ ] `npm run test` passes.
- [ ] `npm run check:rust` passes.
- [ ] `npm run build` passes.
- [ ] GitHub Actions CI passes on `main`.

## 4. Product

- [ ] User can open a Workspace.
- [ ] User can open and save editable `.md` / `.txt` files.
- [ ] Agent readonly tools stay inside Workspace boundaries.
- [ ] Agent edit proposals generate `PendingDiff` and do not write directly.
- [ ] Accept writes the diff; Reject and Expire do not write the diff.

## 5. Release Notes

- [ ] Version in `package.json` matches `CHANGELOG.md`.
- [ ] Version in `src-tauri/tauri.conf.json` matches `CHANGELOG.md`.
- [ ] Known limitations are documented.
- [ ] No local absolute paths are required for normal setup.
