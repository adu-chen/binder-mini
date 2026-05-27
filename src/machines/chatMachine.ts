import { setup, assign } from "xstate";
import type { InputReference } from "../types/agent";

/**
 * @GOV
 * codes: BR-AG-STATE-001, BR-AG-STATE-002, BR-AG-STATE-003, BR-AG-OBS-001, BR-AG-DATA-001, BR-AG-SEC-001, BR-AG-PERSIST-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * type: DATA
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL
 * rules: BR-AG-STATE-001, BR-AG-STATE-002, BR-AG-STATE-003, BR-AG-OBS-001, BR-AG-DATA-001, BR-AG-SEC-001, BR-AG-PERSIST-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=AgentMessage and ToolExecution events from Provider SSE stream | out=chatMachine actor managing AgentMessage list and streaming state transitions
 * term_ref: TERM-AG-002, TERM-AG-004, TERM-AG-011
 */

export interface AgentMessage {
  id: string;
  /** BR-AG-DATA-002: "tool" role carries ToolResult.callId in toolCallId; sent as tool_result to Anthropic API. */
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  streamStatus?: "streaming" | "done" | "cancelled";
  toolCallId?: string;
  /** InputReference snapshot attached to the user message that submitted it. */
  inputReferences?: InputReference[];
  /**
   * BR-AG-DATA-004: Active file path at the time this message was created.
   * Used by buildChatPayload() to detect epoch boundaries (stale file context).
   * null  = no active file when message was created.
   * undefined = legacy message created before epoch tracking was added (treat as current epoch).
   */
  activeFilePath?: string | null;
  createdAt: number;
  sessionId: string;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMachineContext {
  workspaceRoot: string | null;
  /** BR-AG-DATA-004: current active file path, updated on SEND_MESSAGE and ACTIVE_FILE_CHANGED. */
  activeFilePath: string | null;
  messages: AgentMessage[];
  streamingContent: string;
  pendingToolExecutions: ToolExecution[];
  activeToolExecution: ToolExecution | null;
  inputReferences: InputReference[];
  errorCode: string | null;
  errorMessage: string | null;
}

export type ChatMachineEvent =
  | { type: "WORKSPACE_OPENED"; workspaceRoot: string }
  | { type: "WORKSPACE_CLOSED" }
  | { type: "MESSAGES_RESTORED"; messages: AgentMessage[] }
  | { type: "SEND_MESSAGE"; userContent: string; inputReferences: InputReference[]; activeFilePath: string | null }
  | { type: "PROVIDER_VALID" }
  | { type: "PROVIDER_INVALID"; errorCode: string; errorMessage: string }
  | { type: "STREAM_STARTED" }
  | { type: "TOKEN_RECEIVED"; token: string }
  | { type: "TOOL_REQUESTED"; execution: ToolExecution }
  | { type: "TOOL_FINISHED"; result: unknown }
  | { type: "RESPONSE_DONE" }
  | { type: "CANCEL" }
  | { type: "CANCEL_DONE" }
  | { type: "FAILED"; errorCode: string; errorMessage: string }
  | { type: "ABORT_FAILED"; errorCode: string; errorMessage: string }
  | { type: "RETRY" }
  | { type: "ACTIVE_FILE_CHANGED"; oldPath: string; newPath: string };

export const chatMachine = setup({
  types: {
    context: {} as ChatMachineContext,
    events: {} as ChatMachineEvent,
  },
  actions: {
    assignWorkspaceRoot: assign(({ event }) => {
      if (event.type !== "WORKSPACE_OPENED") return {};
      return { workspaceRoot: event.workspaceRoot };
    }),
    persistAndClearSession: assign({
      workspaceRoot: null,
      activeFilePath: null,
      messages: [],
      streamingContent: "",
      pendingToolExecutions: [],
      activeToolExecution: null,
      inputReferences: [],
      errorCode: null,
      errorMessage: null,
    }),
    appendUserMessage: assign(({ context, event }) => {
      if (event.type !== "SEND_MESSAGE") return {};
      const userMsg: AgentMessage = {
        id: `msg-user-${Date.now()}`,
        role: "user",
        content: event.userContent,
        streamStatus: undefined,
        inputReferences: event.inputReferences,
        // BR-AG-DATA-004: stamp with active file at send time for epoch tracking
        activeFilePath: event.activeFilePath,
        createdAt: Date.now(),
        sessionId: context.workspaceRoot ?? "",
      };
      return {
        messages: [...context.messages, userMsg],
        // Update context epoch so subsequent messages (assistant, tool) inherit same file
        activeFilePath: event.activeFilePath,
        inputReferences: [],
      };
    }),
    restoreMessages: assign(({ context, event }) => {
      if (event.type !== "MESSAGES_RESTORED") return {};
      const byId = new Map<string, AgentMessage>();
      for (const message of [...event.messages, ...context.messages]) {
        byId.set(message.id, message);
      }
      return { messages: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt) };
    }),
    finalizeStreamingMessage: assign(({ context }) => {
      if (!context.streamingContent) return {};
      const assistantMsg: AgentMessage = {
        id: `msg-asst-${Date.now()}`,
        role: "assistant",
        content: context.streamingContent,
        streamStatus: "done",
        // BR-AG-DATA-004: inherit epoch from context (set when SEND_MESSAGE was processed)
        activeFilePath: context.activeFilePath,
        createdAt: Date.now(),
        sessionId: context.workspaceRoot ?? "",
      };
      return { messages: [...context.messages, assistantMsg], streamingContent: "", inputReferences: [] };
    }),
    accumulateToken: assign(({ context, event }) => {
      if (event.type !== "TOKEN_RECEIVED") return {};
      return { streamingContent: context.streamingContent + event.token };
    }),
    assignError: assign(({ event }) => {
      if (
        event.type !== "FAILED" &&
        event.type !== "ABORT_FAILED" &&
        event.type !== "PROVIDER_INVALID"
      ) return {};
      return { errorCode: event.errorCode, errorMessage: event.errorMessage };
    }),
    appendContextSwitchMessage: assign(({ context, event }) => {
      if (event.type !== "ACTIVE_FILE_CHANGED") return {};
      const syntheticMessage: AgentMessage = {
        id: `ctx-switch-${Date.now()}`,
        role: "system",
        content: `[Context: Active file switched from ${event.oldPath} to ${event.newPath}]`,
        // BR-AG-DATA-004: mark epoch boundary; buildChatPayload drops role=system messages
        activeFilePath: event.newPath,
        createdAt: Date.now(),
        sessionId: context.workspaceRoot ?? "",
      };
      return {
        messages: [...context.messages, syntheticMessage],
        // Advance epoch so the next send picks up the new file
        activeFilePath: event.newPath,
      };
    }),
    // BR-DE-UI-003: when TOOL_REQUESTED fires, finalize the in-progress streaming text
    // as an assistant message that carries toolCallId. This makes the toolCallId available
    // in context.messages so MessageBubble can link DiffCards via
    // AgentMessage.toolCallId === PendingDiff.sourceToolId.
    finalizeToolRequestMessage: assign(({ context, event }) => {
      if (event.type !== "TOOL_REQUESTED") return {};
      const assistantMsg: AgentMessage = {
        id: `msg-asst-tool-${Date.now()}`,
        role: "assistant",
        content: context.streamingContent,
        toolCallId: event.execution.id,
        streamStatus: "done",
        // BR-AG-DATA-004: inherit epoch from context
        activeFilePath: context.activeFilePath,
        createdAt: Date.now(),
        sessionId: context.workspaceRoot ?? "",
      };
      return {
        messages: [...context.messages, assistantMsg],
        streamingContent: "",
      };
    }),
    clearStreamingContent: assign({ streamingContent: "" }),
    clearError: assign({ errorCode: null, errorMessage: null }),
  },
}).createMachine({
  id: "chatMachine",
  initial: "noWorkspace",
  context: {
    workspaceRoot: null,
    activeFilePath: null,
    messages: [],
    streamingContent: "",
    pendingToolExecutions: [],
    activeToolExecution: null,
    inputReferences: [],
    errorCode: null,
    errorMessage: null,
  },
  states: {
    noWorkspace: {
      on: {
        WORKSPACE_OPENED: { target: "ready", actions: "assignWorkspaceRoot" },
      },
    },
    ready: {
      on: {
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
        MESSAGES_RESTORED: { actions: "restoreMessages" },
        SEND_MESSAGE: { target: "validatingProvider", actions: "appendUserMessage" },
        PROVIDER_INVALID: { target: "error", actions: "assignError" },
        ACTIVE_FILE_CHANGED: { actions: "appendContextSwitchMessage" },
      },
    },
    validatingProvider: {
      on: {
        MESSAGES_RESTORED: { actions: "restoreMessages" },
        PROVIDER_VALID: "sending",
        PROVIDER_INVALID: { target: "error", actions: "assignError" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
      },
    },
    sending: {
      on: {
        MESSAGES_RESTORED: { actions: "restoreMessages" },
        STREAM_STARTED: "streaming",
        CANCEL: "cancelling",
        FAILED: { target: "error", actions: "assignError" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
      },
    },
    streaming: {
      on: {
        MESSAGES_RESTORED: { actions: "restoreMessages" },
        TOKEN_RECEIVED: { actions: "accumulateToken" },
        // BR-DE-UI-003: finalizeToolRequestMessage replaces clearStreamingContent —
        // it both clears streamingContent and appends an assistant message with toolCallId,
        // enabling DiffCard-to-message linkage via AgentMessage.toolCallId === diff.sourceToolId.
        TOOL_REQUESTED: { target: "toolCalling", actions: "finalizeToolRequestMessage" },
        RESPONSE_DONE: { target: "ready", actions: "finalizeStreamingMessage" },
        CANCEL: "cancelling",
        FAILED: { target: "error", actions: "assignError" },
        ACTIVE_FILE_CHANGED: { actions: "appendContextSwitchMessage" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
      },
    },
    toolCalling: {
      on: {
        MESSAGES_RESTORED: { actions: "restoreMessages" },
        TOOL_FINISHED: "streaming",
        CANCEL: "cancelling",
        FAILED: { target: "error", actions: "assignError" },
        ACTIVE_FILE_CHANGED: { actions: "appendContextSwitchMessage" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
      },
    },
    cancelling: {
      on: {
        MESSAGES_RESTORED: { actions: "restoreMessages" },
        CANCEL_DONE: "ready",
        ABORT_FAILED: { target: "error", actions: "assignError" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
      },
    },
    error: {
      on: {
        MESSAGES_RESTORED: { actions: "restoreMessages" },
        RETRY: { target: "validatingProvider", actions: "clearError" },
        // BR-AG-STATE-001: allow sending a new message directly from error state;
        // clears the prior error and begins a fresh provider-validation cycle.
        SEND_MESSAGE: { target: "validatingProvider", actions: ["clearError", "appendUserMessage"] },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
        ACTIVE_FILE_CHANGED: { actions: "appendContextSwitchMessage" },
      },
    },
  },
});
