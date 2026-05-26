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
  | { type: "SEND_MESSAGE"; userContent: string; inputReferences: InputReference[] }
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
        createdAt: Date.now(),
        sessionId: context.workspaceRoot ?? "",
      };
      return {
        messages: [...context.messages, userMsg],
        inputReferences: event.inputReferences,
      };
    }),
    finalizeStreamingMessage: assign(({ context }) => {
      if (!context.streamingContent) return {};
      const assistantMsg: AgentMessage = {
        id: `msg-asst-${Date.now()}`,
        role: "assistant",
        content: context.streamingContent,
        streamStatus: "done",
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
        createdAt: Date.now(),
        sessionId: context.workspaceRoot ?? "",
      };
      return { messages: [...context.messages, syntheticMessage] };
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
        SEND_MESSAGE: { target: "validatingProvider", actions: "appendUserMessage" },
        PROVIDER_INVALID: { target: "error", actions: "assignError" },
        ACTIVE_FILE_CHANGED: { actions: "appendContextSwitchMessage" },
      },
    },
    validatingProvider: {
      on: {
        PROVIDER_VALID: "sending",
        PROVIDER_INVALID: { target: "error", actions: "assignError" },
      },
    },
    sending: {
      on: {
        STREAM_STARTED: "streaming",
        CANCEL: "cancelling",
        FAILED: { target: "error", actions: "assignError" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
      },
    },
    streaming: {
      on: {
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
        TOOL_FINISHED: "streaming",
        CANCEL: "cancelling",
        FAILED: { target: "error", actions: "assignError" },
        ACTIVE_FILE_CHANGED: { actions: "appendContextSwitchMessage" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
      },
    },
    cancelling: {
      on: {
        CANCEL_DONE: "ready",
        ABORT_FAILED: { target: "error", actions: "assignError" },
      },
    },
    error: {
      on: {
        RETRY: { target: "ready", actions: "clearError" },
        // BR-AG-STATE-001: allow sending a new message directly from error state;
        // clears the prior error and begins a fresh provider-validation cycle.
        SEND_MESSAGE: { target: "validatingProvider", actions: ["clearError", "appendUserMessage"] },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "persistAndClearSession" },
        ACTIVE_FILE_CHANGED: { actions: "appendContextSwitchMessage" },
      },
    },
  },
});
