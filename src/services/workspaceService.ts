import type { Workspace, WorkspaceFileTarget, WorkspaceSnapshot } from "../types/workspace";
import type { RecentWorkspace, WorkspaceEntry, WorkspaceOpenResult } from "../types/workspace";
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
 *        BR-WS-STATE-002-QUERY-WS-WS-OPEN-006,
 *        BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-006,
 *        BR-WS-DATA-001-QUERY-WS-WS-FILE-MANAGE-006,
 *        BR-CORE-GOV-001-QUERY-WS-WS-OPEN-006
 * type: QUERY
 * chain: WS-OPEN, WS-FILE-MANAGE
 * rules: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-PERSIST-001, BR-WS-DATA-001, BR-CORE-GOV-001
 * boundary: in=Workspace open request | out=initialized Workspace snapshot and recent Workspace list returned by Tauri command
 * term_ref: TERM-WS-003
 */
export async function openWorkspace(): Promise<WorkspaceOpenResult> {
  return invoke<WorkspaceOpenResult>("open_workspace");
}

/**
 * @GOV
 * codes: BR-WS-PERSIST-001-QUERY-WS-WS-OPEN-008,
 *        BR-CORE-GOV-001-QUERY-WS-WS-OPEN-008
 * type: QUERY
 * chain: WS-OPEN
 * rules: BR-WS-PERSIST-001, BR-CORE-GOV-001
 * boundary: in=user-level app data store | out=deduplicated recent Workspace list
 * term_ref: TERM-WS-003
 */
export async function listRecentWorkspaces(): Promise<RecentWorkspace[]> {
  return invoke<RecentWorkspace[]>("list_recent_workspaces");
}

/**
 * @GOV
 * codes: BR-WS-PERSIST-001-DATA-WS-WS-OPEN-009,
 *        BR-CORE-GOV-001-DATA-WS-WS-OPEN-009
 * type: DATA
 * chain: WS-OPEN
 * rules: BR-WS-PERSIST-001, BR-CORE-GOV-001
 * boundary: in=recent Workspace records | out=deduplicated recent Workspace records sorted by lastOpenedAt
 * term_ref: TERM-WS-003
 */
export function normalizeRecentWorkspaces(workspaces: RecentWorkspace[]): RecentWorkspace[] {
  const byRoot = new Map<string, RecentWorkspace>();
  for (const workspace of workspaces) {
    const existing = byRoot.get(workspace.rootPath);
    if (!existing || workspace.lastOpenedAt > existing.lastOpenedAt) {
      byRoot.set(workspace.rootPath, workspace);
    }
  }
  return [...byRoot.values()]
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, 10);
}

/**
 * @GOV
 * codes: BR-WS-STATE-002-GUARD-WS-WS-OPEN-007,
 *        BR-CORE-GOV-001-GUARD-WS-WS-OPEN-007
 * type: GUARD
 * chain: WS-OPEN
 * rules: BR-WS-STATE-002, BR-CORE-GOV-001
 * boundary: in=Workspace snapshot metadata | out=boolean indicating initialized WorkspaceDatabase
 * term_ref: TERM-WS-002
 */
export function isWorkspaceSnapshotInitialized(snapshot: WorkspaceSnapshot): boolean {
  return (
    snapshot.workspace.status === "active" &&
    snapshot.metadata.workspaceDatabaseInitialized &&
    snapshot.metadata.workspaceDatabasePath.endsWith(".binder/workspace.db")
  );
}

/**
 * @GOV
 * codes: BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-007,
 *        BR-CORE-GOV-001-DATA-WS-WS-FILE-MANAGE-007
 * type: DATA
 * chain: WS-FILE-MANAGE
 * rules: BR-WS-DATA-002, BR-CORE-GOV-001
 * boundary: in=recursive FileNode list | out=stable sorted recursive FileNode list
 * term_ref: TERM-WS-001
 */
export function sortWorkspaceEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name);
  }).map((entry) => {
    if (!entry.children) return { ...entry };
    return { ...entry, children: sortWorkspaceEntries(entry.children) };
  });
}
