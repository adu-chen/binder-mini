import { describe, expect, it } from "vitest";
import {
  canSaveEditorDocument,
  getEditorModeForPath,
} from "../src/services/editorService";

describe("Editor MVP service behavior", () => {
  // covers: BR-ED-STATE-001
  it("uses editable mode for md and txt files only", () => {
    expect(getEditorModeForPath("notes/readme.md")).toBe("editable");
    expect(getEditorModeForPath("notes/plain.TXT")).toBe("editable");
    expect(getEditorModeForPath("assets/image.png")).toBe("readonly");
  });

  // covers: BR-ED-PERSIST-001
  it("allows save only for dirty editable current documents", () => {
    expect(
      canSaveEditorDocument({
        workspaceRoot: "/tmp/ws",
        filePath: "notes/readme.md",
        content: "hello",
        mode: "editable",
        dirty: true,
      }),
    ).toBe(true);
    expect(
      canSaveEditorDocument({
        workspaceRoot: "/tmp/ws",
        filePath: "notes/readme.md",
        content: "hello",
        mode: "editable",
        dirty: false,
      }),
    ).toBe(false);
    expect(
      canSaveEditorDocument({
        workspaceRoot: "/tmp/ws",
        filePath: "assets/image.png",
        content: "hello",
        mode: "readonly",
        dirty: true,
      }),
    ).toBe(false);
  });
});
