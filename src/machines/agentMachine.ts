import type { MachineDefinition } from "./workspaceMachine";

/**
 * @GOV
 * codes: BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-002,
 *        BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-003,
 *        BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-004,
 *        BR-SYS-GOV-001-DATA-AG-AG-SEND-MESSAGE-005,
 *        BR-CORE-GOV-001-DATA-AG-AG-SEND-MESSAGE-006
 * type: DATA
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL
 * rules: BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=Agent message and ToolExecution events | out=agentMachine state definition
 * term_ref: TERM-AG-001
 */
export type AgentState =
  | "idle"
  | "validatingProvider"
  | "sending"
  | "streaming"
  | "toolCalling"
  | "error";

export type AgentEvent =
  | "SEND_REQUESTED"
  | "PROVIDER_VALID"
  | "PROVIDER_INVALID"
  | "STREAM_STARTED"
  | "TOOL_REQUESTED"
  | "TOOL_FINISHED"
  | "RESPONSE_FINISHED"
  | "FAILED";

export function createAgentMachineDefinition(): MachineDefinition<
  AgentState,
  AgentEvent
> {
  return {
    id: "agentMachine",
    initial: "idle",
    states: {
      idle: { SEND_REQUESTED: "validatingProvider" },
      validatingProvider: {
        PROVIDER_VALID: "sending",
        PROVIDER_INVALID: "error",
      },
      sending: { STREAM_STARTED: "streaming", FAILED: "error" },
      streaming: {
        TOOL_REQUESTED: "toolCalling",
        RESPONSE_FINISHED: "idle",
        FAILED: "error",
      },
      toolCalling: { TOOL_FINISHED: "streaming", FAILED: "error" },
      error: { SEND_REQUESTED: "validatingProvider" },
    },
  };
}
