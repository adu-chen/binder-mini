import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { chatMachine } from "../src/machines/chatMachine";
import { diffMachine } from "../src/machines/diffMachine";
import { editorMachine } from "../src/machines/editorMachine";
import { workspaceMachine } from "../src/machines/workspaceMachine";
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
  // covers: BR-WS-DATA-005
  it("keeps Workspace targets inside the active Workspace", () => {
    const workspace = { rootPath: "/tmp/ws", displayName: "ws", status: "active" as const };
    expect(isWorkspaceTarget(workspace, { workspaceRoot: "/tmp/ws", relativePath: "a.md" })).toBe(true);
    expect(isWorkspaceTarget(workspace, { workspaceRoot: "/tmp/ws", relativePath: "../a.md" })).toBe(false);

    const wsActor = createActor(workspaceMachine).start();
    expect(wsActor.getSnapshot().value).toBe("NoWorkspace");
    wsActor.send({ type: "OPEN_WORKSPACE", workspaceRoot: "/tmp/ws" });
    expect(wsActor.getSnapshot().value).toBe("Loading");

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
  // covers: BR-ED-STATE-002
  // covers: BR-ED-STATE-003
  // covers: BR-ED-STATE-004
  // covers: BR-ED-PERSIST-001
  it("keeps Editor save readiness tied to editable dirty documents", () => {
    expect(canSaveEditorDocument({ workspaceRoot: "/tmp/ws", filePath: "a.md", content: "x", mode: "editable", dirty: true })).toBe(true);
    expect(canSaveEditorDocument({ workspaceRoot: "/tmp/ws", filePath: "a.bin", content: "x", mode: "readonly", dirty: true })).toBe(false);

    const edActor = createActor(editorMachine).start();
    edActor.send({ type: "WORKSPACE_OPENED", workspaceRoot: "/tmp/ws" });
    expect(edActor.getSnapshot().value).toBe("idle");
    edActor.send({ type: "OPEN_FILE", filePath: "a.bin" });
    expect(edActor.getSnapshot().value).toBe("loading");
    edActor.send({ type: "FILE_LOADED", filePath: "a.bin", fileType: "other", content: "" });
    expect(edActor.getSnapshot().value).toBe("readonly");
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

    const chatActor = createActor(chatMachine).start();
    expect(chatActor.getSnapshot().value).toBe("noWorkspace");
    chatActor.send({ type: "WORKSPACE_OPENED", workspaceRoot: "/tmp/ws" });
    expect(chatActor.getSnapshot().value).toBe("ready");
    chatActor.send({ type: "SEND_MESSAGE", userContent: "hello", inputReferences: [] });
    expect(chatActor.getSnapshot().value).toBe("validatingProvider");
  });

  // covers: BR-DE-STATE-001
  // covers: BR-DE-PERSIST-001
  // covers: BR-DE-STATE-002
  // covers: BR-DE-STATE-003
  // covers: BR-DE-DATA-001
  it("keeps PendingDiff execution and terminal cards explicit", () => {
    // BR-DE-DATA-001: required traceable fields included in test literal (Phase 6-A upgrade)
    expect(canExecutePendingDiff({
      id: "d1", filePath: "a.md", originalText: "a", newText: "b",
      status: "pending", summary: "change",
      sourceToolId: "tool-1", baseRevision: "abc123", createdAt: 0, effectivePath: "open-file",
    })).toBe(true);
    expect(createTerminalDiffCard("d1", "accepted").status).toBe("accepted");

    // Phase 6-A: diffMachine initial state is "pending" (no "none" state; machine creation = DIFF_CREATED)
    const diffActor = createActor(diffMachine).start();
    expect(diffActor.getSnapshot().value).toBe("pending");
    diffActor.send({ type: "ACCEPT_REQUESTED" });
    expect(diffActor.getSnapshot().value).toBe("accepting");
  });

  // covers: BR-SYS-GOV-001
  // covers: BR-CORE-GOV-001
  it("keeps core chains represented by machine definitions", () => {
    expect(workspaceMachine.id).toBe("workspaceMachine");
    expect(editorMachine.id).toBe("editorMachine");
    expect(chatMachine.id).toBe("chatMachine");
    expect(diffMachine.id).toBe("diffMachine");
  });
});
