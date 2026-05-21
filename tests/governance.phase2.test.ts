import { describe, expect, it } from "vitest";
import { createAgentMachineDefinition } from "../src/machines/agentMachine";
import { createDiffMachineDefinition } from "../src/machines/diffMachine";
import { createEditorMachineDefinition } from "../src/machines/editorMachine";
import { createWorkspaceMachineDefinition } from "../src/machines/workspaceMachine";
import {
  canRecordAgentMessage,
  canSendAgentMessage,
  createPendingToolExecution,
  isReadonlyInputReference,
} from "../src/services/agentService";
import { canExecutePendingDiff, createTerminalDiffCard } from "../src/services/diffService";
import { canSaveEditorDocument } from "../src/services/editorService";
import { canChangeWorkspace, isPathConflict, isWorkspaceSnapshotInitialized, isWorkspaceTarget, normalizeRecentWorkspaces } from "../src/services/workspaceService";

describe("Phase 2 governance skeleton", () => {
  // covers: BR-WS-STATE-001
  // covers: BR-WS-STATE-002
  // covers: BR-WS-STATE-003
  // covers: BR-WS-PERSIST-001
  // covers: BR-WS-DATA-001
  // covers: BR-WS-DATA-002
  // covers: BR-WS-DATA-003
  // covers: BR-WS-DATA-004
  it("keeps Workspace targets inside the active Workspace", () => {
    const workspace = { rootPath: "/tmp/ws", displayName: "ws", status: "active" as const };
    expect(isWorkspaceTarget(workspace, { workspaceRoot: "/tmp/ws", relativePath: "a.md" })).toBe(true);
    expect(isWorkspaceTarget(workspace, { workspaceRoot: "/tmp/ws", relativePath: "../a.md" })).toBe(false);
    expect(createWorkspaceMachineDefinition().initial).toBe("noWorkspace");
    expect(isWorkspaceSnapshotInitialized({
      workspace,
      entries: [{ name: "docs", relativePath: "docs", kind: "directory", children: [] }],
      metadata: {
        workspaceDatabasePath: "/tmp/ws/.binder/workspace.db",
        workspaceDatabaseInitialized: true,
      },
    })).toBe(true);
    expect(normalizeRecentWorkspaces([
      { rootPath: "/tmp/ws", displayName: "ws", lastOpenedAt: 1 },
      { rootPath: "/tmp/ws", displayName: "ws", lastOpenedAt: 2 },
    ])).toEqual([{ rootPath: "/tmp/ws", displayName: "ws", lastOpenedAt: 2 }]);
    expect(isPathConflict({
      success: false,
      entries: [],
      conflict: {
        code: "PATH_CONFLICT",
        targetPath: "a.md",
        existingKind: "file",
        message: "Target path already exists: a.md",
      },
    })).toBe(true);
    expect(canChangeWorkspace({ editorDirty: false, hasPendingDiff: false })).toBe(true);
    expect(canChangeWorkspace({ editorDirty: true, hasPendingDiff: false })).toBe(false);
  });

  // covers: BR-ED-STATE-001
  // covers: BR-ED-PERSIST-001
  it("keeps Editor save readiness tied to editable dirty documents", () => {
    expect(canSaveEditorDocument({ workspaceRoot: "/tmp/ws", filePath: "a.md", content: "x", mode: "editable", dirty: true })).toBe(true);
    expect(canSaveEditorDocument({ workspaceRoot: "/tmp/ws", filePath: "a.bin", content: "x", mode: "readonly", dirty: true })).toBe(false);
    expect(createEditorMachineDefinition().states.loading.LOAD_READONLY).toBe("readonly");
  });

  // covers: BR-AG-STATE-001
  // covers: BR-AG-OBS-001
  // covers: BR-AG-DATA-001
  it("keeps Agent requests behind provider validation and readonly InputReference", () => {
    expect(canSendAgentMessage({ provider: "openai", model: "gpt", apiKeyConfigured: true })).toBe(true);
    expect(canSendAgentMessage({ provider: "openai", model: "", apiKeyConfigured: true })).toBe(false);
    expect(canRecordAgentMessage("inspect workspace")).toBe(true);
    expect(isReadonlyInputReference({ id: "r1", mode: "readonly", target: { workspaceRoot: "/tmp/ws", relativePath: "a.md" } })).toBe(true);
    expect(createPendingToolExecution("read_file").status).toBe("pending");
    expect(createAgentMachineDefinition().states.idle.SEND_REQUESTED).toBe("validatingProvider");
  });

  // covers: BR-DE-STATE-001
  // covers: BR-DE-PERSIST-001
  // covers: BR-DE-STATE-002
  // covers: BR-DE-STATE-003
  it("keeps PendingDiff execution and terminal cards explicit", () => {
    expect(canExecutePendingDiff({ id: "d1", filePath: "a.md", originalText: "a", proposedText: "b", status: "pending", summary: "change" })).toBe(true);
    expect(createTerminalDiffCard("d1", "accepted").status).toBe("accepted");
    expect(createDiffMachineDefinition().states.pending.ACCEPT_REQUESTED).toBe("accepting");
  });

  // covers: BR-SYS-GOV-001
  // covers: BR-CORE-GOV-001
  it("keeps core chains represented by machine definitions", () => {
    expect(createWorkspaceMachineDefinition().id).toBe("workspaceMachine");
    expect(createEditorMachineDefinition().id).toBe("editorMachine");
    expect(createAgentMachineDefinition().id).toBe("agentMachine");
    expect(createDiffMachineDefinition().id).toBe("diffMachine");
  });
});
