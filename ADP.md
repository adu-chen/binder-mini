# ADP.md — AI Development Process 运行时协议

## 0. 文档边界

ADP 定义单次开发任务的过程约束。

ADP 只回答：
- 当前任务是什么类型
- 当前任务处于什么状态
- 是否需要 Issue Trace
- Issue Trace 后如何形成 Scope Lock
- 何时停止、何时恢复、何时可交付
- 完成时输出什么最小运行报告

ADP 不定义：
- RULE / CHAIN / MODULE / CONSTRAINT / @GOV / triage 的静态规则（见 ADU.md）
- Issue Trace 十一项内容和触发判断（见 ADU.md §6）
- AI 会话启动和文档读取入口（见 CLAUDE.md）
- ADUS.md 自动生成区内容

CLAUDE.md 负责调用 ADP。ADU 是 ADP 的静态规则上游。

---

## 1. 任务类型

任务类型用于决定是否需要 Issue Trace 和 Scope Lock。

```
CODE_CHANGE          修改业务代码或已有 @GOV 覆盖的代码
GOVERNANCE_CHANGE    修改治理标注、triage、规则引用或治理文档
DOC_ONLY             只修改普通文档，不修改代码
TEST_ONLY            只修改测试文件
INDEX_ONLY           只刷新 ADUS.md 或运行生成/审计脚本
```

判定规则：
- 任务实际内容超出当前 task_type 时，必须停止并重新判定 task_type。
- 同时涉及多类任务时，按约束更强的类型执行：`CODE_CHANGE` > `GOVERNANCE_CHANGE` > `TEST_ONLY` / `DOC_ONLY` / `INDEX_ONLY`。
- `CODE_CHANGE` 默认需要 Issue Trace 和 Scope Lock。
- `DOC_ONLY`、`TEST_ONLY`、`INDEX_ONLY` 使用隐式 Scope，不需要 Issue Trace。

---

## 2. 最小状态机

```
INTAKE       任务已接收，正在判定 task_type 和目标
SCOPED       修改范围已确定，可进入修改
PATCHING     正在修改
VALIDATING   正在验证
READY        任务完成，可交付人类审阅
BLOCKED      触发 Stop Condition，等待解除
ABANDONED    人类终止任务
```

状态推进：

```
INTAKE -> SCOPED -> PATCHING -> VALIDATING -> READY
任意状态 -> BLOCKED
BLOCKED -> 原状态（阻断解除后）
BLOCKED -> ABANDONED（人类终止）
```

死线：
- Stop Condition 未解除时，final_state 只能是 `BLOCKED`，不得写 `READY`。
- `READY` 只能表示无未解除 Stop Condition。
- 需要人类裁决但不阻断交付的事项，必须写入 Task Runtime Report 的 `unresolved_items`；若该事项影响正确性、范围或治理闭环，则必须保持 `BLOCKED`。

---

## 3. Scope

### 3.1 显式 Scope

`CODE_CHANGE` 必须先执行 Issue Trace。Issue Trace 的内容和触发判断见 ADU.md §6。

**新概念注册前置判断（TERM 前置门禁）：**

在 Issue Trace 完成、进入 Scope Lock 之前，必须确认：

1. 任务描述或涉及的设计文档中是否出现 ADUS 术语注册表之外的业务名词
2. 若出现且满足 TERM 注册条件（跨 session 容易漂移、代码中有实体承载、命名混乱会导致规则判断错误）：
   → 必须先在设计文档 Terminology Registry 添加 `<!-- TERM -->` 块
   → 运行 `npm run governance:generate` 刷新 ADUS 后再继续
3. 若已注册 → 后续生成代码时使用正式 en 名称，不使用 forbidden 列表中的别名
4. 新增 exported type / interface / class / enum 时，检查名称是否在 ADUS 术语注册表中
   → 不在注册表中 → 判断是否需要注册 TERM，或确认是技术实现词汇不需注册

Issue Trace 产出的文件范围结论是 Scope Lock 的输入：

```
task_type: CODE_CHANGE
allowed_files:
  - [文件路径] # [修改意图]
forbidden_files:
  - [文件路径] # [禁止原因]
confirmation: PENDING | YES
scope_reason: [一句话说明范围依据]
```

`confirmation: PENDING` 时不得修改文件。
`confirmation: YES` 后只能修改 allowed_files。

### 3.2 隐式 Scope

以下任务不需要 Issue Trace，但仍必须遵守隐式 Scope：

| task_type | 允许范围 |
|-----------|----------|
| DOC_ONLY | 文档文件 |
| TEST_ONLY | 测试文件 |
| INDEX_ONLY | ADUS.md 自动生成区或生成/审计输出 |
| GOVERNANCE_CHANGE | 人类明确要求修改的治理文件或治理标注 |

隐式 Scope 任务若需要修改范围外文件，必须停止并重新判定 task_type。

### 3.3 Scope 扩展

需要修改 allowed_files 之外的文件时：
1. 进入 `BLOCKED`
2. 输出 `SCOPE_VIOLATION`
3. 说明新增文件和原因
4. 等待人类确认
5. 更新 Scope 后回到原状态

---

## 4. Stop Conditions

Stop Condition 触发时，任务进入 `BLOCKED`。

| 编号 | 名称 | 触发条件 | 解除方式 |
|------|------|----------|----------|
| SC-01 | SCOPE_VIOLATION | 需要修改 Scope 外文件 | 人类确认扩展 Scope |
| SC-02 | MISSING_STATIC_RULE | 缺少 ADU 定义的规则、链路、模块或 triage 判断 | 人类补充静态定义或确认处理方式 |
| SC-03 | DESIGN_CODE_CONFLICT | 设计文档与代码实现冲突，AI 无法裁决 | 人类裁决设计或代码哪个需要修改 |
| SC-04 | VALIDATION_BLOCKED | 测试、审计或生成无法通过，且当前 Scope 内无法修复 | 人类确认扩展 Scope、接受风险或调整任务 |
| SC-05 | AMBIGUOUS_TASK | 任务目标、范围或验收标准无法确定 | 人类澄清任务 |

ADU 中的 `RULE_MISSING`、`NEEDS_HUMAN_DECISION` 等治理分类，是 Stop Condition 的触发原因，不单独扩展 ADP 状态。

---

## 5. 验证

进入 `VALIDATING` 时，根据任务类型执行最小验证：

| task_type | 最小验证 |
|-----------|----------|
| CODE_CHANGE | 运行相关测试；运行 `npm run governance:audit`；必要时运行 `npm run governance:generate` |
| GOVERNANCE_CHANGE | 运行 `npm run governance:audit`；必要时运行 `npm run governance:generate` |
| TEST_ONLY | 运行相关测试 |
| DOC_ONLY | 检查文档头、引用关系和变更记录 |
| INDEX_ONLY | 运行 `npm run governance:generate` 后检查 ADUS.md 是否与输入一致 |

验证失败且当前 Scope 内可修复时，回到 `PATCHING`。
验证失败且当前 Scope 内不可修复时，触发 `SC-04 VALIDATION_BLOCKED`。

具体 @GOV、triage、日志、Issue Trace 内容的判断标准来自 ADU.md，不在 ADP 重写。

---

## 6. Task Runtime Report

任务结束时必须输出最小运行报告。

```markdown
## Task Runtime Report — [任务简述]

task_type: [CODE_CHANGE | GOVERNANCE_CHANGE | DOC_ONLY | TEST_ONLY | INDEX_ONLY]
final_state: [READY | BLOCKED | ABANDONED]
issue_trace: [无 | Issue Trace 路径或 ID]

changed_files:
  - [文件路径] # [新增/修改/删除，简述]

scope:
  mode: [explicit | implicit]
  status: [confirmed | skipped | blocked]

validation:
  - [命令或检查项] # [passed | failed | skipped，原因]

stop_conditions:
  - [无 | SC-xx: 原因与解除方式]

recovery:
  - [无 | BLOCKED 解除动作、验证命令和结果]

unresolved_items:
  - [无 | 等待人类处理的非阻断事项]
```

若 `stop_conditions` 存在未解除项，`final_state` 必须是 `BLOCKED`。

---

## 7. 交接点

| 方向 | 内容 |
|------|------|
| CLAUDE.md -> ADP.md | CLAUDE 读取 ADP，并在开发任务开始前进入 INTAKE |
| ADP.md -> ADU.md | ADP 引用 ADU 的静态规则、Issue Trace 内容、@GOV、triage、日志和测试覆盖判断 |
| ADP.md -> ADUS.md | ADP 使用 ADUS.md 查询规则、链路、模块、代码块和测试覆盖 |
| ADP.md -> package scripts | ADP 通过 `npm run governance:generate` 和 `npm run governance:audit` 调用工具链 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-19 | v0.1 | 初始草稿，定义任务状态机、七个 Gate、六个 Stop Condition、Scope Lock 格式、Task Runtime Report 格式、豁免规则与 ADU/CLAUDE.md 交接点 |
| 2026-05-20 | v0.2 | 收敛为最小过程协议；压缩状态机和任务类型；删除过细 Gate 表；修复 READY/BLOCKED 冲突；增加隐式 Scope；统一脚本入口为 package scripts；明确 CLAUDE 入口、ADU 静态规则、adus 索引的边界 |
| 2026-05-21 | v0.3 | §3.1 新增 TERM 前置门禁：进入 Scope Lock 前必须确认新概念是否已注册，未注册需先补充 TERM 块并刷新 ADUS |
