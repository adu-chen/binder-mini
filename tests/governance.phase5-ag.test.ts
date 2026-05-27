import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { chatMachine } from "../src/machines/chatMachine";

/**
 * Phase 5 Agent governance verification.
 * covers: BR-AG-STATE-001, BR-AG-STATE-002, BR-AG-SEC-001, BR-AG-PERSIST-001, BR-AG-PERSIST-002
 */

function bootToReady(workspaceRoot = "/ws") {
  const actor = createActor(chatMachine).start();
  actor.send({ type: "WORKSPACE_OPENED", workspaceRoot });
  return actor;
}

function repoPath(path: string) {
  return resolve(process.cwd(), path);
}

const SAMPLE_REFERENCE = {
  id: "ref-1",
  kind: "text" as const,
  content: "Reference body",
  displayName: "Reference body",
  createdAt: 1,
};

// covers: BR-AG-STATE-001
it("chatMachine: WORKSPACE_OPENED → ready; workspaceRoot recorded in context (BR-AG-STATE-001)", () => {
  const actor = createActor(chatMachine).start();
  expect(actor.getSnapshot().value).toBe("noWorkspace");
  actor.send({ type: "WORKSPACE_OPENED", workspaceRoot: "/my/ws" });
  expect(actor.getSnapshot().value).toBe("ready");
  expect(actor.getSnapshot().context.workspaceRoot).toBe("/my/ws");
});

// covers: BR-AG-STATE-001
it("chatMachine: SEND_MESSAGE → validatingProvider; user message appended to context.messages (BR-AG-STATE-001)", () => {
  const actor = bootToReady();
  actor.send({
    type: "SEND_MESSAGE",
    userContent: "Hello, binder!",
    inputReferences: [],
  });
  expect(actor.getSnapshot().value).toBe("validatingProvider");
  const msgs = actor.getSnapshot().context.messages;
  expect(msgs).toHaveLength(1);
  expect(msgs[0].role).toBe("user");
  expect(msgs[0].content).toBe("Hello, binder!");
});

// covers: BR-AG-PERSIST-001
it("chatMachine: MESSAGES_RESTORED writes persisted history into context.messages (BR-AG-PERSIST-001)", () => {
  const actor = bootToReady("/tmp/ws");
  actor.send({
    type: "MESSAGES_RESTORED",
    messages: [
      {
        id: "m-user",
        role: "user",
        content: "old prompt",
        createdAt: 1,
        sessionId: "/tmp/ws",
      },
      {
        id: "m-tool",
        role: "tool",
        content: "{\"success\":true}",
        streamStatus: "done",
        toolCallId: "tool-1",
        createdAt: 2,
        sessionId: "/tmp/ws",
      },
    ],
  });
  const msgs = actor.getSnapshot().context.messages;
  expect(msgs).toHaveLength(2);
  expect(msgs[1].role).toBe("tool");
  expect(msgs[1].toolCallId).toBe("tool-1");
  expect(msgs[1].streamStatus).toBe("done");
});

// covers: BR-AG-PERSIST-001
it("chatMachine: MESSAGES_RESTORED merges with live messages when restore finishes late", () => {
  const actor = bootToReady("/tmp/ws");
  actor.send({ type: "SEND_MESSAGE", userContent: "new prompt", inputReferences: [] });
  actor.send({
    type: "MESSAGES_RESTORED",
    messages: [
      {
        id: "old",
        role: "user",
        content: "old prompt",
        createdAt: 1,
        sessionId: "/tmp/ws",
      },
    ],
  });
  const msgs = actor.getSnapshot().context.messages;
  expect(msgs.map((m) => m.content)).toEqual(["old prompt", "new prompt"]);
});

// covers: BR-AG-DATA-001
it("chatMachine snapshots InputReference on send and clears after response done", () => {
  const actor = bootToReady();
  actor.send({
    type: "SEND_MESSAGE",
    userContent: "Use this reference",
    inputReferences: [SAMPLE_REFERENCE],
  });
  expect(actor.getSnapshot().context.inputReferences).toEqual([SAMPLE_REFERENCE]);

  actor.send({ type: "PROVIDER_VALID" });
  actor.send({ type: "STREAM_STARTED" });
  actor.send({ type: "TOKEN_RECEIVED", token: "done" });
  actor.send({ type: "RESPONSE_DONE" });
  expect(actor.getSnapshot().context.inputReferences).toEqual([]);
});

// covers: BR-AG-STATE-001
it("chatMachine: PROVIDER_INVALID in validatingProvider → error (BR-AG-STATE-001)", () => {
  const actor = bootToReady();
  actor.send({ type: "SEND_MESSAGE", userContent: "test", inputReferences: [] });
  expect(actor.getSnapshot().value).toBe("validatingProvider");
  actor.send({
    type: "PROVIDER_INVALID",
    errorCode: "PROVIDER_INVALID",
    errorMessage: "missing config",
  });
  expect(actor.getSnapshot().value).toBe("error");
  expect(actor.getSnapshot().context.errorMessage).toBe("missing config");
});

// covers: BR-AG-STATE-001
it("chatMachine: PROVIDER_INVALID in ready → visible error without appending user message (BR-AG-STATE-001)", () => {
  const actor = bootToReady();
  actor.send({
    type: "PROVIDER_INVALID",
    errorCode: "PROVIDER_INVALID",
    errorMessage: "请先填写模型名称。",
  });
  expect(actor.getSnapshot().value).toBe("error");
  expect(actor.getSnapshot().context.messages).toHaveLength(0);
  expect(actor.getSnapshot().context.errorMessage).toBe("请先填写模型名称。");
});

// covers: BR-AG-STATE-001
it("chatMachine: RETRY from error clears error and re-enters provider validation (BR-AG-STATE-001)", () => {
  const actor = bootToReady();
  actor.send({
    type: "PROVIDER_INVALID",
    errorCode: "PROVIDER_INVALID",
    errorMessage: "missing config",
  });
  expect(actor.getSnapshot().value).toBe("error");
  actor.send({ type: "RETRY" });
  expect(actor.getSnapshot().value).toBe("validatingProvider");
  expect(actor.getSnapshot().context.errorMessage).toBeNull();
});

// covers: BR-AG-STATE-002
it("chatMachine: STREAM_STARTED → streaming; TOKEN_RECEIVED accumulates streamingContent (BR-AG-STATE-002)", () => {
  const actor = bootToReady();
  actor.send({ type: "SEND_MESSAGE", userContent: "Hello", inputReferences: [] });
  actor.send({ type: "PROVIDER_VALID" });
  expect(actor.getSnapshot().value).toBe("sending");
  actor.send({ type: "STREAM_STARTED" });
  expect(actor.getSnapshot().value).toBe("streaming");
  actor.send({ type: "TOKEN_RECEIVED", token: "Hel" });
  actor.send({ type: "TOKEN_RECEIVED", token: "lo!" });
  expect(actor.getSnapshot().context.streamingContent).toBe("Hello!");
});

// covers: BR-AG-STATE-002
it("chatMachine: RESPONSE_DONE → ready; assistant message finalized, streamingContent cleared (BR-AG-STATE-002)", () => {
  const actor = bootToReady();
  actor.send({ type: "SEND_MESSAGE", userContent: "Hi", inputReferences: [] });
  actor.send({ type: "PROVIDER_VALID" });
  actor.send({ type: "STREAM_STARTED" });
  actor.send({ type: "TOKEN_RECEIVED", token: "World" });
  actor.send({ type: "RESPONSE_DONE" });
  expect(actor.getSnapshot().value).toBe("ready");
  expect(actor.getSnapshot().context.streamingContent).toBe("");
  const msgs = actor.getSnapshot().context.messages;
  // user message + assistant message
  expect(msgs).toHaveLength(2);
  expect(msgs[1].role).toBe("assistant");
  expect(msgs[1].content).toBe("World");
});

// covers: BR-AG-STATE-001
it("chatMachine: CANCEL in streaming → cancelling → CANCEL_DONE → ready (BR-AG-STATE-001)", () => {
  const actor = bootToReady();
  actor.send({ type: "SEND_MESSAGE", userContent: "test", inputReferences: [] });
  actor.send({ type: "PROVIDER_VALID" });
  actor.send({ type: "STREAM_STARTED" });
  expect(actor.getSnapshot().value).toBe("streaming");
  actor.send({ type: "CANCEL" });
  expect(actor.getSnapshot().value).toBe("cancelling");
  actor.send({ type: "CANCEL_DONE" });
  expect(actor.getSnapshot().value).toBe("ready");
});

// covers: BR-AG-PERSIST-001
it("chatMachine: WORKSPACE_CLOSED → noWorkspace; context fully cleared (BR-AG-PERSIST-001)", () => {
  const actor = bootToReady();
  actor.send({ type: "SEND_MESSAGE", userContent: "hello", inputReferences: [] });
  actor.send({ type: "PROVIDER_VALID" });
  actor.send({ type: "STREAM_STARTED" });
  actor.send({ type: "TOKEN_RECEIVED", token: "partial" });
  actor.send({ type: "WORKSPACE_CLOSED" });
  expect(actor.getSnapshot().value).toBe("noWorkspace");
  const ctx = actor.getSnapshot().context;
  expect(ctx.workspaceRoot).toBeNull();
  expect(ctx.messages).toHaveLength(0);
  expect(ctx.streamingContent).toBe("");
});

// covers: BR-AG-STATE-001
it("chatMachine: ACTIVE_FILE_CHANGED appends system message in ready/streaming states (BR-AG-STATE-001)", () => {
  const actor = bootToReady();
  actor.send({ type: "ACTIVE_FILE_CHANGED", oldPath: "/ws/a.md", newPath: "/ws/b.md" });
  expect(actor.getSnapshot().value).toBe("ready");
  const msgs = actor.getSnapshot().context.messages;
  expect(msgs).toHaveLength(1);
  expect(msgs[0].role).toBe("system");
  expect(msgs[0].content).toContain("b.md");
});

// covers: BR-AG-SEC-001
describe("governance @GOV coverage for Phase 5", () => {
  it("chatActor.ts contains @GOV with BR-AG-SEC-001 and provider persistence rules", () => {
    const src = readFileSync(
      repoPath("src/services/chatActor.ts"),
      "utf8",
    );
    expect(src).toContain("@GOV");
    expect(src).toContain("BR-AG-SEC-001");
    expect(src).toContain("BR-AG-STATE-002");
    expect(src).toContain("BR-AG-PERSIST-001");
    expect(src).toContain("BR-AG-PERSIST-002");
    expect(src).toContain("BR-AG-DATA-004");
  });

  // covers: BR-AG-PERSIST-002
  it("ipc.ts contains @GOV for save_api_key with BR-AG-SEC-001 and BR-AG-PERSIST-002", () => {
    const src = readFileSync(
      repoPath("src/ipc.ts"),
      "utf8",
    );
    expect(src).toContain("saveApiKey");
    expect(src).toContain("isApiKeyConfigured");
    expect(src).toContain("BR-AG-SEC-001");
    expect(src).toContain("BR-AG-PERSIST-002");
  });

  // covers: BR-AG-UI-001
  it("ProviderConfigPanel exposes provider and model controls (BR-AG-UI-001 source check)", () => {
    const src = readFileSync(
      repoPath("src/components/ProviderConfigPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("onProviderChange");
    expect(src).toContain("onModelChange");
    expect(src).toContain("<select");
    expect(src).toContain('value: "openai"');
    expect(src).toContain('value: "anthropic"');
    expect(src).toContain('value: "deepseek"');
  });

  it("ChatInput requires both API key and model before enabling send (BR-AG-UI-001 source check)", () => {
    const src = readFileSync(
      repoPath("src/components/ChatInput.tsx"),
      "utf8",
    );
    expect(src).toContain("modelConfigured");
    expect(src).toContain("providerConfigured && modelConfigured");
    expect(src).toContain("请先填写模型名称");
    expect(src).toContain("handlePaste");
  });

  it("App wires ProviderConfig state changes into ChatPanel (BR-AG-UI-001 source check)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    expect(src).toContain("function handleProviderChange");
    expect(src).toContain("function handleModelChange");
    expect(src).toContain("defaultModels");
    expect(src).toContain("providerConfig={providerConfig}");
    expect(src).toContain("inputReferences={inputReferences}");
    expect(src).toContain("onProviderChange={handleProviderChange}");
    expect(src).toContain("onModelChange={handleModelChange}");
  });

  // covers: BR-AG-STATE-003
  it("Rust chat_stream dispatches by provider instead of hardcoding Anthropic (BR-AG-STATE-003 source check)", () => {
    const src = readFileSync(
      repoPath("src-tauri/src/lib.rs"),
      "utf8",
    );
    expect(src).toContain('match provider_key.as_str()');
    expect(src).toContain('"anthropic" => anthropic_chat_stream');
    expect(src).toContain('"openai" =>');
    expect(src).toContain('"deepseek" =>');
    expect(src).toContain("https://api.openai.com/v1/chat/completions");
    expect(src).toContain("https://api.deepseek.com/chat/completions");
    expect(src).toContain("openai_compatible_chat_stream");
    expect(src).toContain("request_id");
    expect(src).toContain("ChatStreamEvent::Done { request_id");
  });

  // covers: BR-AG-TOOL-001
  it("Rust chat_stream builds PromptRuntime context and exposes read/list/search tools", () => {
    const src = readFileSync(
      repoPath("src-tauri/src/lib.rs"),
      "utf8",
    );
    expect(src).toContain("struct PromptRuntimeContext");
    expect(src).toContain("build_system_prompt");
    expect(src).toContain("build_input_references_xml");
    expect(src).toContain("<input_references>");
    expect(src).toContain('"read_file"');
    expect(src).toContain('"list_files"');
    expect(src).toContain('"search_files"');
    expect(src).toContain("allowed_tool_names");
    expect(src).toContain("active_file_path");
    expect(src).toContain("active_file_logical_state_snapshot");
    expect(src).toContain("<active_file_logical_state");
    expect(src).toContain("Do not use read_file/DiskState");
  });

  // covers: BR-AG-DATA-004
  it("Agent runtime carries ActiveFile LogicalStateSnapshot instead of relying on DiskState", () => {
    const typesSrc = readFileSync(
      repoPath("src/types/agent.ts"),
      "utf8",
    );
    const appSrc = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    const chatSrc = readFileSync(
      repoPath("src/services/chatActor.ts"),
      "utf8",
    );

    expect(typesSrc).toContain("activeFileLogicalStateSnapshot");
    expect(typesSrc).toContain("activeFileSnapshotTruncated");
    expect(appSrc).toContain("activeContent.slice");
    expect(appSrc).toContain("activeFileLogicalStateSnapshot");
    expect(chatSrc).toContain("missing-logical-state-snapshot");
    expect(chatSrc).toContain("originalText-not-in-logical-state-snapshot");
    expect(chatSrc).toContain('source: "diskState"');
  });
});
