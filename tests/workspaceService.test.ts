import { describe, expect, it } from "vitest";
import {
  isWorkspaceSnapshotInitialized,
  isWorkspaceTarget,
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
