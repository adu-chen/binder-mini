import { setup, assign } from "xstate";

/**
 * @GOV
 * codes: BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-003, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003, BR-SYS-GOV-001, BR-CORE-GOV-001
 * type: DATA
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-003, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=EditorTab file events and WorkspaceMachine lifecycle broadcasts | out=editorMachine actor broadcasting ACTIVE_FILE_CHANGED and LOGICAL_STATE_APPEARED to chatMachine and diffMachine
 * term_ref: TERM-ED-001, TERM-ED-003, TERM-DOC-003
 */

export interface EditorTab {
  id: string;
  filePath: string;
  fileType: "md" | "txt" | "other";
  dirty: boolean;
}

export interface EditorMachineContext {
  tabs: EditorTab[];
  activeTabId: string | null;
  errorMessage: string | null;
}

export type EditorMachineEvent =
  | { type: "WORKSPACE_OPENED"; workspaceRoot: string }
  | { type: "WORKSPACE_CLOSED" }
  | { type: "OPEN_FILE"; filePath: string }
  | { type: "FILE_LOADED"; filePath: string; fileType: "md" | "txt" | "other"; content: string }
  | { type: "LOAD_FAILED"; filePath: string; errorMessage: string }
  | { type: "USER_EDIT" }
  | { type: "SAVE" }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "SAVE_FAILED"; errorMessage: string }
  | { type: "CLOSE_TAB"; filePath: string }
  | { type: "SWITCH_TAB"; filePath: string }
  | { type: "ROLLBACK_LOGICAL_STATE"; diffId: string; appliedRange: { from: number; to: number }; originalText: string };

export const editorMachine = setup({
  types: {
    context: {} as EditorMachineContext,
    events: {} as EditorMachineEvent,
  },
  guards: {
    isEditable: ({ event }) =>
      event.type === "FILE_LOADED" && (event.fileType === "md" || event.fileType === "txt"),
    isLastTab: ({ context }) => context.tabs.length === 1,
    isClosingActiveTab: ({ context, event }) =>
      event.type === "CLOSE_TAB" && context.activeTabId === event.filePath,
    isSwitchingToDirtyTab: ({ context, event }) => {
      if (event.type !== "SWITCH_TAB") return false;
      return context.tabs.find((t) => t.id === event.filePath)?.dirty === true;
    },
    isSwitchingToReadonly: ({ context, event }) => {
      if (event.type !== "SWITCH_TAB") return false;
      return context.tabs.find((t) => t.id === event.filePath)?.fileType === "other";
    },
    isDirtyAfterRollback: () => false,
  },
  actions: {
    assignTabOpened: assign(({ context, event }) => {
      if (event.type !== "FILE_LOADED") return {};
      const tab: EditorTab = {
        id: event.filePath,
        filePath: event.filePath,
        fileType: event.fileType,
        dirty: false,
      };
      const exists = context.tabs.some((t) => t.id === event.filePath);
      return {
        tabs: exists ? context.tabs : [...context.tabs, tab],
        activeTabId: event.filePath,
        errorMessage: null,
      };
    }),
    markActiveDirty: assign(({ context }) => ({
      tabs: context.tabs.map((t) =>
        t.id === context.activeTabId ? { ...t, dirty: true } : t
      ),
    })),
    markActiveClean: assign(({ context }) => ({
      tabs: context.tabs.map((t) =>
        t.id === context.activeTabId ? { ...t, dirty: false } : t
      ),
    })),
    removeClosedTab: assign(({ context, event }) => {
      if (event.type !== "CLOSE_TAB") return {};
      const nextTabs = context.tabs.filter((t) => t.id !== event.filePath);
      let nextActiveTabId = context.activeTabId;
      if (context.activeTabId === event.filePath) {
        const closedIndex = context.tabs.findIndex((t) => t.id === event.filePath);
        nextActiveTabId = nextTabs[Math.min(closedIndex, nextTabs.length - 1)]?.id ?? null;
      }
      return { tabs: nextTabs, activeTabId: nextActiveTabId };
    }),
    updateActiveTabId: assign(({ event }) => {
      if (event.type !== "SWITCH_TAB") return {};
      return { activeTabId: event.filePath };
    }),
    assignLoadError: assign(({ event }) => {
      if (event.type !== "LOAD_FAILED") return {};
      return { errorMessage: event.errorMessage };
    }),
    assignSaveError: assign(({ event }) => {
      if (event.type !== "SAVE_FAILED") return {};
      return { errorMessage: event.errorMessage };
    }),
    clearAllTabs: assign({ tabs: [], activeTabId: null, errorMessage: null }),
  },
}).createMachine({
  id: "editorMachine",
  initial: "noWorkspace",
  context: {
    tabs: [],
    activeTabId: null,
    errorMessage: null,
  },
  states: {
    noWorkspace: {
      on: {
        WORKSPACE_OPENED: "idle",
      },
    },
    idle: {
      on: {
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "clearAllTabs" },
        OPEN_FILE: "loading",
      },
    },
    loading: {
      on: {
        FILE_LOADED: [
          { guard: "isEditable", target: "editing", actions: "assignTabOpened" },
          { target: "readonly", actions: "assignTabOpened" },
        ],
        LOAD_FAILED: { target: "error", actions: "assignLoadError" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "clearAllTabs" },
      },
    },
    editing: {
      on: {
        USER_EDIT: { target: "dirty", actions: "markActiveDirty" },
        OPEN_FILE: "loading",
        CLOSE_TAB: [
          { guard: "isLastTab", target: "idle", actions: "removeClosedTab" },
          { target: "editing", actions: "removeClosedTab" },
        ],
        SWITCH_TAB: [
          { guard: "isSwitchingToDirtyTab", target: "dirty", actions: "updateActiveTabId" },
          { guard: "isSwitchingToReadonly", target: "readonly", actions: "updateActiveTabId" },
          { target: "editing", actions: "updateActiveTabId" },
        ],
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "clearAllTabs" },
      },
    },
    dirty: {
      on: {
        SAVE: "saving",
        ROLLBACK_LOGICAL_STATE: [
          { guard: "isDirtyAfterRollback", target: "dirty" },
          { target: "editing" },
        ],
        OPEN_FILE: "loading",
        CLOSE_TAB: [
          { guard: "isLastTab", target: "idle", actions: "removeClosedTab" },
          { guard: "isClosingActiveTab", target: "editing", actions: "removeClosedTab" },
          { target: "dirty", actions: "removeClosedTab" },
        ],
        SWITCH_TAB: [
          { guard: "isSwitchingToDirtyTab", target: "dirty", actions: "updateActiveTabId" },
          { guard: "isSwitchingToReadonly", target: "readonly", actions: "updateActiveTabId" },
          { target: "editing", actions: "updateActiveTabId" },
        ],
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "clearAllTabs" },
      },
    },
    saving: {
      on: {
        SAVE_SUCCEEDED: { target: "editing", actions: "markActiveClean" },
        SAVE_FAILED: { target: "error", actions: "assignSaveError" },
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "clearAllTabs" },
      },
    },
    readonly: {
      on: {
        OPEN_FILE: "loading",
        CLOSE_TAB: [
          { guard: "isLastTab", target: "idle", actions: "removeClosedTab" },
          { target: "readonly", actions: "removeClosedTab" },
        ],
        SWITCH_TAB: [
          { guard: "isSwitchingToDirtyTab", target: "dirty", actions: "updateActiveTabId" },
          { guard: "isSwitchingToReadonly", target: "readonly", actions: "updateActiveTabId" },
          { target: "editing", actions: "updateActiveTabId" },
        ],
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "clearAllTabs" },
      },
    },
    error: {
      on: {
        OPEN_FILE: "loading",
        CLOSE_TAB: [
          { guard: "isLastTab", target: "idle", actions: "removeClosedTab" },
          { target: "error", actions: "removeClosedTab" },
        ],
        WORKSPACE_CLOSED: { target: "noWorkspace", actions: "clearAllTabs" },
      },
    },
  },
});
