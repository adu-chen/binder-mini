---
文档编号：   DE-M-P-01
文档状态：   A
负责模块：   DE
文档职责：   DiffStore 数据模型、操作接口、持久化策略与跨模块协作边界
上游约束：   CORE-C-P-01、DE-M-D-01、DE-M-T-01、SYS-C-T-01
直接承接：   diffService.ts、diffMachine、Phase 13 Issue Trace
使用边界：   定义 DiffStore 设计约束和接口协议，不写运行时代码
变更要求：   状态字段、操作语义或持久化映射变更时必须同步 DE-M-T-01 和 SYS-C-T-01
---

# DE-M-P-01 DiffStore 设计

## 1. 本文职责

本文定义 diffStore（或等价网关）里存什么、每个操作的语义和状态迁移、何时落盘 workspace.db，以及与 Editor 和 Agent 模块的协作边界。

## 2. 数据模型

### 2.1 PendingDiff（Phase 13-A 最终结构）

（基于 DE-M-T-01 §3.1，不重复技术设计内容，只做接口层声明）

（字段定义以 DE-M-T-01 §3.1 为权威源，本节为接口层声明，保持与权威源一致）

```typescript
interface PendingDiff {
  id: string;
  filePath: string;            // Workspace 相对路径
  originalText: string;        // 待替换精确原文字符串（主定位器，IR-RANGE-005）
  newText: string;             // 替换内容字符串（精确替换片段，非全文）
  status: PendingDiffStatus;
  summary: string;
  sourceToolId: string;        // Phase 13-A：生成此 diff 的 ToolExecution.id（callId）
  baseRevision: string;        // Phase 13-A：DiskState 内容 hash（Inherit 流程校验用，必填）
  createdAt: number;           // Phase 13-A：Unix timestamp
  effectivePath: "open-file" | "closed-file"; // accept 路径语义路由
                               // INHERIT_APPLIED 后从 "closed-file" 升级为 "open-file"
  anchor?: DiffAnchorRef;      // Phase 13-B：Editor BlockId 定位辅助（可选；originalText 为主定位器）
  appliedRange?: {             // preapplied 后由 Editor Runtime 记录的 PM 绝对位置范围
    from: number;
    to: number;
  };
}
```

（字段定义以 DE-M-T-01 §3.1 为权威源，本节为接口层声明。）

### 2.2 DiffStore 接口

```typescript
interface DiffStore {
  pendingDiffs: Map<string, PendingDiff>;  // id → PendingDiff
  terminalCards: TerminalDiffCard[];        // 按时间倒序
}
```

DiffStore 是所有 PendingDiff 生命周期操作的唯一收口网关。各工具调用结果不得直接操作 PendingDiff 状态，必须通过 DiffStore 方法或等价服务层。

## 3. 核心操作语义

| 方法 | 语义 | 输入 | 持久化 |
|------|------|------|--------|
| createDiff | 新建 PendingDiff；已打开文件：Editor 在 originalText 位置精确替换为 newText → 记录 appliedRange → preapplied；未打开文件：status=pending | AG 工具参数 + sourceToolId | 应写入 workspace.db |
| acceptDiff（已打开文件）| preapplied → accepting → terminal(accepted)；只移除 appliedRange 绿增效果；LogicalState 不变（已含 newText）；DiskState 不写 | diffId | 更新 DB（终态） |
| acceptDiff（未打开文件）| pending → accepting → terminal(accepted)；写入 DiskState（磁盘），originalText → newText 精确替换 | diffId | 写磁盘成功后更新 DB |
| rejectDiff（已打开文件）| preapplied → rejecting → terminal(rejected)；appliedRange 精确回滚（newText → originalText） | diffId | 应写入 DB |
| rejectDiff（未打开文件）| pending → rejecting → terminal(rejected)；DiskState 不变 | diffId | 应写入 DB |
| expireDiff | pending/preapplied → expired → terminal | diffId | 应写入 DB |
| loadDiffsFromWorkspace | Workspace 打开时从 DB 恢复 pending diff | workspaceRoot | 只读 |
| expireAllOnClose | Workspace 关闭时将所有非终态 diff 转 expired | — | 批量写入 DB |

## 4. 状态机与 DiffStore 的关系

每个 PendingDiff 对应一个独立的 diffMachine 实例（状态机实例不持久化，仅在内存中管理）。diffStore 保存状态事实，diffMachine 管理状态迁移逻辑。

关键约束：

1. DiffStore.pendingDiffs 只存 pending/preapplied 状态的记录（非终态）
2. 终态记录转移到 terminalCards（TerminalDiffCard）
3. 任何状态变化必须先更新 diffStore，再写入 workspace.db，不能只更新内存

## 5. 持久化协议

### 5.1 workspace.db 表映射

写入位置：`.binder/workspace.db`

```sql
-- pending_diffs 表承载 pending 和终态卡片事实
CREATE TABLE pending_diffs (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  original_text TEXT NOT NULL,   -- 待替换精确原文（主定位器，IR-RANGE-005）
  new_text TEXT NOT NULL,        -- 替换内容（精确替换片段，非全文）
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_tool_id TEXT,
  base_revision TEXT NOT NULL,   -- DiskState 内容 hash
  created_at INTEGER NOT NULL,
  anchor_json TEXT               -- DiffAnchorRef 序列化（可选），JSON
);

CREATE TABLE terminal_diff_cards (
  diff_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,    -- accepted/rejected/expired/error
  message TEXT NOT NULL,
  source_tool_id TEXT,
  resolved_at INTEGER NOT NULL
);
```

### 5.2 恢复策略

Workspace 重新打开时（loadDiffsFromWorkspace）：

1. 从 pending_diffs 加载 status 为 pending/preapplied 的记录
2. 对每条记录：读取磁盘当前 DiskState 内容，与 baseRevision hash 比对
3. 内容一致 → 恢复为 pending 状态（preapplied 降级为 pending，因为 LogicalState 跨会话不可恢复）
4. 内容不一致 → 自动转 expired，写入 terminal_diff_cards
5. accepting/rejecting 状态（中断执行，不持久化，crash 后理论上不存在 DB 记录）→ 如发现则转 error，写入 terminal_diff_cards

### 5.3 Workspace 关闭时

expireAllOnClose 在 Workspace 关闭时执行：

1. 将所有非终态 PendingDiff 转 expired
2. 批量写入 terminal_diff_cards
3. 清空 pending_diffs 中的非终态记录

## 6. 一致性不变量

1. UI 不维护独立 diff 副本，统一读取 diffStore
2. accepted/rejected/expired/error 终态不可回退到 pending
3. DiskState 写操作不得绕过 diffStore，未打开文件路径的 acceptDiff 是唯一触发 DiskState 修改的路径（已打开文件 accept 不写磁盘）
4. 未打开文件 accept 前必须校验当前 DiskState hash 与 baseRevision 一致；不一致时转 expired，不执行写入（BR-DE-STATE-004）
5. preapplied 状态只适用于已打开文件（diff 创建时即修改 LogicalState）；未打开文件的 diff 保持 pending 直到用户决策（BR-DE-STATE-005）
6. preapplied → reject 必须触发 LogicalState 回滚，不得只记录终态留下游离内容
7. Accept（已打开文件）不修改 DiskState；DiskState 仅在 Cmd+S 保存时由 editorMachine 写入

## 7. 跨模块协作

### 7.1 与 AG

- agentService 调用 DE 工具路由（edit_current_editor_document / update_file）后，由 DE 层创建 PendingDiff
- AG 提供 sourceToolId（ToolExecution.id），DE 在 createDiff 时记录

### 7.2 与 ED

- createDiff（已打开文件）：DE 向 ED 发出 originalText+newText+anchor；ED 定位 originalText → 精确替换为 newText → 记录 appliedRange → diff → preapplied；ED 在 appliedRange 展示绿增效果
- acceptDiff（已打开文件）：DE 通知 ED 移除 appliedRange 绿增 Decoration；LogicalState 不变；不写磁盘
- acceptDiff（未打开文件）：DE 读取磁盘 DiskState，校验 baseRevision 后在 DiskState 中精确替换 originalText → newText（不全文覆盖）
- preapplied → rejectDiff：diffMachine 向 editorMachine 发送 `ROLLBACK_LOGICAL_STATE { diffId, appliedRange, originalText }` 事件；editorMachine 在 appliedRange 精确回滚（newText → originalText）（详见 DE-M-T-01 §4.4）
- Workspace 打开时：ED 可查询 diffStore 当前文件的 preapplied diff 展示绿增效果（Phase 9-F）

### 7.3 与 WS

- Workspace 进入 active 时调用 loadDiffsFromWorkspace
- Workspace 关闭时调用 expireAllOnClose
- accept 落盘时路径必须在 workspaceRoot 内（WS 边界约束）

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 binder-mini DiffStore 接口协议和持久化策略（参考 binder-core DE-M-P-01 适配简化架构）|
| 2026-05-24 | v1.1 | 三态模型重构：§3 acceptDiff 按两路径拆分（已打开：移除绿增不写磁盘；未打开：写 DiskState）；§4 约束 1 移除 mounted_pending；§5.2 恢复策略更新（preapplied 降级为 pending；去除 mounted_pending）；§6 不变量重写（新增条目 7：accept 不写 DiskState）；§7.2 DE→ED 协作更新（createDiff 即推送 proposedText；accept 移除绿增）|
| 2026-05-24 | v1.2 | §2.1 PendingDiff 接口补充 effectivePath 字段（与 DE-M-T-01 §3.1 权威源对齐）；baseRevision 改为必填；§6 不变量 4/5 规则引用从候选（CAND）改为正式规则（BR-DE-STATE-004/005）；§7.2 reject 协议注释更新（ROLLBACK_LOGICAL_STATE 事件已确认，去除"待 Phase 13-B 确认"） |
| 2026-05-24 | v1.3 | 精确编辑架构对齐（D-10）：§2.1 PendingDiff 字段更新（proposedText→newText 精确替换片段；originalText 语义改为主定位器；新增 appliedRange{from,to}；anchorRef→anchor 重命名，说明辅助定位关系）；§3 createDiff/acceptDiff/rejectDiff 操作语义重写（字符精确替换而非全文替换）；§5.1 DB schema 更新（proposed_text→new_text，新增 anchor_json，base_revision 改为必填）；§7.2 ED 协作描述更新（originalText+newText+appliedRange 传递链路，accept/reject 精确操作） |
