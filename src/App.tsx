import { useState } from "react";
import { createAgentMachineDefinition } from "./machines/agentMachine";
import { createDiffMachineDefinition } from "./machines/diffMachine";
import { createEditorMachineDefinition } from "./machines/editorMachine";
import { createWorkspaceMachineDefinition } from "./machines/workspaceMachine";
import {
  canSaveEditorDocument,
  openEditorDocument,
  saveEditorDocument,
} from "./services/editorService";
import { openWorkspace, sortWorkspaceEntries } from "./services/workspaceService";
import type { EditorDocument } from "./types/editor";
import type { WorkspaceSnapshot } from "./types/workspace";

/**
 * @GOV
 * codes: BR-SYS-GOV-001-RB-SYS-WS-OPEN-001,
 *        BR-CORE-GOV-001-RB-SYS-WS-OPEN-001
 * type: RB
 * chain: WS-OPEN, ED-OPEN-FILE, AG-SEND-MESSAGE, DE-CREATE-DIFF
 * rules: BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=registered machine definitions | out=application shell sections | delegate=workspaceMachine,editorMachine,agentMachine,diffMachine
 */
export default function App() {
  const [workspaceSnapshot, setWorkspaceSnapshot] =
    useState<WorkspaceSnapshot | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditorDocument | null>(
    null,
  );
  const [editorError, setEditorError] = useState<string | null>(null);
  const machines = [
    createWorkspaceMachineDefinition(),
    createEditorMachineDefinition(),
    createAgentMachineDefinition(),
    createDiffMachineDefinition(),
  ];

  async function handleOpenWorkspace() {
    setWorkspaceError(null);
    try {
      const result = await openWorkspace();
      if (!result.cancelled && result.snapshot) {
        setWorkspaceSnapshot({
          ...result.snapshot,
          entries: sortWorkspaceEntries(result.snapshot.entries),
        });
        setEditorDocument(null);
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleOpenFile(relativePath: string) {
    if (!workspaceSnapshot) return;
    setEditorError(null);
    try {
      setEditorDocument(
        await openEditorDocument({
          workspaceRoot: workspaceSnapshot.workspace.rootPath,
          relativePath,
        }),
      );
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveFile() {
    if (!editorDocument) return;
    setEditorError(null);
    try {
      setEditorDocument(await saveEditorDocument(editorDocument));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="app-shell">
      <aside className="panel">
        <h1>Binder Mini</h1>
        <button className="primary-action" type="button" onClick={handleOpenWorkspace}>
          Open Workspace
        </button>
        {workspaceSnapshot ? (
          <div className="workspace-summary">
            <strong>{workspaceSnapshot.workspace.displayName}</strong>
            <span>{workspaceSnapshot.workspace.rootPath}</span>
          </div>
        ) : (
          <p className="muted">No workspace open</p>
        )}
        {workspaceError ? <p className="error-text">{workspaceError}</p> : null}
        <ul className="file-list">
          {workspaceSnapshot?.entries.map((entry) => (
            <li key={entry.relativePath}>
              <span aria-hidden="true">{entry.kind === "directory" ? "dir" : "file"}</span>
              {entry.kind === "file" ? (
                <button
                  className="file-button"
                  type="button"
                  onClick={() => void handleOpenFile(entry.relativePath)}
                >
                  {entry.name}
                </button>
              ) : (
                <span>{entry.name}</span>
              )}
            </li>
          ))}
        </ul>
      </aside>
      <section className="editor-surface">
        <div className="editor-toolbar">
          <div>
            <strong>{editorDocument?.filePath ?? "Editor"}</strong>
            {editorDocument ? <span>{editorDocument.mode}</span> : null}
          </div>
          <button
            className="primary-action"
            type="button"
            disabled={!editorDocument || !canSaveEditorDocument(editorDocument)}
            onClick={() => void handleSaveFile()}
          >
            Save
          </button>
        </div>
        {editorError ? <p className="error-text">{editorError}</p> : null}
        {editorDocument ? (
          <textarea
            className="editor-textarea"
            readOnly={editorDocument.mode === "readonly"}
            value={editorDocument.content}
            onChange={(event) =>
              setEditorDocument({
                ...editorDocument,
                content: event.target.value,
                dirty: true,
              })
            }
          />
        ) : (
          <p className="muted">Open a file from the Workspace.</p>
        )}
      </section>
      <aside className="panel">
        <p>Agent</p>
        <small>{machines.length} state machines registered</small>
      </aside>
    </main>
  );
}
