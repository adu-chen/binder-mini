import { setup, assign } from "xstate";

/**
 * @GOV
 * codes: BR-WS-STATE-001, BR-WS-STATE-003, BR-WS-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * type: DATA
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-WS-STATE-001, BR-WS-STATE-003, BR-WS-DATA-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=WorkspaceRoot path from user workspace selector | out=workspaceMachine actor broadcasting WORKSPACE_OPENED and WORKSPACE_CLOSED to chatMachine and editorMachine
 * term_ref: TERM-CORE-001, TERM-WS-001
 */
export interface WorkspaceMachineContext {
  workspaceRoot: string | null;
  errorMessage: string | null;
}

export type WorkspaceMachineEvent =
  | { type: "OPEN_WORKSPACE"; workspaceRoot: string }
  | { type: "LOAD_SUCCEEDED" }
  | { type: "LOAD_FAILED"; errorMessage: string }
  | { type: "CLOSE_WORKSPACE" }
  | { type: "CONFIRM_CLOSE" }
  | { type: "CANCEL_CLOSE" }
  | { type: "CLOSE_DONE" }
  | { type: "CLOSE_FAILED"; errorMessage: string }
  | { type: "DISMISS" };

export const workspaceMachine = setup({
  types: {
    context: {} as WorkspaceMachineContext,
    events: {} as WorkspaceMachineEvent,
  },
  actions: {
    assignWorkspaceRoot: assign(({ event }) => {
      if (event.type !== "OPEN_WORKSPACE") return {};
      return { workspaceRoot: event.workspaceRoot, errorMessage: null };
    }),
    assignLoadError: assign(({ event }) => {
      if (event.type !== "LOAD_FAILED") return {};
      return { errorMessage: event.errorMessage };
    }),
    assignCloseError: assign(({ event }) => {
      if (event.type !== "CLOSE_FAILED") return {};
      return { errorMessage: event.errorMessage };
    }),
    clearWorkspace: assign({ workspaceRoot: null, errorMessage: null }),
  },
}).createMachine({
  id: "workspaceMachine",
  initial: "NoWorkspace",
  context: {
    workspaceRoot: null,
    errorMessage: null,
  },
  states: {
    NoWorkspace: {
      on: {
        OPEN_WORKSPACE: { target: "Loading", actions: "assignWorkspaceRoot" },
      },
    },
    Loading: {
      on: {
        LOAD_SUCCEEDED: "Active",
        LOAD_FAILED: { target: "Error", actions: "assignLoadError" },
      },
    },
    Active: {
      on: {
        CLOSE_WORKSPACE: "Closing",
      },
    },
    Closing: {
      on: {
        CONFIRM_CLOSE: "Closing",
        CANCEL_CLOSE: "Active",
        CLOSE_DONE: { target: "NoWorkspace", actions: "clearWorkspace" },
        CLOSE_FAILED: { target: "Error", actions: "assignCloseError" },
      },
    },
    Error: {
      on: {
        OPEN_WORKSPACE: { target: "Loading", actions: "assignWorkspaceRoot" },
        DISMISS: { target: "NoWorkspace", actions: "clearWorkspace" },
      },
    },
  },
});
