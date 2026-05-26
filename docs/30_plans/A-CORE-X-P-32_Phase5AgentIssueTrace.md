---
文档编号：   CORE-X-P-32
文档状态：   A
负责模块：   AG
文档职责：   Phase 5 Agent 模块接线 Issue Trace——chatMachine Actor、API Key 安全、SSE 流、工具执行
上游约束：   CORE-X-P-27（大纲 §六）、AG-M-P-04、SYS-C-T-01（v3.1）
直接承接：   Phase 6（DiffStore + diffMachine + GreenAdditionDecoration）
使用边界：   逐 Issue 列出交付范围、规则映射、名词声明和通过标准；不写运行时代码正文
变更要求：   Issue 完成后更新验收状态；调整接线协议必须同步 AG-M-P-04
---

# Phase 5 Agent 模块接线 Issue Trace

---

## 一、规则映射链图

```
链路 AG-SEND-MESSAGE
  ├─ BR-AG-STATE-001 ── chatMachine 门禁：SEND_MESSAGE 仅在 ready 且 Provider 配置完整 + userContent 非空时允许
  │                      约束代码：useChatActor.sendMessage() 门禁 + chatMachine validatingProvider 状态
  │                      验证：未配置 Provider 时 sendMessage() 被静默阻止；empty userContent 被阻止
  ├─ BR-AG-STATE-002 ── SSE 流状态转移：sending → streaming（TOKEN_RECEIVED 累积）→ ready（RESPONSE_DONE）
  │                      约束代码：Rust chat_stream 命令 + 前端 Tauri event 监听 → chatMachine 事件分发
  │                      验证：流式 token 依次出现在 chatMachine context.streamingContent；RESPONSE_DONE → ready
  ├─ BR-AG-SEC-001 ── API key 原文只在 Rust 后端持有；前端只感知 apiKeyConfigured: boolean
  │                    约束代码：save_api_key Rust 命令；is_api_key_configured 查询；前端 ProviderConfigPanel
  │                    验证：@GOV 注释覆盖；API key 字段不出现在 TypeScript 内存或日志
  └─ BR-AG-PERSIST-001 ── WORKSPACE_CLOSED → chatMachine persistAndClearSession：先落盘 chat_messages 再清空
                           约束代码：useChatActor onWorkspaceClosed → save_chat_messages IPC → WORKSPACE_CLOSED
                           验证：workspace 重开后 chat 历史恢复

链路 AG-TOOL-CALL
  ├─ BR-AG-OBS-001 ── 工具执行顺序：toolCalling 状态中顺序执行（不并行）；超时 10s → FAILED
  │                    约束代码：useChatActor 工具循环；Promise.race timeout guard
  │                    验证：工具执行结果追加 tool 角色消息；失败 → chatMachine FAILED
  └─ BR-AG-STATE-003 ── 后端 allowedTools 过滤：未授权 ToolCall 返回结构化 error，不执行
                         约束代码：Rust chat_stream → 工具执行前检查 allowed_tools 列表
                         验证：不在授权列表的工具调用 → error message，不实际执行
```

---

## 二、名词声明

| TERM ID | 正式名称（en）| 中文说明 |
|---------|-------------|---------|
| TERM-AG-001 | ProviderConfig | 包含 provider、model、apiKeyConfigured 的配置对象；apiKeyConfigured 是布尔值，原文 key 不出现 |
| TERM-AG-002 | AgentMessage | role: user/assistant/system，包含 streamStatus 的消息结构 |
| TERM-AG-003 | StreamingContent | chatMachine context 中流式累积的 assistant 内容；RESPONSE_DONE 后转正式 AgentMessage |
| TERM-AG-004 | ToolExecution | 包含 toolName、inputBoundary、status、resultSummary 的执行记录 |
| TERM-AG-011 | SSE Stream | Anthropic API `/v1/messages?stream=true` 返回的 Server-Sent Events 流 |
| TERM-CORE-001 | WorkspaceRoot | 工作区根目录绝对路径；不出现在 prompt L0 之外 |

---

## 三、Issue 5-A — chatMachine Actor 接线

### 交付范围

1. 新建 `src/services/chatActor.ts`：`useChatActor()` hook，以 `useActorRef(chatMachine)` 运行实例
2. `App.tsx`：移除 agentMessages/agentStreaming/agentError 的 useState；改用 useChatActor 暴露的派生状态
3. `App.tsx`：workspaceActor.onWorkspaceOpened → chatActor.onWorkspaceOpened(workspaceRoot)
4. `App.tsx`：workspaceActor.onWorkspaceClosed → chatActor.onWorkspaceClosed()
5. `App.tsx`：editorActor 的 activeTab 变化 → chatActor.notifyActiveFileChanged(oldPath, newPath)

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-AG-STATE-001 | chatMachine validatingProvider 状态；sendMessage() 门禁在 useChatActor |
| BR-AG-PERSIST-001 | onWorkspaceClosed() 调用 save_chat_messages IPC，再发 WORKSPACE_CLOSED |

### chatActor.ts @GOV 边界

```
boundary: in=workspaceRoot string, userContent string, and SSE stream Tauri events |
          out=chatMachine actor with context.messages (AgentMessage list) and context.streamingContent |
          delegate=chatMachine guards and actions for state transitions,
                   chat_stream and save_chat_messages Tauri IPC
```

### 关键实现要点

```typescript
// useChatActor() 暴露
{
  chatActor,
  chatValue,          // state name → chatStateName()
  chatMessages,       // context.messages
  chatStreamingContent, // context.streamingContent
  chatErrorMessage,   // context.errorMessage
  onWorkspaceOpened,  // (workspaceRoot) → 发送 WORKSPACE_OPENED
  onWorkspaceClosed,  // () → 先 save_chat_messages，再发 WORKSPACE_CLOSED
  sendMessage,        // (userContent) → 门禁 + SEND_MESSAGE → 启动 SSE 监听
  cancelMessage,      // () → CANCEL → 等 CANCEL_DONE / ABORT_FAILED
  retryMessage,       // () → RETRY
  notifyActiveFileChanged, // (oldPath, newPath) → ACTIVE_FILE_CHANGED
}
```

### 验收条件

- `tsc --noEmit` 通过
- `chatStateName()` 直接从 chatValue 派生，不使用 agentStreaming 布尔
- workspaceActor.onWorkspaceOpened 同时触发 editorActor 和 chatActor（顺序无所谓）

---

## 四、Issue 5-B — API Key 安全存储

### 交付范围

1. Rust 新增 `save_api_key(provider: String, api_key: String) → Result<(), String>`
   - 存储路径：`app_config_dir() / binder-mini / {provider}.key`（明文存储 MVP，后续可加密）
   - BR-AG-SEC-001：key 原文不出现在前端
2. Rust 新增 `is_api_key_configured(provider: String) → Result<bool, String>`
3. `src/ipc.ts` 新增 `saveApiKey(provider, apiKey)` 和 `isApiKeyConfigured(provider)` 绑定
4. `App.tsx` `onSaveApiKey` → 调用 `saveApiKey()` IPC → 更新 `providerConfig.apiKeyConfigured = true`
5. `ProviderConfigPanel`：input type="password"，提交后原文不保留在 React state

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-AG-SEC-001 | Rust 存储；前端 React state 只含 apiKeyConfigured: boolean，不含 raw key |

### Rust 伪代码

```rust
#[tauri::command]
fn save_api_key(app: tauri::AppHandle, provider: String, api_key: String) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let key_path = config_dir.join(format!("{}.key", provider));
    std::fs::write(&key_path, api_key.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_api_key_configured(app: tauri::AppHandle, provider: String) -> Result<bool, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let key_path = config_dir.join(format!("{}.key", provider));
    Ok(key_path.exists() && std::fs::read_to_string(&key_path)
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false))
}
```

### 验收条件

- ProviderConfigPanel 输入 API key 后 `providerConfig.apiKeyConfigured` 变为 true
- React DevTools / TypeScript state 中无 raw API key 字段
- Rust `src/lib.rs` 有 `@GOV` 注释映射 BR-AG-SEC-001

---

## 五、Issue 5-C — SSE 流与 chatMachine 驱动

### 交付范围

1. `src-tauri/Cargo.toml` 新增：
   ```toml
   reqwest = { version = "0.12", features = ["stream", "json"] }
   futures-util = "0.3"
   ```
2. Rust `chat_stream(app, messages, provider, model) → Result<(), String>`
   - 读取存储的 api_key → 组装 Anthropic `/v1/messages` 请求（stream: true）
   - 解析 SSE 行 → `app.emit("chat-stream-event", ChatStreamEvent)`
   - SSE 事件类型：`Token { token }` / `Done` / `Failed { message }`
3. `src/services/chatActor.ts` `sendMessage()` 实现：
   - 追加 user AgentMessage
   - invoke `chat_stream` IPC（fire-and-forget）
   - `listen("chat-stream-event", handleStreamEvent)`
   - handleStreamEvent → 根据事件类型发送 chatMachine 事件
4. `streamAssistantResponse()` 在 agentService.ts 保留为 mock（不删除，测试覆盖用）

### SSE Tauri 事件类型（前端 TypeScript）

```typescript
type ChatStreamEvent =
  | { type: "token"; token: string }
  | { type: "done" }
  | { type: "failed"; message: string };
```

### chatMachine 事件路由

| SSE 事件 | chatMachine 事件 |
|---------|-----------------|
| 流请求发出（IPC 调用后）| `STREAM_STARTED` |
| `{ type: "token" }` | `TOKEN_RECEIVED { token }` |
| `{ type: "done" }` | `RESPONSE_DONE` |
| `{ type: "failed" }` | `FAILED { errorCode, errorMessage }` |
| CANCEL → 前端停止监听 | `CANCEL_DONE`（Rust 取消 pending）|

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-AG-STATE-002 | sending→streaming→ready 完整路径；TOKEN_RECEIVED 累积 streamingContent |
| BR-AG-SEC-001 | api_key 从 Rust 本地读取，不经过 TypeScript |

### 验收条件

- `cargo test` 仍 ≥ 16 pass
- `tsc --noEmit` 通过
- chatMachine 在 SSE 结束后进入 ready 状态（测试用 mock SSE 事件序列）

---

## 六、Issue 5-D — PromptRuntime 骨架（Rust）

### 交付范围（最小骨架，Phase 5 实现）

1. Rust `build_prompt(messages, workspace_root, active_file_path, model) → AnthropicRequest`
   - L0：base instructions + workspaceName + active_file_path（不含完整路径）
   - L1：InputReference 占位（Phase 5 空列表）
   - L2：历史 messages（最近 20 条）
   - L3：当前 user 消息
2. `chat_stream` 命令调用 `build_prompt` 组装请求
3. `allowedTools` 基础过滤：仅 `["read_file", "list_files", "search_files"]` 为 Phase 5 授权工具

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-AG-STATE-003 | allowedTools 在 Rust 后端维护；未授权 ToolCall → error response |

### 验收条件（Phase 5 骨架）

- Rust 编译通过
- `chat_stream` 命令在无 API key 情况下 emit `Failed { message: "API key not configured" }`

---

## 七、阶段性验证方案

### 验证门禁顺序

```
Issue 5-A ──── actor 门禁 ──→ Issue 5-B ──── API key 安全 ──→ Issue 5-C
（chatMachine 接入）          （key 存储 + configured bool）    （SSE 流驱动）
     ↓                                ↓                             ↓
Issue 5-D（PromptRuntime 骨架）
     ↓
     Phase 5 综合验证（governance:generate + vitest + cargo test + tsc）
```

| Issue | 门禁条件 |
|-------|---------|
| 5-A 完成后 | `tsc --noEmit` 通过；chatMachine actor 在 App.tsx 中以 useActorRef 运行；chatStateName() 从 chatValue 派生 |
| 5-B 完成后 | `tsc --noEmit` 通过；onSaveApiKey 写入 Rust 后端；apiKeyConfigured 布尔更新 |
| 5-C 完成后 | `cargo build` 通过（reqwest 编译）；chatMachine 状态机测试覆盖 SSE 事件路由 |
| 5-D 完成后 | `cargo test` ≥ 16 pass；build_prompt 骨架存在，无 API key 时返回结构化 error |

### 治理测试新增

新增 `tests/governance.phase5-ag.test.ts`，最少 7 个用例：

```typescript
// covers: BR-AG-STATE-001
it("chatMachine: WORKSPACE_OPENED → ready; SEND_MESSAGE → validatingProvider")
// covers: BR-AG-STATE-001
it("chatMachine: sendMessage 门禁 — apiKeyConfigured false → PROVIDER_INVALID → error")
// covers: BR-AG-STATE-002
it("chatMachine: STREAM_STARTED → streaming; TOKEN_RECEIVED 累积 streamingContent")
// covers: BR-AG-STATE-002
it("chatMachine: RESPONSE_DONE → ready; streamingContent 清空")
// covers: BR-AG-STATE-001
it("chatMachine: CANCEL 在 streaming 状态有效 → cancelling → CANCEL_DONE → ready")
// covers: BR-AG-PERSIST-001
it("chatMachine: WORKSPACE_CLOSED → noWorkspace; persistAndClearSession 清空所有 context")
// covers: BR-AG-SEC-001
it("chatActor.ts 源码包含 @GOV 注释且 BR-AG-SEC-001 在 codes 字段")
```

### 映射验证（Phase 5 结束）

```bash
npm run governance:generate
npm run governance:audit
npx vitest run
npx tsc --noEmit
cargo test
```

**预期结果 / 实测结果**

| 指标 | Phase 4 基线 | Phase 5 目标 | Phase 5 实测 |
|------|------------|------------|------------|
| `@GOV` 块数 | 58 | ≥ 60 | **61** ✓ |
| `OWNER_MISSING` | 6 | ≤ 4 | **6** ✗（偏差：均为 Phase 6 规则，见§八说明）|
| `cargo test` | 16 pass | ≥ 16 pass | **16 pass** ✓ |
| `vitest run` | 55 pass | ≥ 62 pass | **65 pass** ✓ |
| `tsc --noEmit` | clean | clean | **clean** ✓ |

---

## 八、Phase 5 整体验收核查清单

| 检查项 | 规则 | 状态 |
|--------|------|------|
| chatMachine 以 `useActorRef` 运行，`chatStateName()` 从 `chatValue` 派生 | BR-AG-STATE-001 | [x] |
| SEND_MESSAGE 门禁：apiKeyConfigured + 非空 userContent 同时满足 | BR-AG-STATE-001 | [x] |
| CANCEL 仅在 sending/streaming/toolCalling 有效（机器级约束） | BR-AG-STATE-001 | [x] |
| ACTIVE_FILE_CHANGED 追加 system 消息，不触发状态转移 | BR-AG-STATE-001 | [x] |
| SSE TOKEN_RECEIVED → streamingContent 累积 | BR-AG-STATE-002 | [x] |
| SSE RESPONSE_DONE → ready，streamingContent 清空 | BR-AG-STATE-002 | [x] |
| SSE FAILED → chatMachine error | BR-AG-STATE-002 | [x] |
| API key 原文只在 Rust 存储；前端只有 apiKeyConfigured: boolean | BR-AG-SEC-001 | [x] |
| save_api_key Rust 命令存储到 app_config_dir | BR-AG-SEC-001 | [x] |
| WORKSPACE_CLOSED → save_chat_messages 先于 WORKSPACE_CLOSED 发送 | BR-AG-PERSIST-001 | [x] |
| PromptRuntime 骨架：`chat_stream` 无 API key → `Failed { message }` structured error；无独立 build_prompt 函数（请求构建内联于 chat_stream，Phase 5-D 骨架部分完成）| BR-AG-STATE-003 | [~] |
| `tsc --noEmit` 零错误 | — | [x] |
| `cargo build` 通过（reqwest 编译）| — | [x] |
| `npm run governance:generate` @GOV 块数 ≥ 60 | — | [x] 实测 61 |
| `npm run governance:audit` OWNER_MISSING ≤ 4 | — | [!] 实测 6（偏差，见下方说明）|
| `npx vitest run` ≥ 62 pass | — | [x] 实测 65 |

### OWNER_MISSING 偏差说明

Phase 5 结束时 OWNER_MISSING = 6，目标 ≤ 4。6 条规则均为 Phase 6 规则，无法在 Phase 5 代码中合法添加 @GOV 注释：

| 规则 | 所属 Phase | 未覆盖原因 |
|------|-----------|-----------|
| BR-DE-STATE-010 | Phase 6-A | diffMachine 状态（DiskState 写入边界），尚未实现 |
| BR-DE-STATE-011 | Phase 6-A | diffMachine accept 不写盘路径，尚未实现 |
| BR-DE-STATE-012 | Phase 6-A | diffMachine 统一 expire 路径，尚未实现 |
| BR-AG-DATA-002 | Phase 6-E（AG-TOOL-CALL）| tool_result 事件回流，tool call 链路未实现 |
| BR-AG-DATA-003 | Phase 6-B（DE-CREATE-DIFF）| originalText + newText PM 精确替换接口，未实现 |
| BR-DE-DATA-001 | Phase 6-A（DE-CREATE-DIFF）| PendingDiff 可溯源字段（sourceToolId、baseRevision、effectivePath），TypeScript 侧 PendingDiff 类型尚未扩展 |

判断：添加虚假 @GOV 注释（声称已实现的规则覆盖）违反治理系统完整性。偏差接受，Phase 6 完成后 OWNER_MISSING 应降至 0。

---

## 九、与 Phase 6 的边界

Phase 5 交付物不包含：

| 排除项 | 所属 Phase |
|--------|---------|
| edit_current_editor_document 工具（open-file diff 路径）| Phase 6-B |
| update_file 工具（closed-file diff 路径）| Phase 6-B |
| DiffStore + diffMachine 实例化 | Phase 6-A |
| GreenAdditionDecoration 实现 | Phase 6-C |
| document_structure XML 在 PromptRuntime L0（需 BlockId）| Phase 6-D |
| InputReference 拖拽文件树入口（UI 交互完整实现）| Phase 5-F（延后）|

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-25 | v1.0 | 初始版本。基于 P-27 大纲 §六 和 AG-M-P-04，生成 Phase 5 全量 Issue Trace，含规则映射链图、名词声明、4 个 Issue、阶段验证方案和整体通过标准。Phase 4 基线：58 @GOV 块、6 OWNER_MISSING。 |
| 2026-05-25 | v1.1 | Phase 5 实施完成后更新。§七 增加实测列；§八 核查清单全量标注实测结果；新增 OWNER_MISSING 偏差说明（6 条均为 Phase 6 规则，拒绝添加虚假注释）。实测：61 @GOV 块、6 OWNER_MISSING、16 cargo tests、65 vitest tests、tsc clean。 |
