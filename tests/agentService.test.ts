import { describe, expect, it } from "vitest";
import {
  canRecordAgentMessage,
  canSendAgentMessage,
  completeToolExecution,
  createAssistantStreamChunks,
  createAssistantStreamMessage,
  createPendingToolExecution,
  createUserAgentMessage,
  failToolExecution,
  isReadonlyInputReference,
  normalizeProviderConfig,
  summarizeSearchResults,
  summarizeText,
} from "../src/services/agentService";

describe("Agent Provider MVP service behavior", () => {
  // covers: BR-AG-STATE-001
  it("requires configured provider and non-empty model before sending", () => {
    expect(
      canSendAgentMessage({
        provider: "openai",
        model: "gpt-4.1",
        apiKeyConfigured: true,
      }),
    ).toBe(true);
    expect(
      canSendAgentMessage({
        provider: "openai",
        model: " ",
        apiKeyConfigured: true,
      }),
    ).toBe(false);
    expect(
      canSendAgentMessage({
        provider: "openai",
        model: "gpt-4.1",
        apiKeyConfigured: false,
      }),
    ).toBe(false);
  });

  // covers: BR-AG-OBS-001
  it("creates pending ToolExecution records", () => {
    const execution = createPendingToolExecution("read_file");
    expect(execution.toolName).toBe("read_file");
    expect(execution.inputBoundary).toBe("Workspace");
    expect(execution.status).toBe("pending");
    expect(completeToolExecution(execution, "ok").status).toBe("succeeded");
    expect(failToolExecution(execution, "nope").errorMessage).toBe("nope");
  });

  // covers: BR-AG-DATA-001
  it("keeps InputReference readonly and message content normalized", () => {
    expect(
      isReadonlyInputReference({
        id: "ref-1",
        mode: "readonly",
        target: { workspaceRoot: "/tmp/ws", relativePath: "notes.md" },
      }),
    ).toBe(true);
    expect(canRecordAgentMessage("  hello  ")).toBe(true);
    expect(canRecordAgentMessage("   ")).toBe(false);
    expect(createUserAgentMessage("  hello  ").content).toBe("hello");
  });

  // covers: BR-AG-STATE-001
  it("normalizes ProviderConfig model text", () => {
    expect(
      normalizeProviderConfig({
        provider: "anthropic",
        model: " claude ",
        apiKeyConfigured: true,
      }),
    ).toEqual({
      provider: "anthropic",
      model: "claude",
      apiKeyConfigured: true,
    });
  });

  // covers: BR-AG-OBS-001
  it("summarizes read and search tool results", () => {
    expect(summarizeText(" hello\nworld ")).toBe("hello world");
    expect(summarizeSearchResults([])).toBe("No matches");
    expect(
      summarizeSearchResults([{ filePath: "notes.md", preview: "match line" }]),
    ).toBe("notes.md: match line");
  });

  // covers: BR-AG-STATE-001
  it("creates observable assistant stream chunks", () => {
    const message = createAssistantStreamMessage();
    expect(message.role).toBe("assistant");
    expect(message.streamStatus).toBe("streaming");

    const chunks = createAssistantStreamChunks({
      provider: {
        provider: "openai",
        model: "gpt-4.1",
        apiKeyConfigured: true,
      },
      userContent: " inspect workspace ",
      workspaceName: "demo",
      activeFilePath: "notes.md",
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)?.done).toBe(true);
    expect(chunks.map((chunk) => chunk.content).join("")).toContain(
      "Provider openai/gpt-4.1 accepted",
    );
  });
});
