import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { chatMachine } from "../src/machines/chatMachine";
import { diffMachine } from "../src/machines/diffMachine";
import { editorMachine } from "../src/machines/editorMachine";

/**
 * Phase 2 UI governance verification.
 * covers: BR-SYS-UI-001, BR-SYS-UI-002, BR-AG-UI-001, BR-DE-UI-001, BR-DE-UI-002, BR-ED-STATE-006
 */

describe("Phase 2 UI governance", () => {
  // covers: BR-SYS-UI-001
  it("index.css declares all 12 base tokens and 7 diff tokens", () => {
    const css = readFileSync(resolve(__dirname, "../src/index.css"), "utf8");

    const baseTokens = [
      "--bg-base", "--bg-panel", "--bg-elevated", "--bg-hover",
      "--border",
      "--text-primary", "--text-secondary", "--text-muted",
      "--accent", "--danger", "--success", "--warning",
    ];
    for (const token of baseTokens) {
      expect(css, `Missing base token: ${token}`).toContain(token);
    }

    const diffTokens = [
      "--diff-add-bg", "--diff-del-bg", "--diff-pending-border",
      "--diff-accepted-bg", "--diff-rejected-bg", "--diff-expired-bg",
      "--diff-error-bg",
    ];
    for (const token of diffTokens) {
      expect(css, `Missing diff token: ${token}`).toContain(token);
    }
  });

  // covers: BR-SYS-UI-002
  it("MainLayout localStorage keys are declared in source", () => {
    const src = readFileSync(resolve(__dirname, "../src/components/MainLayout.tsx"), "utf8");
    expect(src).toContain("binder-panel-left-width");
    expect(src).toContain("binder-panel-right-width");
    // Panel bounds: LEFT 180–480, RIGHT 260–600
    expect(src).toContain("180");
    expect(src).toContain("480");
    expect(src).toContain("260");
    expect(src).toContain("600");
  });

  // covers: BR-AG-UI-001
  it("chatMachine reaches toolCalling from streaming on TOOL_REQUESTED", () => {
    const actor = createActor(chatMachine).start();
    actor.send({ type: "WORKSPACE_OPENED", workspaceRoot: "/tmp/ws" });
    expect(actor.getSnapshot().value).toBe("ready");

    actor.send({ type: "SEND_MESSAGE", userContent: "hello", inputReferences: [], activeFilePath: null });
    expect(actor.getSnapshot().value).toBe("validatingProvider");

    actor.send({ type: "PROVIDER_VALID" });
    expect(actor.getSnapshot().value).toBe("sending");

    actor.send({ type: "STREAM_STARTED" });
    expect(actor.getSnapshot().value).toBe("streaming");

    // BR-AG-UI-001: cancel button must be shown in toolCalling
    actor.send({ type: "TOOL_REQUESTED", execution: { id: "t1", toolName: "read_file", input: {} } });
    expect(actor.getSnapshot().value).toBe("toolCalling");

    actor.send({ type: "CANCEL" });
    expect(actor.getSnapshot().value).toBe("cancelling");
  });

  // covers: BR-DE-UI-001
  it("diffMachine covers all 8 PendingDiffStatus states", () => {
    // Phase 6-A: 8 true states — no "none" placeholder, no "terminal" catch-all;
    // final states are: accepted, rejected, expired, error (TERM-DE-009)
    const EXPECTED_STATUSES = [
      "pending", "preapplied", "accepting",
      "rejecting", "accepted", "rejected", "expired", "error",
    ];
    const machine = diffMachine;
    const stateKeys = Object.keys(machine.config.states ?? {});
    for (const s of EXPECTED_STATUSES) {
      expect(stateKeys, `diffMachine missing state: ${s}`).toContain(s);
    }

    // Verify state transitions drive DiffCard visual props
    // Machine starts at "pending" (creating the actor IS the DIFF_CREATED action)
    const actor = createActor(diffMachine).start();
    expect(actor.getSnapshot().value).toBe("pending");
    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    expect(actor.getSnapshot().value).toBe("preapplied");
    actor.send({ type: "REJECT_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("rejecting");
    actor.send({ type: "TERMINAL_RECORDED" });
    // "terminal" renamed to "rejected" (Phase 6-A; TERM-DE-002)
    expect(actor.getSnapshot().value).toBe("rejected");
  });

  // covers: BR-DE-UI-002
  it("EditorArea source does not contain red deletion class or --diff-del-bg", () => {
    const src = readFileSync(resolve(__dirname, "../src/components/EditorArea.tsx"), "utf8");
    expect(src).not.toContain("--diff-del-bg");
    expect(src).not.toContain("diff-del");
    // GreenAdditionDecoration placeholder exists
    expect(src).toContain("GreenAdditionDecoration");
    expect(src).toContain("--diff-add-bg");
  });

  // covers: BR-DE-UI-002
  it("DiffCard source contains --diff-del-bg and red deletion text", () => {
    const src = readFileSync(resolve(__dirname, "../src/components/DiffCard.tsx"), "utf8");
    expect(src).toContain("--diff-del-bg");
    expect(src).toContain("--danger");
  });

  // covers: BR-DE-UI-003
  it("DiffActionBar is hidden when nonTerminalCount=0; visible when ≥1 (source check)", () => {
    const src = readFileSync(resolve(__dirname, "../src/components/DiffActionBar.tsx"), "utf8");
    // BR-DE-UI-003: batch-accept/reject bar visible only when pending/preapplied diffs exist
    expect(src).toContain("nonTerminalCount === 0");
    expect(src).toContain("return null");
    expect(src).toContain("onAcceptAll");
    expect(src).toContain("onRejectAll");
  });

  // covers: BR-ED-STATE-006
  it("editorMachine has all states mapped by EditorArea", () => {
    const EDITOR_STATES = ["noWorkspace", "idle", "loading", "editing", "dirty", "saving", "readonly", "error"];
    const stateKeys = Object.keys(editorMachine.config.states ?? {});
    for (const s of EDITOR_STATES) {
      expect(stateKeys, `editorMachine missing state: ${s}`).toContain(s);
    }

    const editorAreaSrc = readFileSync(resolve(__dirname, "../src/components/EditorArea.tsx"), "utf8");
    for (const s of EDITOR_STATES) {
      expect(editorAreaSrc, `EditorArea does not handle state: ${s}`).toContain(`"${s}"`);
    }
  });
});
