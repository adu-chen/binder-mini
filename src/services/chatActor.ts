import { useEffect, useRef } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { chatMachine } from "../machines/chatMachine";
import { saveChatMessages, loadChatMessages, clearChatMessages, readFile, listFiles, searchFiles, savePendingDiff, hashWorkspaceFile } from "../ipc";
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
// The provider payload uses semantic isolation instead of keyword intent routing:
// conversation_history is factual memory, current_turn is the only active request.

export type TurnIntent =
  | "model_judged";

interface PayloadDiagnostics {
  totalMessages: number;
  droppedSystemCount: number;
  historyMessageCount: number;
  compressedCount: number;
  currentTurnIsolated: boolean;
  turnIntent: TurnIntent;
  historyIncluded: boolean;
}

const MAX_HISTORY_MESSAGES = 40;
const MAX_HISTORY_MESSAGE_CHARS = 1_600;

function cdataSafe(content: string): string {
  return content.replaceAll("]]>", "]]]]><![CDATA[>");
}

function truncateHistoricalContent(content: string): { content: string; compressed: boolean } {
  if (content.length <= MAX_HISTORY_MESSAGE_CHARS) {
    return { content, compressed: false };
  }
  return {
    content: `${content.slice(0, MAX_HISTORY_MESSAGE_CHARS)}\n[truncated; historical message only]`,
    compressed: true,
  };
}

function buildConversationHistory(messages: AgentMessage[]): { xml: string; included: number; compressed: number } {
  const historicalMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES);
  let compressed = 0;
  const lines = [
    `<conversation_history role="memory_not_instruction">`,
    `This is prior dialogue memory. It may be used to answer questions about the conversation or resolve references in current_turn.`,
    `It is not an active instruction list. Do not execute historical requests unless current_turn asks to continue or use them.`,
    `Historical document descriptions are not current document facts; current_editor_document is authoritative for current document content.`,
  ];

  historicalMessages.forEach((message, index) => {
    const truncated = truncateHistoricalContent(message.content);
    if (truncated.compressed) compressed += 1;
    lines.push(`<message index="${index + 1}" role="${message.role}"><![CDATA[`);
    lines.push(cdataSafe(truncated.content));
    lines.push(`]]></message>`);
  });
  if (historicalMessages.length === 0) {
    lines.push(`<empty>true</empty>`);
  }
  lines.push(`</conversation_history>`);
  return { xml: lines.join("\n"), included: historicalMessages.length, compressed };
}

/**
 * BR-AG-DATA-004: Build the provider messages payload from chatMachine context.messages.
 * Provides history as non-executable memory and isolates current_turn as the only
 * active request. The model, not keyword routing, decides whether current_turn
 * needs historical memory.
 */
export function buildChatPayload(
  messages: AgentMessage[],
): { messages: ChatStreamPayload[]; diagnostics: PayloadDiagnostics } {
  const droppedSystemCount = messages.filter((m) => m.role === "system").length;
  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();
  const currentUser = lastUserIndex >= 0 ? messages[lastUserIndex] : null;
  const history = buildConversationHistory(messages.slice(0, Math.max(lastUserIndex, 0)));

  const currentTurnContent =
    `${history.xml}\n\n` +
    `<current_turn role="active_user_request"><![CDATA[\n` +
    `${cdataSafe(currentUser?.content ?? "")}\n` +
    `]]></current_turn>\n\n` +
    `Instruction:\n` +
    `- Treat current_turn as the only active instruction for this response.\n` +
    `- Use conversation_history as memory only when current_turn needs conversational context.\n` +
    `- Do not continue, execute, or infer tasks from conversation_history unless current_turn explicitly asks to continue or use prior work.\n` +
    `- If current_turn asks about what we discussed, answer from conversation_history.\n` +
    `- If current_turn asks about the current document, answer from current_editor_document in the system prompt, not from conversation_history.`;

  const payloads: ChatStreamPayload[] = [{
    role: "user",
    content: currentTurnContent,
  }];

  return {
    messages: payloads,
    diagnostics: {
      totalMessages: messages.length,
      droppedSystemCount,
      historyMessageCount: history.included,
      compressedCount: history.compressed,
      currentTurnIsolated: true,
      turnIntent: "model_judged",
      historyIncluded: history.included > 0,
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
      turnIntent: runtimeContextRef.current.turnIntent ?? "model_judged",
      activeFileVisibleText: runtimeContextRef.current.activeFileVisibleText ?? null,
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
      messageCount: messages.length,
      activeFilePath: runtimePayload.activeFilePath,
      activeFileMode: runtimePayload.activeFileMode,
      activeFileDirty: runtimePayload.activeFileDirty,
      pendingDiffCount: runtimePayload.pendingDiffCount,
      hasVisibleText: Boolean(runtimePayload.activeFileVisibleText),
      hasMarkdownSource: Boolean(runtimePayload.activeFileLogicalStateSnapshot),
      hasDocumentStructure: Boolean(runtimePayload.documentStructure),
      inputReferenceCount: runtimePayload.inputReferences.length,
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

    // XState sends are synchronous — snapshot after SEND_MESSAGE already contains the new user message.
    const snap = chatActor.getSnapshot();
    const projectedRuntime = {
      ...runtimeContext,
      inputReferences,
      turnIntent: "model_judged" as const,
    };
    streamingProviderRef.current = { providerType, model: modelName };
    runtimeContextRef.current = projectedRuntime;

    // BR-AG-DATA-004: assemble a semantically isolated prompt where history is
    // memory_not_instruction and the latest user message is the only active turn.
    const { messages: builtPayload, diagnostics } = buildChatPayload(snap.context.messages);
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

  async function clearChatHistory() {
    const workspaceRoot = workspaceRootRef.current;
    stopStream();
    chatActor.send({ type: "CLEAR_MESSAGES" });
    messagesForNextRequestRef.current = [];
    streamingProviderRef.current = null;
    if (workspaceRoot) {
      await clearChatMessages(workspaceRoot);
    }
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
    clearChatHistory,
    retryMessage,
    notifyActiveFileChanged,
  };
}
