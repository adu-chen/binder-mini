import { invoke } from "@tauri-apps/api/core";
import type {
  EditorDocument,
  EditorOpenRequest,
  EditorSession,
  EditorTab,
} from "../types/editor";

/**
 * @GOV
 * codes: BR-ED-STATE-001-GUARD-ED-ED-OPEN-FILE-005,
 *        BR-ED-STATE-002-DATA-ED-ED-OPEN-FILE-007,
 *        BR-ED-PERSIST-001-RB-ED-ED-SAVE-FILE-003,
 *        BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-004
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-PERSIST-001, BR-CORE-GOV-001
 * boundary: in=EditorDocument or EditorSession | out=save readiness, active tab, dirty tab, and tab reuse decisions | delegate=file type mode, active tab, and dirty state checks
 */
export function canSaveEditorDocument(document: EditorDocument): boolean {
  return document.mode === "editable" && document.dirty;
}

export function createEmptyEditorSession(): EditorSession {
  return {
    tabs: [],
    activeTabId: null,
  };
}

export function createEditorTab(document: EditorDocument): EditorTab {
  return {
    ...document,
    id: editorTabId(document.workspaceRoot, document.filePath),
    status: editorStatusForDocument(document),
  };
}

export function openEditorTab(
  session: EditorSession,
  document: EditorDocument,
): EditorSession {
  const nextTab = createEditorTab(document);
  if (session.tabs.some((tab) => tab.id === nextTab.id)) {
    return activateEditorTab(session, nextTab.id);
  }
  return {
    tabs: [...session.tabs, nextTab],
    activeTabId: nextTab.id,
  };
}

export function upsertEditorTab(
  session: EditorSession,
  document: EditorDocument,
): EditorSession {
  const nextTab = createEditorTab(document);
  const existingIndex = session.tabs.findIndex((tab) => tab.id === nextTab.id);
  if (existingIndex === -1) {
    return {
      tabs: [...session.tabs, nextTab],
      activeTabId: nextTab.id,
    };
  }
  return {
    tabs: session.tabs.map((tab, index) =>
      index === existingIndex ? { ...tab, ...nextTab } : tab,
    ),
    activeTabId: nextTab.id,
  };
}

export function activateEditorTab(
  session: EditorSession,
  tabId: string,
): EditorSession {
  if (!session.tabs.some((tab) => tab.id === tabId)) {
    return session;
  }
  return {
    ...session,
    activeTabId: tabId,
  };
}

export function getActiveEditorDocument(
  session: EditorSession,
): EditorDocument | null {
  const tab = session.tabs.find((item) => item.id === session.activeTabId);
  if (!tab) return null;
  return editorDocumentFromTab(tab);
}

export function updateActiveEditorContent(
  session: EditorSession,
  content: string,
): EditorSession {
  if (!session.activeTabId) return session;
  return {
    ...session,
    tabs: session.tabs.map((tab) =>
      tab.id === session.activeTabId
        ? { ...tab, content, dirty: true, status: "dirty" }
        : tab,
    ),
  };
}

export function hasDirtyEditorTabs(session: EditorSession): boolean {
  return session.tabs.some((tab) => tab.dirty);
}

/**
 * @GOV
 * codes: BR-ED-STATE-001-QUERY-ED-ED-OPEN-FILE-006,
 *        BR-ED-PERSIST-001-EFFECT-ED-ED-SAVE-FILE-006,
 *        BR-CORE-GOV-001-RB-ED-ED-OPEN-FILE-006
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-PERSIST-001, BR-CORE-GOV-001
 * boundary: in=EditorOpenRequest or EditorSaveRequest | out=EditorDocument or persisted current file | delegate=Tauri read_workspace_file,write_workspace_file
 */
export async function openEditorDocument(
  request: EditorOpenRequest,
): Promise<EditorDocument> {
  return invoke<EditorDocument>("read_workspace_file", {
    workspaceRoot: request.workspaceRoot,
    relativePath: request.relativePath,
  });
}

export async function saveEditorDocument(
  document: EditorDocument,
): Promise<EditorDocument> {
  if (!canSaveEditorDocument(document)) {
    return document;
  }

  return invoke<EditorDocument>("write_workspace_file", {
    workspaceRoot: document.workspaceRoot,
    relativePath: document.filePath,
    content: document.content,
  });
}

export function getEditorModeForPath(filePath: string): EditorDocument["mode"] {
  const normalized = filePath.toLowerCase();
  return normalized.endsWith(".md") || normalized.endsWith(".txt")
    ? "editable"
    : "readonly";
}

function editorTabId(workspaceRoot: string, filePath: string): string {
  return `${workspaceRoot}::${filePath}`;
}

function editorStatusForDocument(document: EditorDocument): EditorTab["status"] {
  if (document.mode === "readonly") return "readonly";
  return document.dirty ? "dirty" : "editing";
}

function editorDocumentFromTab(tab: EditorTab): EditorDocument {
  return {
    filePath: tab.filePath,
    workspaceRoot: tab.workspaceRoot,
    content: tab.content,
    mode: tab.mode,
    dirty: tab.dirty,
  };
}
