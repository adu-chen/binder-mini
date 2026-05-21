import type { Workspace, WorkspaceFileTarget } from "../types/workspace";
import type { WorkspaceEntry, WorkspaceOpenResult } from "../types/workspace";
import { invoke } from "@tauri-apps/api/core";

/**
 * @GOV
 * codes: BR-WS-STATE-001-GUARD-WS-WS-OPEN-005,
 *        BR-WS-DATA-001-GUARD-WS-WS-FILE-MANAGE-003,
 *        BR-CORE-GOV-001-GUARD-WS-WS-FILE-MANAGE-004
 * type: GUARD
 * chain: WS-OPEN, WS-FILE-MANAGE
 * rules: BR-WS-STATE-001, BR-WS-DATA-001, BR-CORE-GOV-001
 * boundary: in=Workspace and WorkspaceFileTarget | out=boolean（true 当 file target remains inside Workspace）
 * term_ref: TERM-CORE-001
 */
export function isWorkspaceTarget(
  workspace: Workspace,
  target: WorkspaceFileTarget,
): boolean {
  return (
    workspace.status === "active" &&
    target.workspaceRoot === workspace.rootPath &&
    !target.relativePath.startsWith("../") &&
    !target.relativePath.startsWith("/")
  );
}

/**
 * @GOV
 * codes: BR-WS-STATE-001-QUERY-WS-WS-OPEN-006,
 *        BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006,
 *        BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006
 * type: QUERY
 * chain: WS-OPEN, WS-FILE-MANAGE
 * rules: BR-WS-STATE-001, BR-WS-DATA-001, BR-CORE-GOV-001
 * boundary: in=Workspace open request | out=Workspace snapshot returned by Tauri command
 * term_ref: TERM-CORE-001
 */
export async function openWorkspace(): Promise<WorkspaceOpenResult> {
  return invoke<WorkspaceOpenResult>("open_workspace");
}

export function sortWorkspaceEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}
