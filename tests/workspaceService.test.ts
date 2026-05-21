import { describe, expect, it } from "vitest";
import {
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
