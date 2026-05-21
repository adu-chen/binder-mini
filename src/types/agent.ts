import type { WorkspaceFileTarget } from "./workspace";

/**
 * @GOV
 * codes: BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-001,
 *        BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-001,
 *        BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-002
 * type: DATA
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL
 * rules: BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001
 * boundary: in=Provider configuration, Workspace file target, and user supplied references | out=Agent message, ToolExecution, and InputReference structures
 * term_ref: TERM-AG-001
 */
export interface ProviderConfig {
  provider: "openai" | "anthropic" | "deepseek";
  model: string;
  apiKeyConfigured: boolean;
}

export interface InputReference {
  id: string;
  target: WorkspaceFileTarget;
  mode: "readonly";
}

export interface ToolExecution {
  toolName: string;
  inputBoundary: string;
  status: "pending" | "running" | "succeeded" | "failed";
  errorMessage?: string;
}
