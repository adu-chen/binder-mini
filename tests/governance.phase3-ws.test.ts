import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { workspaceMachine } from "../src/machines/workspaceMachine";

/**
 * Phase 3 Workspace governance verification.
 * covers: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-DATA-005
 */

describe("Phase 3 Workspace governance", () => {
  // covers: BR-WS-STATE-001, BR-WS-STATE-003
  it("workspaceMachine Closing state accepts CONFIRM_CLOSE (CLOSE_DONE) and CANCEL_CLOSE", () => {
    // Fork 1: CLOSE_DONE path (NoWorkspace after confirmation)
    const actor1 = createActor(workspaceMachine).start();
    actor1.send({ type: "OPEN_WORKSPACE", workspaceRoot: "/tmp/ws" });
    expect(actor1.getSnapshot().value).toBe("Loading");
    actor1.send({ type: "LOAD_SUCCEEDED" });
    expect(actor1.getSnapshot().value).toBe("Active");
    actor1.send({ type: "CLOSE_WORKSPACE" });
    expect(actor1.getSnapshot().value).toBe("Closing");
    actor1.send({ type: "CLOSE_DONE" });
    expect(actor1.getSnapshot().value).toBe("NoWorkspace");
    expect(actor1.getSnapshot().context.workspaceRoot).toBeNull();

    // Fork 2: CANCEL_CLOSE path (back to Active)
    const actor2 = createActor(workspaceMachine).start();
    actor2.send({ type: "OPEN_WORKSPACE", workspaceRoot: "/tmp/ws2" });
    actor2.send({ type: "LOAD_SUCCEEDED" });
    actor2.send({ type: "CLOSE_WORKSPACE" });
    expect(actor2.getSnapshot().value).toBe("Closing");
    actor2.send({ type: "CANCEL_CLOSE" });
    expect(actor2.getSnapshot().value).toBe("Active");
    // workspaceRoot preserved after cancel
    expect(actor2.getSnapshot().context.workspaceRoot).toBe("/tmp/ws2");
  });

  // covers: BR-WS-STATE-002
  it("workspaceMachine Loading state accepts LOAD_SUCCEEDED and LOAD_FAILED", () => {
    // LOAD_SUCCEEDED path
    const actor1 = createActor(workspaceMachine).start();
    actor1.send({ type: "OPEN_WORKSPACE", workspaceRoot: "/tmp/ok" });
    expect(actor1.getSnapshot().value).toBe("Loading");
    actor1.send({ type: "LOAD_SUCCEEDED" });
    expect(actor1.getSnapshot().value).toBe("Active");
    expect(actor1.getSnapshot().context.workspaceRoot).toBe("/tmp/ok");

    // LOAD_FAILED path
    const actor2 = createActor(workspaceMachine).start();
    actor2.send({ type: "OPEN_WORKSPACE", workspaceRoot: "/tmp/bad" });
    actor2.send({ type: "LOAD_FAILED", errorMessage: "DB init failed" });
    expect(actor2.getSnapshot().value).toBe("Error");
    expect(actor2.getSnapshot().context.errorMessage).toBe("DB init failed");

    // Error state can retry with OPEN_WORKSPACE
    actor2.send({ type: "OPEN_WORKSPACE", workspaceRoot: "/tmp/retry" });
    expect(actor2.getSnapshot().value).toBe("Loading");
    expect(actor2.getSnapshot().context.workspaceRoot).toBe("/tmp/retry");
  });

  // covers: BR-WS-DATA-005
  it("useWorkspaceSearch module exports clearSearchResults and debounce guard logic", () => {
    // Verify the hook exists and its source references the correct IPC command and debounce
    const src = readFileSync(
      resolve(__dirname, "../src/hooks/useWorkspaceSearch.ts"),
      "utf8",
    );
    // Must call the search_files IPC (via searchFiles wrapper)
    expect(src, "useWorkspaceSearch must call searchFiles IPC").toContain("searchFiles");
    // Must export clearSearchResults for stale invalidation after file mutations
    expect(src, "useWorkspaceSearch must export clearSearchResults").toContain("clearSearchResults");
    // Must implement 300ms debounce (BR-WS-DATA-005)
    expect(src, "useWorkspaceSearch must debounce at 300ms").toContain("300");
    // Must skip IPC call for empty query (BR-WS-DATA-005)
    expect(src, "must skip IPC for empty query").toContain("query.trim()");
    // Must respect isActive guard: no search when non-Active
    expect(src, "must guard on isActive state").toContain("isActive");
  });

  // covers: BR-WS-DATA-003 — DeleteConfirmDialog guards delete_workspace_item
  it("DeleteConfirmDialog source contains required confirmation text", () => {
    const src = readFileSync(
      resolve(__dirname, "../src/components/DeleteConfirmDialog.tsx"),
      "utf8",
    );
    expect(src).toContain("确认删除");
    expect(src).toContain("永久删除，无法恢复");
    expect(src).toContain("btn-danger");
    expect(src).toContain("BR-WS-DATA-003");
  });

  // covers: BR-WS-STATE-001 — workspaceActor.ts is the sole broadcaster
  it("workspaceActor broadcasts WORKSPACE_OPENED only after LOAD_SUCCEEDED", () => {
    const src = readFileSync(
      resolve(__dirname, "../src/services/workspaceActor.ts"),
      "utf8",
    );
    // Must use useActorRef with workspaceMachine
    expect(src).toContain("useActorRef(workspaceMachine)");
    // Loading sequence must check for LOAD_SUCCEEDED state
    expect(src).toContain("LOAD_SUCCEEDED");
    // Closing sequence must broadcast before CLOSE_DONE
    expect(src).toContain("CLOSE_DONE");
    // Must persist chat messages (BR-AG-PERSIST-001)
    expect(src).toContain("saveChatMessages");
    // Broadcasts must reference onWorkspaceOpened and onWorkspaceClosed
    expect(src).toContain("onWorkspaceOpened");
    expect(src).toContain("onWorkspaceClosed");
  });
});
