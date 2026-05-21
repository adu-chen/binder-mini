import { useState } from "react";
import { createAgentMachineDefinition } from "./machines/agentMachine";
import { createDiffMachineDefinition } from "./machines/diffMachine";
import { createEditorMachineDefinition } from "./machines/editorMachine";
import { createWorkspaceMachineDefinition } from "./machines/workspaceMachine";
import { openWorkspace, sortWorkspaceEntries } from "./services/workspaceService";
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
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
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
              <span>{entry.name}</span>
            </li>
          ))}
        </ul>
      </aside>
      <section className="editor-surface">
        <p>Editor</p>
      </section>
      <aside className="panel">
        <p>Agent</p>
        <small>{machines.length} state machines registered</small>
      </aside>
    </main>
  );
}
