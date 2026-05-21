/**
 * @GOV
 * codes: BR-WS-STATE-001-DATA-WS-WS-OPEN-002,
 *        BR-WS-STATE-003-DATA-WS-WS-CLOSE-002,
 *        BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002,
 *        BR-SYS-GOV-001-DATA-WS-WS-OPEN-003,
 *        BR-CORE-GOV-001-DATA-WS-WS-OPEN-004
 * type: DATA
 * chain: WS-OPEN, WS-CLOSE, WS-FILE-MANAGE
 * rules: BR-WS-STATE-001, BR-WS-STATE-003, BR-WS-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=Workspace lifecycle events | out=workspaceMachine state definition including close/switch guard events
 * term_ref: TERM-CORE-001
 */
export type WorkspaceState =
  | "noWorkspace"
  | "opening"
  | "active"
  | "refreshing"
  | "error";

export type WorkspaceEvent =
  | "OPEN_REQUESTED"
  | "OPEN_SUCCEEDED"
  | "OPEN_FAILED"
  | "SWITCH_REQUESTED"
  | "CLOSE_REQUESTED"
  | "CLOSE_BLOCKED"
  | "CLOSE_FINISHED"
  | "REFRESH_REQUESTED"
  | "REFRESH_FINISHED";

export interface MachineDefinition<State extends string, Event extends string> {
  id: string;
  initial: State;
  states: Record<State, Partial<Record<Event, State>>>;
}

export function createWorkspaceMachineDefinition(): MachineDefinition<
  WorkspaceState,
  WorkspaceEvent
> {
  return {
    id: "workspaceMachine",
    initial: "noWorkspace",
    states: {
      noWorkspace: { OPEN_REQUESTED: "opening", SWITCH_REQUESTED: "opening" },
      opening: { OPEN_SUCCEEDED: "active", OPEN_FAILED: "error" },
      active: {
        SWITCH_REQUESTED: "opening",
        CLOSE_REQUESTED: "noWorkspace",
        CLOSE_BLOCKED: "active",
        REFRESH_REQUESTED: "refreshing",
      },
      refreshing: { REFRESH_FINISHED: "active", OPEN_FAILED: "error" },
      error: { OPEN_REQUESTED: "opening" },
    },
  };
}
