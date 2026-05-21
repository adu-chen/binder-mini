import type { MachineDefinition } from "./workspaceMachine";

/**
 * @GOV
 * codes: BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-002,
 *        BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-002,
 *        BR-SYS-GOV-001-DATA-ED-ED-OPEN-FILE-003,
 *        BR-CORE-GOV-001-DATA-ED-ED-OPEN-FILE-004
 * type: DATA
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-PERSIST-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=Editor file events | out=editorMachine state definition
 */
export type EditorState =
  | "closed"
  | "loading"
  | "editing"
  | "saving"
  | "readonly"
  | "error";

export type EditorEvent =
  | "OPEN_FILE"
  | "LOAD_EDITABLE"
  | "LOAD_READONLY"
  | "LOAD_FAILED"
  | "SAVE_REQUESTED"
  | "SAVE_SUCCEEDED"
  | "SAVE_FAILED"
  | "CLOSE_FILE";

export function createEditorMachineDefinition(): MachineDefinition<
  EditorState,
  EditorEvent
> {
  return {
    id: "editorMachine",
    initial: "closed",
    states: {
      closed: { OPEN_FILE: "loading" },
      loading: {
        LOAD_EDITABLE: "editing",
        LOAD_READONLY: "readonly",
        LOAD_FAILED: "error",
      },
      editing: { SAVE_REQUESTED: "saving", CLOSE_FILE: "closed" },
      saving: { SAVE_SUCCEEDED: "editing", SAVE_FAILED: "error" },
      readonly: { CLOSE_FILE: "closed" },
      error: { OPEN_FILE: "loading", CLOSE_FILE: "closed" },
    },
  };
}
