import { describe, expect, it } from "vitest";
import {
  canChangeWorkspace,
  isWorkspaceSnapshotInitialized,
  isWorkspaceTarget,
  isPathConflict,
  normalizeRecentWorkspaces,
  sortWorkspaceEntries,
} from "../src/services/workspaceService";

describe("Workspace MVP service behavior", () => {
  // covers: BR-WS-STATE-001
  it("sorts Workspace entries with directories first", () => {
    expect(
      sortWorkspaceEntries([
        { name: "z.md", relativePath: "z.md", kind: "file" },
        { name: "docs", relativePath: "docs", kind: "directory" },
        { name: "a.md", relativePath: "a.md", kind: "file" },
      ]),
    ).toEqual([
      { name: "docs", relativePath: "docs", kind: "directory" },
      { name: "a.md", relativePath: "a.md", kind: "file" },
      { name: "z.md", relativePath: "z.md", kind: "file" },
    ]);
  });

  // covers: BR-WS-DATA-002
  it("sorts recursive FileNode children without flattening directories", () => {
    expect(
      sortWorkspaceEntries([
        { name: "z.md", relativePath: "z.md", kind: "file" },
        {
          name: "docs",
          relativePath: "docs",
          kind: "directory",
          children: [
            { name: "z.md", relativePath: "docs/z.md", kind: "file" },
            { name: "a.md", relativePath: "docs/a.md", kind: "file" },
          ],
        },
      ]),
    ).toEqual([
      {
        name: "docs",
        relativePath: "docs",
        kind: "directory",
        children: [
          { name: "a.md", relativePath: "docs/a.md", kind: "file" },
          { name: "z.md", relativePath: "docs/z.md", kind: "file" },
        ],
      },
      { name: "z.md", relativePath: "z.md", kind: "file" },
    ]);
  });

  // covers: BR-WS-STATE-002
  it("requires Workspace database metadata before treating a snapshot as initialized", () => {
    expect(
      isWorkspaceSnapshotInitialized({
        workspace: {
          rootPath: "/tmp/workspace",
          displayName: "workspace",
          status: "active",
        },
        entries: [],
        metadata: {
          workspaceDatabasePath: "/tmp/workspace/.binder/workspace.db",
          workspaceDatabaseInitialized: true,
        },
      }),
    ).toBe(true);

    expect(
      isWorkspaceSnapshotInitialized({
        workspace: {
          rootPath: "/tmp/workspace",
          displayName: "workspace",
          status: "active",
        },
        entries: [],
        metadata: {
          workspaceDatabasePath: "/tmp/workspace/.binder/workspace.db",
          workspaceDatabaseInitialized: false,
        },
      }),
    ).toBe(false);
  });

  // covers: BR-WS-PERSIST-001
  it("deduplicates recent Workspaces by root path and keeps newest first", () => {
    expect(
      normalizeRecentWorkspaces([
        { rootPath: "/tmp/a", displayName: "old-a", lastOpenedAt: 1 },
        { rootPath: "/tmp/b", displayName: "b", lastOpenedAt: 2 },
        { rootPath: "/tmp/a", displayName: "new-a", lastOpenedAt: 3 },
      ]),
    ).toEqual([
      { rootPath: "/tmp/a", displayName: "new-a", lastOpenedAt: 3 },
      { rootPath: "/tmp/b", displayName: "b", lastOpenedAt: 2 },
    ]);
  });

  // covers: BR-WS-DATA-003
  // covers: BR-WS-DATA-004
  it("recognizes PathConflict mutation results without treating them as success", () => {
    const result = {
      success: false,
      entries: [],
      conflict: {
        code: "PATH_CONFLICT" as const,
        targetPath: "notes.md",
        existingKind: "file" as const,
        message: "Target path already exists: notes.md",
      },
    };

    expect(isPathConflict(result)).toBe(true);
  });

  // covers: BR-WS-DATA-003
  it("keeps mutation success results distinguishable from PathConflict", () => {
    expect(isPathConflict({ success: true, entries: [] })).toBe(false);
  });

  // covers: BR-WS-STATE-003
  it("blocks Workspace close or switch while dirty editor or pending diff exists", () => {
    expect(canChangeWorkspace({ editorDirty: false, hasPendingDiff: false })).toBe(true);
    expect(canChangeWorkspace({ editorDirty: true, hasPendingDiff: false })).toBe(false);
    expect(canChangeWorkspace({ editorDirty: false, hasPendingDiff: true })).toBe(false);
  });

  // covers: BR-WS-DATA-001
  it("rejects file targets outside the active Workspace boundary", () => {
    const workspace = {
      rootPath: "/tmp/workspace",
      displayName: "workspace",
      status: "active" as const,
    };

    expect(
      isWorkspaceTarget(workspace, {
        workspaceRoot: "/tmp/workspace",
        relativePath: "notes/a.md",
      }),
    ).toBe(true);
    expect(
      isWorkspaceTarget(workspace, {
        workspaceRoot: "/tmp/workspace",
        relativePath: "/tmp/other/a.md",
      }),
    ).toBe(false);
    expect(
      isWorkspaceTarget(workspace, {
        workspaceRoot: "/tmp/other",
        relativePath: "a.md",
      }),
    ).toBe(false);
  });
});
