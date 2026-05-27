import { useEffect, useRef } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { chatMachine } from "../machines/chatMachine";
import { saveChatMessages, loadChatMessages, readFile, listFiles, searchFiles, savePendingDiff, hashWorkspaceFile } from "../ipc";
import type { AgentMessage } from "../machines/chatMachine";
import type { ApplyDiffOptions, ApplyDiffResult } from "./editorActor";
import { diffStore } from "../stores/diffStore";
import type { AgentRuntimeContext, InputReference } from "../types/agent";

/**
 * @GOV
 * codes: BR-AG-STATE-001, BR-AG-STATE-002, BR-AG-STATE-003, BR-AG-SEC-001, BR-AG-PERSIST-001, BR-AG-PERSIST-002, BR-AG-DATA-002, BR-AG-DATA-003, BR-AG-DATA-004
 * type: RB
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL
 * rules: BR-AG-STATE-001, BR-AG-STATE-002, BR-AG-STATE-003, BR-AG-SEC-001, BR-AG-PERSIST-001, BR-AG-PERSIST-002, BR-AG-DATA-002, BR-AG-DATA-003, BR-AG-DATA-004
 * boundary: in=workspaceRoot string, userContent string, PromptRuntime context including ActiveFile LogicalStateSnapshot, and SSE stream Tauri events including ToolCall with id+name+input_json | out=chatMachine actor with AgentMessage list including role="tool" ToolResult carrying callId (BR-AG-DATA-002) | delegate=read/list/search IPC tools, applyDiffReplaceInEditor for ProseMirror mutation (BR-AG-DATA-003), diffStore for PendingDiff creation, chatMachine guards for state transitions
 * term_ref: TERM-AG-001, TERM-AG-002, TERM-AG-003, TERM-AG-004, TERM-AG-011, TERM-AG-013, TERM-AG-015, TERM-ED-002
 */

/** BR-AG-DATA-002: Payload shape matching ChatStreamEvent in lib.rs. */
type ToolCallPayload = { id: string; name: string; input_json: string };
type ChatStreamEvent =
  | { type: "token"; request_id?: string; requestId?: string; token: string }
  | { type: "tool_call"; request_id?: string; requestId?: string; id: string; name: string; input_json: string }
  | { type: "toolCall"; request_id?: string; requestId?: string; id: string; name: string; input_json: string }
  | { type: "tool_calls"; request_id?: string; requestId?: string; calls: ToolCallPayload[] }
  | { type: "toolCalls"; request_id?: string; requestId?: string; calls: ToolCallPayload[] }
  | { type: "done"; request_id?: string; requestId?: string }
  | { type: "failed"; request_id?: string; requestId?: string; message: string };

/** Message shape sent to the Rust chat_stream command. */
interface ChatStreamPayload {
  role: string;
  content: string;
  toolCallId?: string;
}

interface ChatToolRuntime {
  getActiveFilePath: () => string | null;
  applyDiffReplaceInTab: (
    tabId: string,
    originalText: string,
    newText: string,
    options?: ApplyDiffOptions,
  ) => ApplyDiffResult;
}

// ── Prompt Assembly Pipeline (BR-AG-DATA-004) ──────────────────────────────
// Five-step pipeline: classify → epoch-gate → compress → budget → anchor-inject.
// Runs once per user turn to build the provider payload from chatMachine context.messages.

type MessageClass =
  | "runtime-system"     // role=system (context-switch notifications) — always drop
  | "user-intent"        // role=user
  | "tool-result"        // role=tool
  | "tool-call"          // role=assistant with toolCallId (tool invocation record)
  | "assistant-state"    // role=assistant from a different epoch — compress to summary
  | "assistant-natural"; // role=assistant, current epoch or short enough to keep

interface ClassifiedMessage {
  msg: AgentMessage;
  cls: MessageClass;
}

interface PayloadDiagnostics {
  totalMessages: number;
  droppedSystemCount: number;
  epochGatedCount: number;
  compressedCount: number;
  runtimeAnchorInjected: boolean;
}

// Drop long content from old-epoch assistant messages after exceeding this threshold.
const MAX_ASSISTANT_CONTENT_CHARS = 1000;
// Rough character budget for history (≈ 10k tokens at 4 chars/token).
const MAX_HISTORY_CHARS = 40_000;
// Code block content that exceeds this total length is treated as a document paste.
const CODE_BLOCK_PASTE_THRESHOLD = 500;

const RUNTIME_ANCHOR_SEPARATOR = "\n\n---\n\n";

/** Step 1: Assign a MessageClass to each message. Language-agnostic; uses only role and metadata. */
function classifyMessage(msg: AgentMessage, currentActiveFilePath: string | null): MessageClass {
  if (msg.role === "system") return "runtime-system";
  if (msg.role === "user") return "user-intent";
  if (msg.role === "tool") return "tool-result";
  // role=assistant with toolCallId = the assistant message that issued a tool call
  if (msg.toolCallId) return "tool-call";

  // role=assistant — epoch check:
  //   activeFilePath === undefined  → legacy message, no epoch info → treat as current epoch
  //   activeFilePath !== current    → old epoch message
  //   activeFilePath === current    → same epoch
  const hasEpochInfo = msg.activeFilePath !== undefined;
  const isOldEpoch = hasEpochInfo && msg.activeFilePath !== currentActiveFilePath;

  if (isOldEpoch && msg.content.length > 200) return "assistant-state";
  return "assistant-natural";
}

/** Step 2: Replace runs of assistant-state messages with a single summary placeholder. */
function epochGate(classified: ClassifiedMessage[]): ClassifiedMessage[] {
  const result: ClassifiedMessage[] = [];
  let staleCount = 0;

  const flushStale = (anchor: string) => {
    if (staleCount === 0) return;
    result.push({
      cls: "assistant-natural",
      msg: {
        id: `epoch-gap-${anchor}`,
        role: "assistant",
        content:
          `[${staleCount} prior response${staleCount > 1 ? "s" : ""} about a different ` +
          `active file — omitted to prevent stale context from overriding current runtime facts.]`,
        createdAt: 0,
        sessionId: "",
      },
    });
    staleCount = 0;
  };

  for (const item of classified) {
    if (item.cls === "assistant-state") {
      staleCount++;
    } else {
      flushStale(item.msg.id);
      result.push(item);
    }
  }
  flushStale("end");
  return result;
}

/** Step 3: Truncate large document-paste blocks in assistant messages. */
function compressMessages(classified: ClassifiedMessage[]): ClassifiedMessage[] {
  return classified.map((item) => {
    if (item.cls !== "assistant-natural") return item;

    const codeBlocks = item.msg.content.match(/```[\s\S]*?```/g) ?? [];
    const codeBlockTotal = codeBlocks.reduce((s, b) => s + b.length, 0);

    const needsCompress =
      codeBlockTotal > CODE_BLOCK_PASTE_THRESHOLD ||
      item.msg.content.length > MAX_ASSISTANT_CONTENT_CHARS;

    if (!needsCompress) return item;

    const head = item.msg.content.slice(0, 200);
    return {
      ...item,
      msg: {
        ...item.msg,
        content:
          `${head}\n` +
          `[…content truncated (${item.msg.content.length} chars). ` +
          `Not authoritative for current document state.]`,
      },
    };
  });
}

/** Step 4: Trim history from the oldest end when total characters exceed budget. */
function applyTokenBudget(classified: ClassifiedMessage[]): ClassifiedMessage[] {
  let total = classified.reduce((s, m) => s + m.msg.content.length, 0);
  if (total <= MAX_HISTORY_CHARS) return classified;

  const result = [...classified];
  while (total > MAX_HISTORY_CHARS && result.length > 2) {
    const removed = result.shift()!;
    total -= removed.msg.content.length;
    // Keep tool-call/tool-result pairs together — remove the paired tool-result too
    if (removed.cls === "tool-call" && result[0]?.cls === "tool-result") {
      const paired = result.shift()!;
      total -= paired.msg.content.length;
    }
  }
  return result;
}

/** Builds the runtime anchor string injected before the current user turn. */
function buildRuntimeAnchor(activeFilePath: string): string {
  return (
    `[Runtime notice — active file for this turn: "${activeFilePath}". ` +
    `The only authoritative source for its current content is the ` +
    `<active_file_logical_state> block in the system prompt. ` +
    `Prior conversation claims about active file or document content are superseded ` +
    `by this turn's runtime context.]`
  );
}

/**
 * BR-AG-DATA-004: Build the provider messages payload from chatMachine context.messages.
 * Applies the 5-step pipeline so provider receives sanitised history + runtime anchor.
 */
function buildChatPayload(
  messages: AgentMessage[],
  currentActiveFilePath: string | null,
): { messages: ChatStreamPayload[]; diagnostics: PayloadDiagnostics } {
  // Step 1: Classify
  const classified: ClassifiedMessage[] = messages.map((msg) => ({
    msg,
    cls: classifyMessage(msg, currentActiveFilePath),
  }));

  const droppedSystemCount = classified.filter((m) => m.cls === "runtime-system").length;
  const withoutSystem = classified.filter((m) => m.cls !== "runtime-system");

  // Step 2: Epoch gate
  const epochGatedRaw = withoutSystem.filter((m) => m.cls === "assistant-state").length;
  const epochGated = epochGate(withoutSystem);

  // Step 3: Compress
  const compressed = compressMessages(epochGated);
  const compressedCount = compressed.reduce(
    (s, m, i) => s + (m.msg.content !== (epochGated[i]?.msg.content ?? "") ? 1 : 0),
    0,
  );

  // Step 4: Token budget
  const budgeted = applyTokenBudget(compressed);

  // Step 5: Serialise + inject runtime anchor into the last user message
  const payloads: ChatStreamPayload[] = budgeted.map((item) => ({
    role: item.msg.role,
    content: item.msg.content,
    ...(item.msg.toolCallId ? { toolCallId: item.msg.toolCallId } : {}),
  }));

  let runtimeAnchorInjected = false;
  if (currentActiveFilePath) {
    let lastUserIdx = -1;
    for (let i = payloads.length - 1; i >= 0; i--) {
      if (payloads[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx >= 0) {
      const anchor = buildRuntimeAnchor(currentActiveFilePath);
      payloads[lastUserIdx] = {
        ...payloads[lastUserIdx],
        content: anchor + RUNTIME_ANCHOR_SEPARATOR + payloads[lastUserIdx].content,
      };
      runtimeAnchorInjected = true;
    }
  }

  return {
    messages: payloads,
    diagnostics: {
      totalMessages: messages.length,
      droppedSystemCount,
      epochGatedCount: epochGatedRaw,
      compressedCount,
      runtimeAnchorInjected,
    },
  };
}

export function useChatActor(toolRuntime?: ChatToolRuntime) {
  const chatActor = useActorRef(chatMachine);
  const workspaceRootRef = useRef<string | null>(null);
  // Unlisten handle for the active SSE stream
  const unlistenRef = useRef<(() => void) | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const streamTimeoutRef = useRef<number | null>(null);
  // Messages accumulated for the next chat_stream invocation (includes tool turn messages).
  const messagesForNextRequestRef = useRef<ChatStreamPayload[]>([]);
  // Provider params echoed across tool turns so re-invocation uses the same model.
  const streamingProviderRef = useRef<{ providerType: string; model: string } | null>(null);
  const runtimeContextRef = useRef<AgentRuntimeContext>({});

  const chatValue = useSelector(chatActor, (s) => s.value as string);
  const chatContext = useSelector(chatActor, (s) => s.context);
  const chatMessages = chatContext.messages;
  const chatStreamingContent = chatContext.streamingContent;
  const chatErrorMessage = chatContext.errorMessage;

  async function onWorkspaceOpened(workspaceRoot: string) {
    workspaceRootRef.current = workspaceRoot;
    chatActor.send({ type: "WORKSPACE_OPENED", workspaceRoot });
    // BR-AG-PERSIST-001: restore messages from workspace DB on open
    try {
      const records = await loadChatMessages(workspaceRoot);
      const msgs: AgentMessage[] = records.map((r) => ({
        id: r.id,
        role: r.role as AgentMessage["role"],
        content: r.content,
        streamStatus: parseStreamStatus(r.streamStatus),
        toolCallId: r.toolCallId ?? undefined,
        inputReferences: parseInputReferences(r.inputReferencesJson),
        // BR-AG-DATA-004: restore epoch stamp; null/undefined both treated as "no epoch info"
        activeFilePath: r.activeFilePath ?? undefined,
        createdAt: r.createdAt,
        sessionId: r.sessionId,
      }));
      chatActor.send({ type: "MESSAGES_RESTORED", messages: msgs });
    } catch {
      chatActor.send({ type: "MESSAGES_RESTORED", messages: [] });
    }
  }

  async function onWorkspaceClosed() {
    const workspaceRoot = workspaceRootRef.current;
    // BR-AG-PERSIST-001: persist messages before clearing
    const messagesToSave = chatActor.getSnapshot().context.messages;
    if (workspaceRoot && messagesToSave.length > 0) {
      try {
        await saveChatMessages(workspaceRoot, messagesToRecords(messagesToSave));
      } catch {
        // persistence failure must not block workspace close
      }
    }
    // Stop any active SSE stream
    stopStream();
    workspaceRootRef.current = null;
    chatActor.send({ type: "WORKSPACE_CLOSED" });
  }

  useEffect(() => {
    const workspaceRoot = workspaceRootRef.current;
    if (!workspaceRoot || chatMessages.length === 0) return;
    const timeout = window.setTimeout(() => {
      void saveChatMessages(workspaceRoot, messagesToRecords(chatMessages));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [chatMessages]);

  function stopStream() {
    activeRequestIdRef.current = null;
    clearStreamTimeout();
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  }

  function clearStreamTimeout() {
    if (streamTimeoutRef.current !== null) {
      window.clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
  }

  function refreshStreamTimeout(requestId: string) {
    clearStreamTimeout();
    streamTimeoutRef.current = window.setTimeout(() => {
      if (activeRequestIdRef.current !== requestId) return;
      chatActor.send({
        type: "FAILED",
        errorCode: "STREAM_TIMEOUT",
        errorMessage: "模型响应超时，请检查网络或稍后重试。",
      });
      stopStream();
    }, 60_000);
  }

  function eventRequestId(payload: ChatStreamEvent): string | null {
    return payload.request_id ?? payload.requestId ?? null;
  }

  function parseStreamStatus(value: string | null): AgentMessage["streamStatus"] | undefined {
    return value === "streaming" || value === "done" || value === "cancelled" ? value : undefined;
  }

  function messagesToRecords(messages: AgentMessage[]) {
    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      streamStatus: m.streamStatus ?? null,
      toolCallId: m.toolCallId ?? null,
      inputReferencesJson: m.inputReferences && m.inputReferences.length > 0
        ? JSON.stringify(m.inputReferences)
        : null,
      // BR-AG-DATA-004: persist epoch stamp for future session restoration
      activeFilePath: m.activeFilePath ?? null,
      createdAt: m.createdAt,
      sessionId: m.sessionId,
    }));
  }

  function parseInputReferences(value: string | null): InputReference[] | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) return undefined;
      return parsed.filter(isInputReference);
    } catch {
      return undefined;
    }
  }

  function isInputReference(value: unknown): value is InputReference {
    if (!value || typeof value !== "object") return false;
    const ref = value as Partial<InputReference>;
    if (!ref.id || !ref.displayName || typeof ref.createdAt !== "number") return false;
    if (ref.kind === "text") return typeof ref.content === "string";
    return ref.kind === "url" && typeof ref.url === "string";
  }

  function createFailedToolResult(call: ToolCallPayload, reason: string): AgentMessage {
    return {
      id: `tool-result-${Date.now()}-${call.id}`,
      role: "tool",
      content: JSON.stringify({ success: false, reason }),
      toolCallId: call.id,
      createdAt: Date.now(),
      sessionId: workspaceRootRef.current ?? "",
    };
  }

  async function executeToolCall(call: ToolCallPayload): Promise<AgentMessage> {
    let inputParsed: {
      filePath?: string;
      dirPath?: string;
      query?: string;
      originalText?: string;
      newText?: string;
      summary?: string;
    } = {};
    try { inputParsed = JSON.parse(call.input_json); } catch { /* bad JSON → treat as missing fields */ }

    const workspaceRoot = workspaceRootRef.current;
    if ((call.name === "read_file" || call.name === "list_files" || call.name === "search_files") && !workspaceRoot) {
      return createFailedToolResult(call, "no-workspace");
    }

    if (call.name === "read_file") {
      const filePath = inputParsed.filePath ?? "";
      if (!filePath) return createFailedToolResult(call, "missing-filePath");

      // BR-AG-DATA-004: if the agent reads the current active file, return LogicalState
      // (the editor's in-memory content) instead of DiskState so unsaved edits are visible.
      const activeFilePath = runtimeContextRef.current.activeFilePath;
      const logicalSnapshot = runtimeContextRef.current.activeFileLogicalStateSnapshot;
      if (filePath === activeFilePath && logicalSnapshot !== undefined) {
        return createToolResult(call, {
          success: true,
          source: "logicalState",
          content: logicalSnapshot,
          filePath,
          notice: "Content from editor LogicalState (reflects unsaved edits; may differ from DiskState).",
        });
      }

      try {
        const content = await readFile(workspaceRoot!, filePath);
        return createToolResult(call, { success: true, source: "diskState", content, filePath });
      } catch (error) {
        return createFailedToolResult(call, error instanceof Error ? error.message : String(error));
      }
    }

    if (call.name === "list_files") {
      const dirPath = inputParsed.filePath || inputParsed.dirPath;
      try {
        const result = await listFiles(workspaceRoot!, dirPath);
        return createToolResult(call, { success: true, ...result });
      } catch (error) {
        return createFailedToolResult(call, error instanceof Error ? error.message : String(error));
      }
    }

    if (call.name === "search_files") {
      const query = inputParsed.query ?? "";
      if (!query.trim()) return createFailedToolResult(call, "missing-query");
      try {
        const results = await searchFiles(workspaceRoot!, query);
        return createToolResult(call, { success: true, results });
      } catch (error) {
        return createFailedToolResult(call, error instanceof Error ? error.message : String(error));
      }
    }

    if (call.name !== "edit_current_editor_document") {
      return createFailedToolResult(call, `unknown-tool:${call.name}`);
    }

    const {
      originalText = "",
      newText = "",
      summary = "",
      startBlockId,
      startOffset: _startOffset, // captured for future use; not used in PM search today
      occurrenceIndex,
    } = inputParsed as {
      originalText?: string;
      newText?: string;
      summary?: string;
      startBlockId?: string;
      startOffset?: number;
      occurrenceIndex?: number;
    };
    const filePath = runtimeContextRef.current.activeFilePath ?? "";
    if (!filePath) {
      return createFailedToolResult(call, "no-active-file");
    }
    if (runtimeContextRef.current.activeFileMode !== "editable") {
      return createFailedToolResult(call, "active-file-not-editable");
    }
    const logicalStateSnapshot = runtimeContextRef.current.activeFileLogicalStateSnapshot;
    if (logicalStateSnapshot === undefined) {
      return createFailedToolResult(call, "missing-logical-state-snapshot");
    }
    if (!originalText || !logicalStateSnapshot.includes(originalText)) {
      return createFailedToolResult(call, "originalText-not-in-logical-state-snapshot");
    }
    const currentActiveFilePath = toolRuntime?.getActiveFilePath() ?? null;
    if (!toolRuntime || currentActiveFilePath !== filePath) {
      return createFailedToolResult(call, "active-file-changed");
    }
    if (!workspaceRoot) {
      return createFailedToolResult(call, "no-workspace");
    }
    let baseRevision: string;
    try {
      baseRevision = await hashWorkspaceFile(workspaceRoot, filePath);
    } catch (error) {
      return createFailedToolResult(call, error instanceof Error ? error.message : String(error));
    }
    const applyResult = toolRuntime.applyDiffReplaceInTab(filePath, originalText, newText, {
      occurrenceIndex: typeof occurrenceIndex === "number" ? occurrenceIndex : 0,
      startBlockId: typeof startBlockId === "string" ? startBlockId : undefined,
    });
    let toolResultContent: string;

    const pendingDiff = diffStore.createDiff({
      filePath,
      originalText,
      newText,
      summary,
      sourceToolId: call.id,
      baseRevision,
      effectivePath: "open-file",
    });
    if (workspaceRoot) {
      persistPendingDiff(workspaceRoot, {
        id: pendingDiff.id,
        filePath: pendingDiff.filePath,
        originalText: pendingDiff.originalText,
        newText: pendingDiff.newText,
        summary: pendingDiff.summary,
        status: pendingDiff.status,
        effectivePath: pendingDiff.effectivePath,
        sourceToolId: pendingDiff.sourceToolId,
        baseRevision: pendingDiff.baseRevision,
        appliedRangeFrom: null,
        appliedRangeTo: null,
        createdAt: pendingDiff.createdAt,
      });
    }

    if (applyResult.success) {
      diffStore.updateDiff(pendingDiff.id, { appliedRange: applyResult.appliedRange });
      diffStore.getDiffActor(pendingDiff.id)?.send({ type: "LOGICAL_STATE_APPLIED" });
      if (workspaceRoot) {
        persistPendingDiff(workspaceRoot, {
          id: pendingDiff.id,
          filePath: pendingDiff.filePath,
          originalText: pendingDiff.originalText,
          newText: pendingDiff.newText,
          summary: pendingDiff.summary,
          status: "preapplied",
          effectivePath: pendingDiff.effectivePath,
          sourceToolId: pendingDiff.sourceToolId,
          baseRevision: pendingDiff.baseRevision,
          appliedRangeFrom: applyResult.appliedRange.from,
          appliedRangeTo: applyResult.appliedRange.to,
          createdAt: pendingDiff.createdAt,
        });
      }
      toolResultContent = JSON.stringify({
        success: true,
        diffId: pendingDiff.id,
        appliedRange: applyResult.appliedRange,
      });
    } else {
      diffStore.getDiffActor(pendingDiff.id)?.send({ type: "LOGICAL_STATE_APPLIED_FAILED" });
      diffStore.moveToTerminal(pendingDiff.id, createTerminalErrorCard(pendingDiff.id, call.id));
      if (workspaceRoot) {
        persistPendingDiff(workspaceRoot, {
          id: pendingDiff.id,
          filePath: pendingDiff.filePath,
          originalText: pendingDiff.originalText,
          newText: pendingDiff.newText,
          summary: pendingDiff.summary,
          status: "error",
          effectivePath: pendingDiff.effectivePath,
          sourceToolId: pendingDiff.sourceToolId,
          baseRevision: pendingDiff.baseRevision,
          appliedRangeFrom: null,
          appliedRangeTo: null,
          createdAt: pendingDiff.createdAt,
        });
      }
      toolResultContent = JSON.stringify({
        success: false,
        diffId: pendingDiff.id,
        reason: applyResult.reason,
      });
    }

    return {
      id: `tool-result-${Date.now()}-${call.id}`,
      role: "tool",
      content: toolResultContent,
      toolCallId: call.id,
      createdAt: Date.now(),
      sessionId: workspaceRootRef.current ?? "",
    };
  }

  function createToolResult(call: ToolCallPayload, content: unknown): AgentMessage {
    return {
      id: `tool-result-${Date.now()}-${call.id}`,
      role: "tool",
      content: JSON.stringify(content),
      toolCallId: call.id,
      createdAt: Date.now(),
      sessionId: workspaceRootRef.current ?? "",
    };
  }

  function createTerminalErrorCard(diffId: string, sourceToolId: string) {
    return {
      diffId,
      status: "error" as const,
      message: "Diff error",
      sourceToolId,
      resolvedAt: Date.now(),
    };
  }

  function persistPendingDiff(workspaceRoot: string, diff: Parameters<typeof savePendingDiff>[1]) {
    void savePendingDiff(workspaceRoot, diff).catch((error) => {
      console.warn("[chat] pending-diff:persist-failed", error);
    });
  }

  async function handleToolCalls(calls: ToolCallPayload[]) {
    if (calls.length === 0) return;
    stopStream();

    const streamedText = chatActor.getSnapshot().context.streamingContent;
    const parsedInputs = calls.map((call) => {
      try { return JSON.parse(call.input_json) as Record<string, unknown>; } catch { return {}; }
    });

    chatActor.send({
      type: "TOOL_REQUESTED",
      execution: { id: calls[0].id, toolName: calls[0].name, input: parsedInputs[0] ?? {} },
    });

    const assistantBlocks: Array<Record<string, unknown>> = [];
    if (streamedText) {
      assistantBlocks.push({ type: "text", text: streamedText });
    }
    calls.forEach((call, index) => {
      assistantBlocks.push({ type: "tool_use", id: call.id, name: call.name, input: parsedInputs[index] ?? {} });
    });
    messagesForNextRequestRef.current.push({
      role: "assistant",
      content: JSON.stringify(assistantBlocks),
      toolCallId: calls[0].id,
    });

    const toolResults: AgentMessage[] = [];
    for (const call of calls) {
      toolResults.push(await executeToolCall(call));
    }
    for (const result of toolResults) {
      messagesForNextRequestRef.current.push({
        role: "tool",
        content: result.content,
        toolCallId: result.toolCallId,
      });
    }

    chatActor.send({ type: "TOOL_FINISHED", result: toolResults });
    await invokeStream(messagesForNextRequestRef.current);
  }

  /**
   * Attach a new SSE listener and invoke chat_stream.
   * BR-AG-STATE-002: listener must be registered before IPC fires.
   */
  async function invokeStream(messages: ChatStreamPayload[]) {
    const workspaceRoot = workspaceRootRef.current ?? "";
    const provider = streamingProviderRef.current;
    if (!provider) return;

    stopStream();
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.info("[chat] stream:start", {
      requestId,
      providerType: provider.providerType,
      model: provider.model,
      messageCount: messages.length,
    });
    activeRequestIdRef.current = requestId;
    refreshStreamTimeout(requestId);

    const unlisten = await listen<ChatStreamEvent>("chat-stream-event", async (event) => {
      const payload = event.payload;
      if (eventRequestId(payload) !== requestId || activeRequestIdRef.current !== requestId) {
        console.debug("[chat] stream:ignored-event", {
          requestId,
          payloadType: payload.type,
          payloadRequestId: eventRequestId(payload),
          activeRequestId: activeRequestIdRef.current,
        });
        return;
      }
      refreshStreamTimeout(requestId);
      // Per-token debug log removed: fired for every SSE token and caused
      // WebKit to throttle output after 300 messages. stream:start / stream:done
      // / stream:failed already bracket the full streaming lifecycle.

      if (payload.type === "token") {
        chatActor.send({ type: "TOKEN_RECEIVED", token: payload.token });

      } else if (payload.type === "tool_call" || payload.type === "toolCall") {
        await handleToolCalls([{ id: payload.id, name: payload.name, input_json: payload.input_json }]);

      } else if (payload.type === "tool_calls" || payload.type === "toolCalls") {
        await handleToolCalls(payload.calls);

      } else if (payload.type === "done") {
        console.info("[chat] stream:done", { requestId });
        chatActor.send({ type: "RESPONSE_DONE" });
        stopStream();
      } else if (payload.type === "failed") {
        console.error("[chat] stream:failed", { requestId, message: payload.message });
        chatActor.send({
          type: "FAILED",
          errorCode: "STREAM_ERROR",
          errorMessage: payload.message,
        });
        stopStream();
      }
    });
    unlistenRef.current = unlisten;

    const runtimePayload = {
      activeFilePath: runtimeContextRef.current.activeFilePath ?? null,
      activeFileMode: runtimeContextRef.current.activeFileMode ?? null,
      activeFileDirty: runtimeContextRef.current.activeFileDirty ?? null,
      pendingDiffCount: runtimeContextRef.current.pendingDiffCount ?? null,
      activeFileLogicalStateSnapshot: runtimeContextRef.current.activeFileLogicalStateSnapshot ?? null,
      activeFileSnapshotTruncated: runtimeContextRef.current.activeFileSnapshotTruncated ?? null,
      documentStructure: runtimeContextRef.current.documentStructure ?? null,
      inputReferences: runtimeContextRef.current.inputReferences ?? [],
    };
    console.info("[chat] prompt-runtime:invoke", {
      requestId,
      workspaceRoot,
      providerType: provider.providerType,
      model: provider.model,
      messages,
      runtime: runtimePayload,
    });

    invoke("chat_stream", {
      requestId,
      workspaceRoot,
      messages,
      providerType: provider.providerType,
      model: provider.model,
      ...runtimePayload,
    }).catch((err: unknown) => {
      console.error("[chat] stream:ipc-error", { requestId, error: err });
      chatActor.send({
        type: "FAILED",
        errorCode: "IPC_ERROR",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      stopStream();
    });
    console.info("[chat] stream:ipc-invoked", { requestId });
  }

  async function sendMessage(
    userContent: string,
    providerType: string,
    model: string,
    apiKeyConfigured: boolean,
    runtimeContext: AgentRuntimeContext = {},
    inputReferences: InputReference[] = [],
  ) {
    const trimmed = userContent.trim();
    // BR-AG-STATE-001: SEND_MESSAGE guard
    const modelName = model.trim();
    if (!trimmed || !apiKeyConfigured || !modelName) {
      let errorMessage = "消息内容不能为空。";
      if (!apiKeyConfigured) {
        errorMessage = "请先配置当前模型供应商的 API Key。";
      } else if (!modelName) {
        errorMessage = "请先填写模型名称。";
      }
      chatActor.send({
        type: "PROVIDER_INVALID",
        errorCode: "PROVIDER_INVALID",
        errorMessage,
      });
      return false;
    }

    chatActor.send({
      type: "SEND_MESSAGE",
      userContent: trimmed,
      inputReferences,
      // BR-AG-DATA-004: stamp this turn's epoch so buildChatPayload can classify history
      activeFilePath: runtimeContext.activeFilePath ?? null,
    });
    chatActor.send({ type: "PROVIDER_VALID" });
    chatActor.send({ type: "STREAM_STARTED" });

    streamingProviderRef.current = { providerType, model: modelName };
    runtimeContextRef.current = { ...runtimeContext, inputReferences };

    // XState sends are synchronous — snapshot after SEND_MESSAGE already contains the new user message.
    const snap = chatActor.getSnapshot();

    // BR-AG-DATA-004: run the 5-step prompt assembly pipeline.
    // Classifies history by epoch, gates stale-file assertions, compresses document
    // pastes, applies token budget, and injects a runtime anchor into the last user message.
    const { messages: builtPayload, diagnostics } = buildChatPayload(
      snap.context.messages,
      runtimeContext.activeFilePath ?? null,
    );
    console.info("[chat] payload-built", diagnostics);
    messagesForNextRequestRef.current = builtPayload;

    // BR-AG-STATE-002: invokeStream sets up listener before IPC fire.
    await invokeStream(messagesForNextRequestRef.current);
    return true;
  }

  function cancelMessage() {
    stopStream();
    chatActor.send({ type: "CANCEL" });
    // Immediately resolve cancel (Rust side cleanup is best-effort)
    chatActor.send({ type: "CANCEL_DONE" });
  }

  function retryMessage() {
    chatActor.send({ type: "RETRY" });
  }

  function notifyActiveFileChanged(oldPath: string, newPath: string) {
    chatActor.send({ type: "ACTIVE_FILE_CHANGED", oldPath, newPath });
  }

  return {
    chatActor,
    chatValue,
    chatMessages,
    chatStreamingContent,
    chatErrorMessage,
    onWorkspaceOpened,
    onWorkspaceClosed,
    sendMessage,
    cancelMessage,
    retryMessage,
    notifyActiveFileChanged,
  };
}
