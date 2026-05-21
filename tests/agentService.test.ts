import { describe, expect, it } from "vitest";
import {
  canRecordAgentMessage,
  canSendAgentMessage,
  createPendingToolExecution,
  createUserAgentMessage,
  isReadonlyInputReference,
  normalizeProviderConfig,
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
});
