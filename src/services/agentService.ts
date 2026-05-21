import type {
  AgentMessage,
  InputReference,
  ProviderConfig,
  ToolExecution,
} from "../types/agent";

/**
 * @GOV
 * codes: BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007,
 *        BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008,
 *        BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009,
 *        BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010
 * type: RB
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL
 * rules: BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-CORE-GOV-001
 * boundary: in=ProviderConfig, InputReference, and ToolExecution | out=Agent request readiness and readonly reference assertions | delegate=provider validation, ToolExecution recording, InputReference guard
 * term_ref: TERM-AG-002
 */
export function canSendAgentMessage(provider: ProviderConfig): boolean {
  return provider.apiKeyConfigured && provider.model.trim().length > 0;
}

export function normalizeProviderConfig(
  provider: ProviderConfig,
): ProviderConfig {
  return {
    provider: provider.provider,
    model: provider.model.trim(),
    apiKeyConfigured: provider.apiKeyConfigured,
  };
}

export function isReadonlyInputReference(reference: InputReference): boolean {
  return reference.mode === "readonly";
}

export function createPendingToolExecution(toolName: string): ToolExecution {
  return {
    id: `tool-${Date.now()}`,
    toolName,
    inputBoundary: "Workspace",
    status: "pending",
  };
}

export function createUserAgentMessage(content: string): AgentMessage {
  return {
    id: `msg-${Date.now()}`,
    role: "user",
    content: content.trim(),
  };
}

export function canRecordAgentMessage(content: string): boolean {
  return content.trim().length > 0;
}
