import { describe, expect, it } from "vitest";
import {
  activateEditorTab,
  canSaveEditorDocument,
  closeEditorTab,
  createEmptyEditorSession,
  createEditorStatusBarModel,
  getActiveEditorDocument,
  getEditorModeForPath,
  hasDirtyEditorTabs,
  openEditorTab,
  updateActiveEditorContent,
  upsertEditorTab,
  usesMarkdownEditor,
} from "../src/services/editorService";

describe("Editor MVP service behavior", () => {
  // covers: BR-ED-STATE-001
  it("uses editable mode for md and txt files only", () => {
    expect(getEditorModeForPath("notes/readme.md")).toBe("editable");
    expect(getEditorModeForPath("notes/plain.TXT")).toBe("editable");
    expect(getEditorModeForPath("assets/image.png")).toBe("readonly");
  });

  // covers: BR-ED-PERSIST-002
  it("routes only editable markdown documents to the Markdown editor", () => {
    expect(
      usesMarkdownEditor({
        workspaceRoot: "/tmp/ws",
        filePath: "notes/readme.md",
        content: "# Title",
        mode: "editable",
        dirty: false,
      }),
    ).toBe(true);
    expect(
      usesMarkdownEditor({
        workspaceRoot: "/tmp/ws",
        filePath: "notes/plain.txt",
        content: "hello",
        mode: "editable",
        dirty: false,
      }),
    ).toBe(false);
    expect(
      usesMarkdownEditor({
        workspaceRoot: "/tmp/ws",
        filePath: "notes/readme.md",
        content: "# Title",
        mode: "readonly",
        dirty: false,
      }),
    ).toBe(false);
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

  // covers: BR-ED-STATE-003
  it("blocks dirty tab close until discard is confirmed", () => {
    const dirtySession = updateActiveEditorContent(
      openEditorTab(createEmptyEditorSession(), {
        workspaceRoot: "/tmp/ws",
        filePath: "notes/a.md",
        content: "a",
        mode: "editable",
        dirty: false,
      }),
      "changed",
    );
    const tabId = dirtySession.activeTabId ?? "";
    const blocked = closeEditorTab(dirtySession, tabId, false);
    const closed = closeEditorTab(dirtySession, tabId, true);

    expect(blocked.blocked).toBe(true);
    expect(blocked.session.tabs).toHaveLength(1);
    expect(closed.blocked).toBe(false);
    expect(closed.session.tabs).toHaveLength(0);
    expect(closed.session.activeTabId).toBeNull();
  });

  // covers: BR-ED-STATE-003
  it("activates a neighboring tab after closing the active tab", () => {
    const session = openEditorTab(
      openEditorTab(createEmptyEditorSession(), {
        workspaceRoot: "/tmp/ws",
        filePath: "notes/a.md",
        content: "a",
        mode: "editable",
        dirty: false,
      }),
      {
        workspaceRoot: "/tmp/ws",
        filePath: "notes/b.md",
        content: "b",
        mode: "editable",
        dirty: false,
      },
    );
    const closed = closeEditorTab(session, session.activeTabId ?? "", false);

    expect(closed.session.tabs).toHaveLength(1);
    expect(getActiveEditorDocument(closed.session)?.filePath).toBe("notes/a.md");
  });

  // covers: BR-ED-STATE-004
  it("derives status bar data from the active editor document", () => {
    expect(
      createEditorStatusBarModel({
        workspaceRoot: "/tmp/ws",
        filePath: "notes/a.md",
        content: "hello world",
        mode: "editable",
        dirty: true,
      }),
    ).toEqual({
      filePath: "notes/a.md",
      stateLabel: "modified",
      characterCount: 11,
      wordCount: 2,
    });
    expect(createEditorStatusBarModel(null)).toBeNull();
  });
});
