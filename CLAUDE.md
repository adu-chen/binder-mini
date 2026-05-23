# CLAUDE.md — AI 会话入口与执行路由协议

每次会话开始时必须完整读取本文件。

## 0. 五份控制文档

```
ADU.md      静态治理规则源。
            定义文档、规则、链路、模块、约束、@GOV、triage、
            Issue Trace 内容与触发判断。

ADP.md      AI 开发过程运行时协议。
            定义单次开发任务的状态、Gate、Scope Lock、
            Stop Conditions、豁免与运行时报告。

CLAUDE.md   本文件。
            定义 AI 会话入口、文档读取顺序、执行路由和绝对禁止行为。

APC         项目级 AI 开发宪章（每个项目一份）。
            路径由 governance.config.json 的 apc_path 字段声明。
            定义项目身份、AI 执行边界、文档体系声明、audit 阻断策略。
            文档状态必须为 A；bootstrap 完成后由 AI 写入路径配置。

ADUS        项目级派生检索索引（每个项目一份，机器生成）。
            路径由 governance.config.json 的 adus_path 字段声明。
            按链路、规则、模块查找代码块和测试覆盖。
            自动生成区禁止人工编辑。
```

## 1. 会话启动

每次会话开始：

1. 完整读取 CLAUDE.md。
2. 确认本次任务目标；若任务不明确，先向人类询问。
3. 读取 ADU.md 的通用边界，并读取当前任务涉及的静态规则定义。
4. 读取 governance.config.json 的 apc_path，读取 APC 文件，确认项目 AI 执行边界和 audit 阻断策略。
5. 读取 governance.config.json 的 adus_path，检查该路径下的 ADUS 中相关链路、规则、模块和代码块状态。
   同时读取 ADUS 术语注册表（§ 术语注册表），建立禁用别名 → 正式名称（en 字段）的映射表，供本次会话使用。
6. 读取 ADP.md。
7. 开始任何开发任务前，进入 ADP INTAKE Gate，确定 task_type。

CLAUDE.md 只负责进入正确协议，不展开 ADU 规则细节，也不展开 ADP Gate 细节。

## 2. 首次接入判断

首次接入的判断条件：

```
ADUS.md 自动生成区模块编码表为空
```

模块编码表为空时：

- 阶段一文档治理按 ADU.md 第零节和第三节执行。
- 规则、链路、模块、约束的静态定义按 ADU.md 执行。
- 任务过程、Scope Lock、Stop Conditions 按 ADP 执行。
- 解除首次接入限制时，运行 `npm run governance:generate`，再检查 governance.config.json 的 adus_path 指向的 ADUS 文件是否已有模块编码表内容。

不得以 ADUS.md 为空为由完全拒绝 Issue Trace；空库降级路径见 ADU.md §6.0。

## 3. 执行路由

| 事项 | 权威文档 |
|------|----------|
| 文档层级、文档头、变更记录 | ADU.md §2 |
| MODULE / DOMAIN / RULE / CHAIN / CONSTRAINT 定义 | ADU.md §3 |
| TERM 标注块格式、term_id 规则、TERM 创建流程 | ADU.md §3.2 |
| TERM audit 检测类型（TERM_UNREGISTERED / TERM_ORPHAN / TERM_DUPLICATE） | ADU.md §3.2 |
| BOUNDARY_ABSTRACT 规则、AI 语义审计格式 | ADU.md §4.6 / §5.7 |
| 术语处理规则（别名映射、新概念提示） | CLAUDE.md §8 |
| @GOV 格式、字段、类型、boundary 规则 | ADU.md §4 |
| rules:[] 分类和 triage 报告 | ADU.md §5 |
| 链路日志覆盖要求 | ADU.md §5.5 |
| 测试覆盖注释 | ADU.md §5.6 |
| Issue Trace 触发条件和十一项内容 | ADU.md §6 |
| Issue Trace 执行时序和 Scope Lock | ADP.md TRACE_GATE / Scope Lock |
| 任务类型、Gate、状态推进、豁免 | ADP.md |
| Stop Conditions 和解除流程 | ADP.md §4 |
| Task Runtime Report | ADP.md §6 |
| 规则与代码索引查询 | ADUS.md |

## 4. 脚本入口

治理脚本通过 package.json scripts 执行：

```
npm run governance:generate
npm run governance:audit
```

`governance:generate` 用于刷新 ADUS（路径由 governance.config.json 的 adus_path 字段声明）。
`governance:audit` 必须是只读审计，不得写入文件。

CLAUDE.md 不硬编码 generate_adus.mjs 的具体路径；脚本路径由 package.json 和 ADU.md 接入规范约束。

## 5. 绝对禁止

```
不得绕过 ADP 执行需要过程治理的开发任务
不得修改 ADU.md、ADP.md、CLAUDE.md 或 ADUS.md，除非人类明确要求
不得人工编辑 ADUS.md 自动生成区
不得为错误代码反向修改设计文档
不得在 ADP Stop Condition 未解除时继续推进任务
```

**bootstrap 豁免：**

人类在同一会话中明确确认 APC 内容和路径后，AI 可执行以下写入操作，
不适用上述"不得修改"约束：
- 将 apc_path 和 adus_path 写入 governance.config.json
- 创建 APC 文件到确认路径
- 运行 `governance:generate` 生成 ADUS

所有其他对 governance.config.json 的修改仍需人类明确要求。

---

## 6. 项目启动检测

每次会话读取 CLAUDE.md 后，读取同目录的 governance.config.json：

```
governance.config.json 不存在：
  → 提示人类：需要在项目根目录创建 governance.config.json
    （至少包含 project_root 字段，bootstrap 完成后补充 apc_path / adus_path）
  → 不进入 bootstrap，等待人类处理

apc_path 为空：
  → 进入 bootstrap 流程：
    1. 主动向人类询问项目基本情况，围绕 §7 六个主题展开讨论，
       收集关键决策（不得跳过讨论直接生成）。
       同时扫描 project_root 下的现有文件作为参考背景，
       但讨论结论优先于文件扫描推断。
    2. 讨论结束后，基于对话内容生成 APC 草案。
       草案结构以 §7 为基础，可根据讨论结论增减章节或调整重点。
       同时提案文件路径：
         apc_path  推荐：[project_root]/docs/00_core/A-[编号]_APC.md
         adus_path 推荐：[project_root]/docs/00_core/A-[编号]_ADUS.md
    3. 等待人类确认草案内容和路径。
       未确认前不得创建文件、不得写入 governance.config.json。
    4. 人类确认后（§5 bootstrap 豁免生效）：
       - 将 apc_path 和 adus_path 写入 governance.config.json
       - 创建 APC 文件到确认路径，文档状态直接为 A
       - 运行 npm run governance:generate

apc_path 已填写，adus_path 为空：
  → 提示人类：adus_path 未配置，无法读取 ADUS 索引
    建议补充路径：[project_root]/docs/00_core/A-[编号]_ADUS.md
  → 若 apc_path 已填写但 adus_path 为空，不进入 bootstrap，等待人类补充 adus_path 后继续

apc_path 已填写，adus_path 已填写：
  → 读取 APC 文件，按正常开发流程继续
```

---

## 7. APC 章节模板

以下六章为 APC 的标准基础结构，覆盖项目开发宪章必须回答的核心议题。
格式遵循 ADU.md §2 文档格式规范（文档头、命名、状态枚举、变更记录）。

AI 在生成时有结构灵活性：可根据讨论结论增加章节、拆分或合并章节、
调整各章深度。六章是最小基准，不是上限，也不要求逐字套用。

**§1 项目身份**
核心议题：项目是什么、为谁而建、当前处于什么阶段、明确不做什么。

**§2 开发方法论**
核心议题：是否文档先行、如何定义完成、技术债务策略、AI 在团队中的角色定位。

**§3 文档体系声明**
核心议题：文档分几层、权威源是哪些、约束如何传导、ADUS 路径。

**§4 ADU/ADP 启用声明**
核心议题：治理工具链启用范围、audit 阻断还是仅报告、哪些模块强制标注。

**§5 AI 执行边界**
核心议题：AI 不得自主决定的事项、必须暂停等待人类的触发条件、
生成内容的真值等级。

**§6 版本与变更管理**
核心议题：版本策略、文档先于代码的触发条件、APC 自身的变更门槛。

**APC 状态与 ADU 文档状态的关系：**

APC 的 `draft/baseline/controlled` 和 ADU 的 `A/R/X` 是两个独立维度，不得互相映射。

- ADU `A/R/X`：描述文档是否是当前权威源。
- APC `draft/baseline/controlled`：描述项目治理的成熟程度。

APC 一旦落地文件，文档状态必须是 `A`。草稿内容在对话中确认，
确认完成后创建文件，直接以 `A` 状态落地。不存在 `R` 状态的 APC。
APC 被新版取代时，旧版改为 `X`。

```
APC 治理状态：
draft      bootstrap 完成，人类已确认 APC 初版内容并落地为 A 文档
           项目治理刚启动，规则/链路尚未完整
baseline   触发条件：核心链路已在设计文档定义
           + ADUS 规则注册表有实质内容
           升级需人类明确确认
controlled 触发条件：项目进入生产或对外发布
           升级需人类明确确认
           APC 变更需两轮审批（提案 → 确认）
```

治理状态只能由人类推进，AI 可提议但不得自行升级。

---

## 8. 术语处理规则

会话启动时从 ADUS 术语注册表建立映射表后，本次会话全程遵守以下规则：

**别名自动映射（人类无感知）：**
- 人类输入中出现 forbidden 别名 → 内部映射为正式名称（en 字段），输出时使用正式名称，不打断交互
- AI 自己的输出 → 只使用正式名称，不使用 forbidden 列表中的任何别名

**新概念提示：**
- 任务讨论中发现业务名词不在 ADUS 术语注册表中，且判断可能是核心业务概念 →
  在回复末尾提示：「发现未注册术语 [词汇]，建议在设计文档 Terminology Registry 中添加 TERM 块」
- 不打断当前对话，不强制要求立即注册

**代码生成时的命名约束：**
- 生成 @GOV boundary 时，`in=` 和 `out=` 必须使用具体业务实体名或类型名
- 不得使用纯抽象占位词（data / input / output / result / state / value 等）
- 涉及已注册 TERM 的核心概念时，生成的代码标识符使用 en 字段作为基础形式

**ADUS 术语注册表为空时：**
- 跳过别名映射（无表可查）
- 仍然对任务中发现的潜在核心业务概念给出注册建议

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-18 | v1.0 | 初始版本，AI 执行协议 |
| 2026-05-19 | v1.1 | 首次会话逻辑更新（改为检查模块编码表实质内容）；MODULE_AMBIGUOUS 处理说明新增；@GOV 空库限制精确化；手工维护区表述彻底删除 |
| 2026-05-19 | v1.2 | MODULE_AMBIGUOUS 用词修正（规则语义→模块职责归属）；编码冲突引用修正（指向步骤4） |
| 2026-05-20 | v1.3 | 统一@GOV为块注释格式（强制）；docs标注块格式要求；governance:audit只读说明 |
| 2026-05-20 | v1.4 | 接入 ADP；§0 更新为四份控制文档；§1 补充 ADP 读取步骤；§3/§4 改为引用 ADP；§5 重新定位为 ADU 操作细节；§11 移除与 ADP SC-01 重叠项 |
| 2026-05-20 | v1.5 | 收敛为 AI 会话入口与执行路由协议；移除 ADU/ADP 规则副本；统一脚本入口为 package.json scripts；压缩绝对禁止清单 |
| 2026-05-21 | v1.6 | 引入 governance.config.json 路径配置；§0/§1/§2/§4 更新 ADUS 路径引用；§5 新增 bootstrap 豁免条款；新增 §6 项目启动检测；新增 §7 APC 章节模板 |
| 2026-05-21 | v1.7 | §6 bootstrap 流程：增加讨论优先步骤，明确未确认前不得落地文件；§7 模板：从强制语言改为基础结构，明确 AI 有章节灵活性 |
| 2026-05-21 | v1.8 | §0 四份→五份，补充 APC 条目，ADUS 描述去除固定文件名；§1 启动步骤增加读取 APC（步骤 4），后续步骤顺延 |
| 2026-05-21 | v1.9 | §1 步骤 5 补充 ADUS 术语注册表读取和禁用别名映射表建立；新增 §8 术语处理规则（别名自动映射、新概念提示、代码生成命名约束） |
| 2026-05-21 | v1.10 | §3 执行路由表补充 TERM 相关条目（TERM 定义 / audit 检测类型 / AI 语义审计 / 术语处理规则路由） |
