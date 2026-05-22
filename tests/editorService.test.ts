import { describe, expect, it } from "vitest";
import {
  activateEditorTab,
  canSaveEditorDocument,
  createEmptyEditorSession,
  getActiveEditorDocument,
  getEditorModeForPath,
  hasDirtyEditorTabs,
  openEditorTab,
  updateActiveEditorContent,
  upsertEditorTab,
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

  // covers: BR-ED-STATE-002
  it("keeps multiple editor tabs independent and reuses an existing file tab", () => {
    const first = {
      workspaceRoot: "/tmp/ws",
      filePath: "notes/a.md",
      content: "a",
      mode: "editable" as const,
      dirty: false,
    };
    const second = {
      workspaceRoot: "/tmp/ws",
      filePath: "notes/b.md",
      content: "b",
      mode: "editable" as const,
      dirty: false,
    };

    const opened = upsertEditorTab(
      upsertEditorTab(createEmptyEditorSession(), first),
      second,
    );
    const edited = updateActiveEditorContent(opened, "b changed");
    const reopened = openEditorTab(edited, { ...first, content: "a fresh" });

    expect(opened.tabs).toHaveLength(2);
    expect(getActiveEditorDocument(edited)?.filePath).toBe("notes/b.md");
    expect(getActiveEditorDocument(edited)?.content).toBe("b changed");
    expect(hasDirtyEditorTabs(edited)).toBe(true);
    expect(reopened.tabs).toHaveLength(2);
    expect(getActiveEditorDocument(reopened)?.filePath).toBe("notes/a.md");
    expect(getActiveEditorDocument(reopened)?.content).toBe("a");
  });

  // covers: BR-ED-STATE-002
  it("activates only existing editor tabs", () => {
    const session = upsertEditorTab(createEmptyEditorSession(), {
      workspaceRoot: "/tmp/ws",
      filePath: "notes/a.md",
      content: "a",
      mode: "editable",
      dirty: false,
    });

    expect(activateEditorTab(session, "missing")).toBe(session);
    expect(getActiveEditorDocument(session)?.filePath).toBe("notes/a.md");
  });
});
