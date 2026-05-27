import { useRef, useState } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { chatMachine } from "../machines/chatMachine";
import { saveChatMessages, loadChatMessages, readFile, listFiles, searchFiles, savePendingDiff } from "../ipc";
import type { AgentMessage } from "../machines/chatMachine";
import { applyDiffReplaceInEditor } from "./editorActor";
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

export function useChatActor() {
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
      // Records arrive in saved order; inject directly into machine context
      // by appending synthetic ACTIVE_FILE_CHANGED — no, instead: machine starts with
      // empty messages, we populate via a side-channel reassignment after WORKSPACE_OPENED.
      // For Phase 5, restored messages are stored in a separate ref shown alongside live messages.
      const msgs = records.map((r) => ({
        id: r.id,
        role: r.role as AgentMessage["role"],
        content: r.content,
        streamStatus: undefined,
        createdAt: r.createdAt,
        sessionId: r.sessionId,
      }));
      restoredMessagesRef.current = msgs;
      setRestoredMessages(msgs);
    } catch {
      restoredMessagesRef.current = [];
      setRestoredMessages([]);
    }
  }

  // Restored messages from DB (shown before live session messages).
  // State drives re-render; ref provides synchronous access during SSE message accumulation.
  const [restoredMessages, setRestoredMessages] = useState<AgentMessage[]>([]);
  const restoredMessagesRef = useRef<AgentMessage[]>([]);

  async function onWorkspaceClosed() {
    const workspaceRoot = workspaceRootRef.current;
    // BR-AG-PERSIST-001: persist messages before clearing
    const messagesToSave = mergeMessagesForPersistence(restoredMessagesRef.current, chatMessages);
    if (workspaceRoot && messagesToSave.length > 0) {
      try {
        await saveChatMessages(
          workspaceRoot,
          messagesToSave.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            streamStatus: m.streamStatus ?? null,
            toolCallId: m.toolCallId ?? null,
            createdAt: m.createdAt,
            sessionId: m.sessionId,
          })),
        );
      } catch {
        // persistence failure must not block workspace close
      }
    }
    // Stop any active SSE stream
    stopStream();
    restoredMessagesRef.current = [];
    setRestoredMessages([]);
    workspaceRootRef.current = null;
    chatActor.send({ type: "WORKSPACE_CLOSED" });
  }

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

  function mergeMessagesForPersistence(
    restored: AgentMessage[],
    live: AgentMessage[],
  ): AgentMessage[] {
    const byId = new Map<string, AgentMessage>();
    for (const msg of [...restored, ...live]) {
      byId.set(msg.id, msg);
    }
    return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
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
    const applyResult = applyDiffReplaceInEditor(originalText, newText, {
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
      baseRevision: applyResult.success ? applyResult.contentRevisionBeforeApply : "0".repeat(64),
      effectivePath: "open-file",
    });
    if (workspaceRoot) {
      void savePendingDiff(workspaceRoot, {
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
        void savePendingDiff(workspaceRoot, {
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
        void savePendingDiff(workspaceRoot, {
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

    invoke("chat_stream", {
      requestId,
      workspaceRoot,
      messages,
      providerType: provider.providerType,
      model: provider.model,
      activeFilePath: runtimeContextRef.current.activeFilePath ?? null,
      activeFileMode: runtimeContextRef.current.activeFileMode ?? null,
      activeFileDirty: runtimeContextRef.current.activeFileDirty ?? null,
      pendingDiffCount: runtimeContextRef.current.pendingDiffCount ?? null,
      activeFileLogicalStateSnapshot: runtimeContextRef.current.activeFileLogicalStateSnapshot ?? null,
      activeFileSnapshotTruncated: runtimeContextRef.current.activeFileSnapshotTruncated ?? null,
      documentStructure: runtimeContextRef.current.documentStructure ?? null,
      inputReferences: runtimeContextRef.current.inputReferences ?? [],
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
      return;
    }

    chatActor.send({
      type: "SEND_MESSAGE",
      userContent: trimmed,
      inputReferences,
    });
    chatActor.send({ type: "PROVIDER_VALID" });
    chatActor.send({ type: "STREAM_STARTED" });

    streamingProviderRef.current = { providerType, model: modelName };
    runtimeContextRef.current = { ...runtimeContext, inputReferences };

    // XState sends are synchronous — snapshot after SEND_MESSAGE already contains the new user message.
    const snap = chatActor.getSnapshot();
    const toPayload = (m: AgentMessage): ChatStreamPayload => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
    });
    messagesForNextRequestRef.current = [
      ...restoredMessagesRef.current.map(toPayload),
      ...snap.context.messages.map(toPayload),
    ];

    // BR-AG-STATE-002: invokeStream sets up listener before IPC fire.
    await invokeStream(messagesForNextRequestRef.current);
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

  // Combined view: restored DB messages + live session messages.
  // Uses restoredMessages state (not ref) so React re-renders after DB load.
  function getAllMessages(): AgentMessage[] {
    return [...restoredMessages, ...chatMessages];
  }

  return {
    chatActor,
    chatValue,
    chatMessages: getAllMessages(),
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
