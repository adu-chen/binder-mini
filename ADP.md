# ADP.md — AI Development Process 运行时协议

## 0. 文档边界

ADP 定义单次开发任务的过程约束。

ADP 只回答：
- 当前任务是什么类型
- 当前任务属于哪个治理阶段
- 当前任务处于什么状态
- 是否需要 Issue Trace
- Issue Trace 后如何形成 Scope Lock
- 是否满足 APC 定义的阶段门禁
- 何时停止、何时恢复、何时可交付
- 完成时输出什么最小运行报告

ADP 不定义：
- RULE / CHAIN / MODULE / CONSTRAINT / @GOV / triage 的静态规则（见 ADU.md）
- 需求、设计、计划文档的项目级完整性标准（见 APC）
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

### 1.1 治理阶段

governance_phase 用于判断当前任务处于哪个治理阶段。
它不替代 task_type；同一个 task_type 可以发生在不同治理阶段。

```
REQUIREMENT      需求文档治理
DESIGN           技术设计文档治理
PLAN             开发计划治理
IMPLEMENTATION   代码实现
VALIDATION       验证、审计、回归
NONE             无法判断或不适用
```

判定规则：
- `DOC_ONLY` 可以对应 REQUIREMENT、DESIGN 或 PLAN。
- `CODE_CHANGE` 通常对应 IMPLEMENTATION。
- `TEST_ONLY` 通常对应 IMPLEMENTATION 或 VALIDATION。
- `INDEX_ONLY` 通常对应 VALIDATION。
- 无法判断治理阶段且阶段会影响门禁时，触发 `SC-05 AMBIGUOUS_TASK`。

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

进入 `SCOPED` 前必须执行 Phase Gate Check。
Phase Gate Check 不新增 ADP 状态，但属于 INTAKE 到 SCOPED 的必经检查。

Phase Gate Check 最小检查：
1. 当前任务的 governance_phase
2. APC 是否对该 phase 定义前置门禁
3. 前置门禁是否满足
4. 是否存在映射链阻断
5. 当前 task_type 是否允许进入该 phase

Phase Gate Check 失败时，进入 `BLOCKED`。

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
`confirmation` 字段只能由人类将 PENDING 改为 YES，AI 不得自行修改。

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
| SC-02 | MISSING_STATIC_RULE | 缺少 ADU 定义的规则、链路、模块、triage 判断，或代码/文档中出现未在 ADUS 术语注册表登记的业务核心名词（TERM_UNREGISTERED） | 人类补充静态定义或确认处理方式 |
| SC-03 | DESIGN_CODE_CONFLICT | 设计文档与代码实现冲突，AI 无法裁决 | 人类裁决设计或代码哪个需要修改 |
| SC-04 | VALIDATION_BLOCKED | 测试、审计或生成无法通过，且当前 Scope 内无法修复 | 人类确认扩展 Scope、接受风险或调整任务 |
| SC-05 | AMBIGUOUS_TASK | 任务目标、范围或验收标准无法确定 | 人类澄清任务 |
| SC-06 | PHASE_GATE_BLOCKED | APC 定义的前置阶段门禁未满足；当前任务要求进入的治理阶段缺少必要前置产物；人类要求越级进入后续阶段；需求、设计、计划任一前置阶段被标记 blocked；APC 要求状态机但状态机设计缺失 | 补齐 APC 要求的前置文档或门禁产物；修正当前任务阶段；人类明确调整任务目标到允许阶段；对阻断项作出项目规则允许的延期、豁免或裁决 |
| SC-07 | MAPPING_CHAIN_BROKEN | REQ 无法追溯到技术规则且当前任务要求进入设计之后阶段；技术规则未注册却被计划、代码或测试引用；开发计划条目没有规则来源；@GOV 引用无法追溯到已注册 RULE / CHAIN / CONSTRAINT；测试 covers 引用未知规则；候选规则被用于运行时代码 | 补齐 REQ_MAP 或等价映射；补齐 RULE / CHAIN / CONSTRAINT；将候选规则升级为正式规则；将映射状态改为 deferred / blocked / superseded；人类裁决缩小任务范围或回退阶段 |

ADU 中的 `RULE_MISSING`、`NEEDS_HUMAN_DECISION` 等治理分类，是 Stop Condition 的触发原因，不单独扩展 ADP 状态。
`SC-02 MISSING_STATIC_RULE` 表示缺少静态定义本身。
`SC-07 MAPPING_CHAIN_BROKEN` 表示静态定义可能存在，但追踪链断裂。

---

## 5. 验证

进入 `VALIDATING` 时，根据任务类型执行最小验证：

| task_type | 最小验证 |
|-----------|----------|
| CODE_CHANGE | 运行相关测试；运行 `npm run governance:audit`；若本次修改了设计文档标注块（RULE / CHAIN / MODULE / TERM / CONSTRAINT），必须先运行 `npm run governance:generate` 再运行 audit；若本次涉及规则有 `semantic_review_candidates` 标记，必须执行 AI 语义比对（ADU.md §5.7），结论写入 Task Runtime Report |
| GOVERNANCE_CHANGE | 运行 `npm run governance:audit`；若本次修改了设计文档标注块，必须先运行 `npm run governance:generate` 再运行 audit |
| TEST_ONLY | 运行相关测试 |
| DOC_ONLY | 检查文档头、引用关系和变更记录 |
| INDEX_ONLY | 运行 `npm run governance:generate` 后检查 ADUS.md 是否与输入一致 |

验证失败且当前 Scope 内可修复时，回到 `PATCHING`。
验证失败且当前 Scope 内不可修复时，触发 `SC-04 VALIDATION_BLOCKED`。

根据 governance_phase 执行补充验证：

| governance_phase | 补充验证 |
|------------------|----------|
| REQUIREMENT | 检查文档头、REQ 标注和变更记录；若 APC 要求流程图或完整性清单，按 APC 检查 |
| DESIGN | 检查 RULE / CHAIN / CONSTRAINT / REQ_MAP；若 APC 要求状态机或 SSOT，按 APC 检查 |
| PLAN | 检查计划条目是否引用技术规则；检查实现顺序、文件范围和测试路径 |
| IMPLEMENTATION | 检查 Issue Trace、Scope Lock、@GOV、`governance:audit` 和相关测试 |
| VALIDATION | 检查生成、审计、测试结果和未解除 Stop Condition |
| NONE | 不执行阶段补充验证；若阶段影响门禁，应先触发 `SC-05 AMBIGUOUS_TASK` |

具体 @GOV、triage、日志、Issue Trace 内容的判断标准来自 ADU.md，不在 ADP 重写。

### 5.1 越级请求处理

当人类请求的任务目标属于 IMPLEMENTATION，
但 Phase Gate Check 发现 REQUIREMENT / DESIGN / PLAN 前置门禁未满足时，
AI 不得进入 PATCHING。

处理流程：
1. 判定 task_type 和 governance_phase
2. 执行 Phase Gate Check
3. 若失败，触发 `SC-06 PHASE_GATE_BLOCKED` 或 `SC-07 MAPPING_CHAIN_BROKEN`
4. 输出缺口列表
5. final_state 为 `BLOCKED`

---

## 6. Task Runtime Report

任务结束时必须输出最小运行报告。

```markdown
## Task Runtime Report — [任务简述]

task_type: [CODE_CHANGE | GOVERNANCE_CHANGE | DOC_ONLY | TEST_ONLY | INDEX_ONLY]
governance_phase: [REQUIREMENT | DESIGN | PLAN | IMPLEMENTATION | VALIDATION | NONE]
final_state: [READY | BLOCKED | ABANDONED]
issue_trace: [无 | Issue Trace 路径或 ID]

changed_files:
  - [文件路径] # [新增/修改/删除，简述]

scope:
  mode: [explicit | implicit]
  status: [confirmed | skipped | blocked]

phase_gate:
  status: [passed | blocked | skipped]
  evidence: [一句话说明依据]

mapping_chain:
  status: [complete | partial | blocked | not_applicable]
  evidence: [REQ/RULE/CHAIN/@GOV/Test 的最小说明]

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
| 2026-05-22 | v0.4 | §3.1 补充 confirmation 字段只能由人类修改；§4 SC-02 扩展触发条件覆盖 TERM_UNREGISTERED；§5 将「必要时运行 generate」改为明确触发条件（修改了设计文档标注块时必须运行） |
| 2026-05-22 | v0.5 | §5 CODE_CHANGE 验证项补充语义审计触发条件：涉及规则有 semantic_review_candidates 标记时必须执行 AI 语义比对并将结论写入 Task Runtime Report |
| 2026-05-22 | v0.6 | 新增 governance_phase、Phase Gate Check、SC-06/SC-07、阶段化补充验证、越级请求处理和 Task Runtime Report 最小阶段门禁字段 |
