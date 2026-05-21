/**
 * @GOV
 * codes: BR-WS-STATE-001-DATA-WS-WS-OPEN-002,
 *        BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-002,
 *        BR-SYS-GOV-001-DATA-WS-WS-OPEN-003,
 *        BR-CORE-GOV-001-DATA-WS-WS-OPEN-004
 * type: DATA
 * chain: WS-OPEN, WS-FILE-MANAGE
 * rules: BR-WS-STATE-001, BR-WS-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=Workspace lifecycle events | out=workspaceMachine state definition
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
      noWorkspace: { OPEN_REQUESTED: "opening" },
      opening: { OPEN_SUCCEEDED: "active", OPEN_FAILED: "error" },
      active: { REFRESH_REQUESTED: "refreshing" },
      refreshing: { REFRESH_FINISHED: "active", OPEN_FAILED: "error" },
      error: { OPEN_REQUESTED: "opening" },
    },
  };
}
