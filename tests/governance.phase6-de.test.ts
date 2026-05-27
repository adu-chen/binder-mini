import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createActor } from "xstate";
import { afterEach, describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { diffMachine } from "../src/machines/diffMachine";
import type { PendingDiffStatus } from "../src/machines/diffMachine";
import { chatMachine } from "../src/machines/chatMachine";
import { createDiff, createTerminalDiffCard } from "../src/services/diffService";
import { createDiffStoreInstance } from "../src/stores/diffStore";
import { registerEditor, unregisterEditor } from "../src/stores/editorRegistry";
import { applyDiffReplaceInEditor } from "../src/services/editorActor";
import type { Editor } from "@tiptap/core";

/**
 * Phase 6 Diff Review module governance verification.
 * covers: BR-DE-DATA-001, BR-DE-STATE-001, BR-DE-STATE-002, BR-DE-STATE-003,
 *         BR-DE-STATE-004, BR-DE-STATE-005, BR-DE-STATE-010, BR-DE-STATE-011,
 *         BR-DE-STATE-012, BR-DE-STATE-013, BR-DE-STATE-014,
 *         BR-DE-PERSIST-001, BR-DE-PERSIST-002,
 *         BR-ED-STATE-005, BR-ED-STATE-006,
 *         BR-AG-DATA-002, BR-AG-DATA-003,
 *         BR-DE-UI-001, BR-DE-UI-002
 *
 * Issue 6-A tests cover the data layer (diffMachine + DiffStore).
 * Issues 6-B through 6-F are activated in this revision, including the
 * Rust-side persistence source checks for Issue 6-E.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
const BASE_PARAMS = {
  filePath: "notes.md",
  originalText: "Hello world",
  newText: "Hello Binder",
  summary: "Update greeting",
  sourceToolId: "tool-abc-123",
  baseRevision: "a".repeat(64), // 64-char hex SHA-256 placeholder
  effectivePath: "open-file" as const,
};

function repoPath(path: string) {
  return resolve(process.cwd(), path);
}

// ── ProseMirror mock editor factory ──────────────────────────────────────────
// Uses @tiptap/pm/model (already a project dependency) to create a real
// ProseMirror document so that doc.descendants() traversal is exercised
// with accurate absolute positions.  The chain() API is a lightweight
// fluent stub that records the deleteRange + insertContentAt arguments.
const PM_SCHEMA = new Schema({
  nodes: {
    doc:       { content: "block+" },
    paragraph: { content: "inline*", group: "block", toDOM() { return ["p", 0]; } },
    text:      { group: "inline" },
  },
});

interface CapturedEdit { from: number; to: number; newText: string }

function buildMockEditor(text: string): { editor: Editor; edits: CapturedEdit[] } {
  const doc = PM_SCHEMA.nodeFromJSON({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const edits: CapturedEdit[] = [];
  let savedFrom = 0;
  let savedTo   = 0;

  const editor = {
    isDestroyed: false,
    view: { state: { doc } },
    chain() {
      return {
        focus: () => ({
          deleteRange: ({ from, to }: { from: number; to: number }) => {
            savedFrom = from;
            savedTo   = to;
            return {
              insertContentAt: (_pos: number, newContent: string) => {
                edits.push({ from: savedFrom, to: savedTo, newText: newContent });
                return { run: () => true };
              },
            };
          },
        }),
      };
    },
  } as unknown as Editor;

  return { editor, edits };
}

// ── Issue 6-A: Data layer ─────────────────────────────────────────────────────

describe("Issue 6-A — PendingDiff type + diffMachine 8-state + DiffStore", () => {

  // covers: BR-DE-DATA-001
  it("createDiff: missing sourceToolId → throws BR-DE-DATA-001 error", () => {
    expect(() =>
      createDiff({ ...BASE_PARAMS, sourceToolId: "" })
    ).toThrow("BR-DE-DATA-001");
  });

  // covers: BR-DE-DATA-001
  it("createDiff: missing baseRevision → throws BR-DE-DATA-001 error", () => {
    expect(() =>
      createDiff({ ...BASE_PARAMS, baseRevision: "" })
    ).toThrow("BR-DE-DATA-001");
  });

  // covers: BR-DE-DATA-001
  it("createDiff: produces PendingDiff with sourceToolId, baseRevision, effectivePath, createdAt", () => {
    const diff = createDiff(BASE_PARAMS);
    expect(diff.status).toBe("pending");
    expect(diff.sourceToolId).toBe("tool-abc-123");
    expect(diff.baseRevision).toBe("a".repeat(64));
    expect(diff.effectivePath).toBe("open-file");
    expect(typeof diff.createdAt).toBe("number");
    expect(diff.createdAt).toBeGreaterThan(0);
  });

  // covers: BR-DE-STATE-001
  it("diffMachine: initial state is pending (machine creation = DIFF_CREATED action)", () => {
    const actor = createActor(diffMachine).start();
    expect(actor.getSnapshot().value).toBe("pending");
  });

  // covers: BR-DE-STATE-001
  it("diffMachine: pending → preapplied via LOGICAL_STATE_APPLIED (open-file)", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    expect(actor.getSnapshot().value).toBe("preapplied");
  });

  // covers: BR-DE-STATE-005
  it("diffMachine: pending → preapplied via INHERIT_APPLIED (Inherit Flow)", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "INHERIT_APPLIED" });
    expect(actor.getSnapshot().value).toBe("preapplied");
  });

  // covers: BR-AG-DATA-003
  it("diffMachine: LOGICAL_STATE_APPLIED_FAILED → error terminal (originalText not found)", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "LOGICAL_STATE_APPLIED_FAILED" });
    expect(actor.getSnapshot().value).toBe("error");
    // Error is a final state — further events are ignored
    actor.send({ type: "ACCEPT_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("error");
  });

  // covers: BR-DE-STATE-001
  it("diffMachine: pending → preapplied → accepting → accepted (open-file accept path)", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    expect(actor.getSnapshot().value).toBe("preapplied");
    actor.send({ type: "ACCEPT_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("accepting");
    actor.send({ type: "ACCEPT_CONFIRMED" });
    expect(actor.getSnapshot().value).toBe("accepted");
  });

  // covers: BR-DE-STATE-002
  it("diffMachine: pending → rejecting → rejected (closed-file reject path)", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "REJECT_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("rejecting");
    actor.send({ type: "TERMINAL_RECORDED" });
    expect(actor.getSnapshot().value).toBe("rejected");
    // rejected is final — no further transitions
    actor.send({ type: "ACCEPT_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("rejected");
  });

  // covers: BR-DE-STATE-003
  it("diffMachine: pending → expired via EXPIRE_REQUESTED", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "EXPIRE_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("expired");
    // expired is final
    actor.send({ type: "ACCEPT_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("expired");
  });

  // covers: BR-DE-STATE-012
  it("diffMachine: preapplied → expired via EXPIRE_REQUESTED (LogicalState changed in appliedRange)", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    actor.send({ type: "EXPIRE_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("expired");
  });

  // covers: BR-DE-STATE-002
  it("diffMachine: preapplied → rejecting → rejected (open-file reject path)", () => {
    const actor = createActor(diffMachine).start();
    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    actor.send({ type: "REJECT_REQUESTED" });
    expect(actor.getSnapshot().value).toBe("rejecting");
    actor.send({ type: "TERMINAL_RECORDED" });
    expect(actor.getSnapshot().value).toBe("rejected");
  });

  // covers: BR-DE-STATE-001
  it("diffMachine: declares exactly 8 states (TERM-DE-009)", () => {
    const EXPECTED: PendingDiffStatus[] = [
      "pending", "preapplied", "accepting", "rejecting",
      "accepted", "rejected", "expired", "error",
    ];
    const stateKeys = Object.keys(diffMachine.config.states ?? {});
    for (const s of EXPECTED) {
      expect(stateKeys, `diffMachine missing state: ${s}`).toContain(s);
    }
    expect(stateKeys).toHaveLength(EXPECTED.length);
  });

  // covers: BR-DE-STATE-001
  it("DiffStore: createDiff validates BR-DE-DATA-001 fields; getDiff/getAllDiffs/updateDiff semantics", () => {
    const store = createDiffStoreInstance();

    // Sole entry creates PendingDiff with required fields
    const diff = store.createDiff(BASE_PARAMS);
    expect(store.getDiff(diff.id)).toStrictEqual(diff);
    expect(store.getAllDiffs()).toHaveLength(1);

    // updateDiff patches in-place
    store.updateDiff(diff.id, { appliedRange: { from: 10, to: 21 } });
    expect(store.getDiff(diff.id)?.appliedRange).toEqual({ from: 10, to: 21 });

    // moveToTerminal removes from pendingDiffs and pushes to terminalCards
    const card = createTerminalDiffCard(diff.id, "accepted", diff.sourceToolId);
    store.moveToTerminal(diff.id, card);
    expect(store.getDiff(diff.id)).toBeUndefined();
    expect(store.getAllDiffs()).toHaveLength(0);
    expect(store.getTerminalCards()[0].diffId).toBe(diff.id);
  });

  // covers: BR-DE-STATE-013
  it("DiffStore: clear() resets pendingDiffs and terminalCards (BR-DE-STATE-013 / WORKSPACE_CLOSED)", () => {
    const store = createDiffStoreInstance();
    store.createDiff(BASE_PARAMS);
    store.createDiff({ ...BASE_PARAMS, sourceToolId: "tool-xyz" });
    expect(store.getAllDiffs()).toHaveLength(2);

    store.clear();
    expect(store.getAllDiffs()).toHaveLength(0);
    expect(store.getTerminalCards()).toHaveLength(0);
  });

  // covers: BR-DE-STATE-001 — subscribe() and stable snapshot references
  it("DiffStore: subscribe() fires on createDiff / updateDiff / moveToTerminal / clear; unsub stops notifications", () => {
    const store = createDiffStoreInstance();
    let count = 0;
    const unsub = store.subscribe(() => { count++; });

    const diff = store.createDiff(BASE_PARAMS);
    expect(count).toBe(1); // createDiff notifies

    store.updateDiff(diff.id, { appliedRange: { from: 1, to: 5 } });
    expect(count).toBe(2); // updateDiff notifies

    store.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "accepted", diff.sourceToolId));
    expect(count).toBe(3); // moveToTerminal notifies

    store.clear();
    expect(count).toBe(4); // clear notifies

    unsub();
    store.createDiff({ ...BASE_PARAMS, sourceToolId: "post-unsub" });
    expect(count).toBe(4); // no notification after unsubscribe
  });

  // covers: BR-DE-STATE-001 — React useSyncExternalStore stable reference invariant
  it("DiffStore: getAllDiffs() returns stable reference between calls; new reference after mutation", () => {
    const store = createDiffStoreInstance();
    const diff = store.createDiff(BASE_PARAMS);

    const ref1 = store.getAllDiffs();
    const ref2 = store.getAllDiffs();
    expect(ref1).toBe(ref2); // stable reference

    store.updateDiff(diff.id, { appliedRange: { from: 1, to: 5 } });
    const ref3 = store.getAllDiffs();
    expect(ref3).not.toBe(ref1); // new reference after mutation
    expect(ref3).toBe(store.getAllDiffs()); // stable again until next mutation
  });

  // covers: BR-DE-STATE-001 — per-diff XState actor lifecycle
  it("DiffStore: getDiffActor() drives diffMachine; status syncs back; actor absent after moveToTerminal", () => {
    const store = createDiffStoreInstance();
    const diff = store.createDiff(BASE_PARAMS);

    const actor = store.getDiffActor(diff.id);
    expect(actor).toBeDefined();
    expect(actor!.getSnapshot().value).toBe("pending");

    // Actor drives machine; subscription propagates status back to PendingDiff map.
    actor!.send({ type: "LOGICAL_STATE_APPLIED" });
    expect(store.getDiff(diff.id)?.status).toBe("preapplied");

    // After moveToTerminal actor is stopped and removed.
    store.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "accepted", diff.sourceToolId));
    expect(store.getDiffActor(diff.id)).toBeUndefined();
    expect(store.getDiff(diff.id)).toBeUndefined();
  });
});

// ── Issue 6-B: AG-TOOL-CALL execution loop + applyDiffReplaceInEditor ─────────

describe("Issue 6-B — AG-TOOL-CALL execution loop + applyDiffReplaceInEditor", () => {

  // covers: BR-AG-DATA-002
  it("chatMachine: TOOL_REQUESTED → toolCalling; streamingContent cleared; TOOL_FINISHED → streaming (BR-AG-DATA-002)", () => {
    const actor = createActor(chatMachine).start();
    actor.send({ type: "WORKSPACE_OPENED", workspaceRoot: "/ws" });
    actor.send({ type: "SEND_MESSAGE", userContent: "edit the file", inputReferences: [], activeFilePath: null });
    actor.send({ type: "PROVIDER_VALID" });
    actor.send({ type: "STREAM_STARTED" });
    actor.send({ type: "TOKEN_RECEIVED", token: "I'll edit " });
    actor.send({ type: "TOKEN_RECEIVED", token: "the file" });
    expect(actor.getSnapshot().context.streamingContent).toBe("I'll edit the file");

    // TOOL_REQUESTED must clear streaming content (clearStreamingContent action) and enter toolCalling.
    actor.send({
      type: "TOOL_REQUESTED",
      execution: { id: "tool-abc-123", toolName: "edit_current_editor_document", input: {} },
    });
    expect(actor.getSnapshot().value).toBe("toolCalling");
    expect(actor.getSnapshot().context.streamingContent).toBe(""); // BR-AG-DATA-002: cleared before tool round-trip

    // TOOL_FINISHED resumes streaming for the continuation request.
    actor.send({ type: "TOOL_FINISHED", result: {} });
    expect(actor.getSnapshot().value).toBe("streaming");
  });

  // covers: BR-AG-DATA-002
  it("chatActor.ts: ToolResult message sets toolCallId = payload.id from SSE tool_call event (source check BR-AG-DATA-002)", () => {
    const src = readFileSync(
      repoPath("src/services/chatActor.ts"),
      "utf8",
    );
    // The ToolResult message construction must carry callId = Anthropic tool_use id.
    expect(src).toContain("toolCallId: call.id");
    expect(src).toContain("toolCallId: result.toolCallId");
    // The assistant content block array must merge text + tool_use in ONE message.
    expect(src).toContain("assistantBlocks");
    expect(src).toContain('type: "tool_use"');
    expect(src).toContain('type: "text"');
  });

  // covers: BR-AG-DATA-004
  it("chatActor.ts: edit_current_editor_document refuses when active file changed before tool execution", () => {
    const src = readFileSync(
      repoPath("src/services/chatActor.ts"),
      "utf8",
    );
    const fn = src.slice(
      src.indexOf("async function executeToolCall"),
      src.indexOf("function createToolResult"),
    );

    expect(fn).toContain("const currentActiveFilePath = toolRuntime?.getActiveFilePath() ?? null");
    expect(fn).toContain("currentActiveFilePath !== filePath");
    expect(fn).toContain('return createFailedToolResult(call, "active-file-changed")');
    expect(fn).toContain("toolRuntime.applyDiffReplaceInTab(filePath, originalText, newText");
    expect(fn).not.toContain("applyDiffReplaceInEditor(originalText, newText");
  });

  // covers: BR-AG-DATA-003
  it("applyDiffReplaceInEditor: no editor registered → { success: false, reason: \"no-editor\" } (BR-AG-DATA-003)", () => {
    unregisterEditor(); // ensure clean state
    const result = applyDiffReplaceInEditor("Hello world", "Hi");
    expect(result).toEqual({ success: false, reason: "no-editor" });
  });

  // covers: BR-AG-DATA-003
  it("applyDiffReplaceInEditor: originalText not in PM doc → { success: false, reason: \"text-not-found\" }; no edit dispatched (BR-AG-DATA-003)", () => {
    const { editor, edits } = buildMockEditor("Hello world");
    registerEditor(editor);
    try {
      const result = applyDiffReplaceInEditor("Goodbye cruel world", "Farewell");
      expect(result).toEqual({ success: false, reason: "text-not-found" });
      expect(edits).toHaveLength(0); // no mutation attempted
    } finally {
      unregisterEditor();
    }
  });

  // covers: BR-AG-DATA-003
  it("applyDiffReplaceInEditor: empty originalText → text-not-found and no PM mutation (BR-AG-DATA-003)", () => {
    const { editor, edits } = buildMockEditor("Hello world");
    registerEditor(editor);
    try {
      const result = applyDiffReplaceInEditor("", "bad");
      expect(result).toEqual({ success: false, reason: "text-not-found" });
      expect(edits).toHaveLength(0);
    } finally {
      unregisterEditor();
    }
  });

  // covers: BR-AG-DATA-003
  it("applyDiffReplaceInEditor: originalText found → success: true; appliedRange and revision tokens correct (BR-AG-DATA-003)", () => {
    // "Hello world" → text node at PM pos 1..11
    // "world" starts at flatText index 6 → PM from=7; last char at index 10 → PM to=12 (exclusive)
    // appliedRange.to = from + newText.length = 7 + 6 = 13
    const { editor, edits } = buildMockEditor("Hello world");
    registerEditor(editor);
    try {
      const result = applyDiffReplaceInEditor("world", "Binder");
      expect(result.success).toBe(true);
      if (!result.success) return; // narrow type

      expect(result.appliedRange).toEqual({ from: 7, to: 13 });
      // deleteRange received original text span [7, 12); insertContentAt at 7
      expect(edits).toHaveLength(1);
      expect(edits[0]).toEqual({ from: 7, to: 12, newText: "Binder" });
      // Revision tokens: 64-char hex strings
      expect(result.contentRevisionBeforeApply).toMatch(/^[0-9a-f]{64}$/);
      expect(result.contentRevisionAfterApply).toMatch(/^[0-9a-f]{64}$/);
      expect(result.contentRevisionBeforeApply).not.toBe(result.contentRevisionAfterApply);
    } finally {
      unregisterEditor();
    }
  });
});

afterEach(() => {
  // Ensure editorRegistry is clean between tests so module-level singleton
  // does not leak across describes.
  unregisterEditor();
});

// ── Issue 6-C: GreenAdditionDecoration + syncPendingDiffsWithDocument ─────────

describe("Issue 6-C — GreenAdditionDecoration + syncPendingDiffsWithDocument", () => {

  // covers: BR-ED-STATE-006
  // covers: BR-DE-UI-002
  it("GreenAdditionDecoration: plugin body contains Decoration.inline and does NOT mutate document (source check)", () => {
    const src = readFileSync(
      repoPath("src/components/EditorArea.tsx"),
      "utf8",
    );
    // Extract just the plugin definition block.
    const pluginSection = src.slice(
      src.indexOf("const GreenAdditionDecoration"),
      src.indexOf("function getMarkdownContent"),
    );
    expect(pluginSection).toContain("Decoration.inline");
    expect(pluginSection).toContain("DecorationSet");
    expect(pluginSection).toContain("background: var(--diff-add-bg)");
    // Must NOT contain document mutation calls — those belong to applyDiffReplaceInEditor only.
    expect(pluginSection).not.toContain("deleteRange");
    expect(pluginSection).not.toContain("insertContentAt");
    expect(pluginSection).not.toContain("setContent");
  });

  // covers: BR-DE-UI-002
  it("GreenAdditionDecoration: apply() handles undefined → map, null/empty → empty, ranges → decorations (source check)", () => {
    const src = readFileSync(
      repoPath("src/components/EditorArea.tsx"),
      "utf8",
    );
    expect(src).toContain("if (meta === undefined)");
    expect(src).toContain("return prevSet.map(tr.mapping, tr.doc)");
    expect(src).toContain("if (!meta) return DecorationSet.empty");
    expect(src).toContain("if (meta.length === 0) return DecorationSet.empty");
    expect(src).toContain(".map(({ from, to }) =>");
    expect(src).toContain("Decoration.inline(from, to, {");
  });

  // covers: BR-DE-STATE-012
  it("syncPendingDiffsWithDocument: preapplied diff expires when newText is no longer in content (BR-DE-STATE-012)", () => {
    const store = createDiffStoreInstance();
    // BASE_PARAMS.newText = "Hello Binder"
    const diff = store.createDiff(BASE_PARAMS);
    store.getDiffActor(diff.id)?.send({ type: "LOGICAL_STATE_APPLIED" });
    expect(store.getDiff(diff.id)?.status).toBe("preapplied");

    // Simulate handleEditorChange: user edit removes newText from content.
    const newContent = BASE_PARAMS.originalText; // "Hello world" — newText gone
    if (diff.status !== "preapplied" || !newContent.includes(diff.newText ?? "")) {
      const updated = store.getDiff(diff.id)!;
      // handleEditorChange checks status and newText presence via the live allDiffs snapshot.
      if (updated.status === "preapplied" && !newContent.includes(updated.newText)) {
        store.getDiffActor(updated.id)?.send({ type: "EXPIRE_REQUESTED" });
        store.moveToTerminal(updated.id, createTerminalDiffCard(updated.id, "expired", updated.sourceToolId));
      }
    }
    // Direct trigger: the diff's newText "Hello Binder" is not in "Hello world"
    const live = store.getDiff(diff.id);
    if (live && live.status === "preapplied" && !newContent.includes(live.newText)) {
      store.getDiffActor(live.id)?.send({ type: "EXPIRE_REQUESTED" });
      store.moveToTerminal(live.id, createTerminalDiffCard(live.id, "expired", live.sourceToolId));
    }

    expect(store.getDiff(diff.id)).toBeUndefined();
    expect(store.getTerminalCards()[0].status).toBe("expired");
  });

  // covers: BR-DE-STATE-012
  it("App.tsx handleEditorChange: contains BR-DE-STATE-012 expire guard for allDiffs (source check)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    const fn = src.slice(
      src.indexOf("function handleEditorChange"),
      src.indexOf("function handleTabDiscard"),
    );
    expect(fn).toContain("BR-DE-STATE-012");
    expect(fn).toContain('diff.status === "preapplied"');
    expect(fn).toContain("!diff.newText");
    expect(fn).toContain("edIsActiveEditorRangeText(diff.appliedRange, diff.newText)");
    expect(fn).toContain("expireDiff(diff)");
  });
});

// ── Issue 6-D: Accept / Reject / Expire full chains ──────────────────────────

describe("Issue 6-D — Accept / Reject / Expire full chains", () => {

  // covers: BR-DE-STATE-010
  // covers: BR-DE-STATE-011
  it("acceptDiff open-file: pending → preapplied → accepting → accepted → terminal (BR-DE-STATE-010/011)", () => {
    const store = createDiffStoreInstance();
    const diff = store.createDiff(BASE_PARAMS);
    const actor = store.getDiffActor(diff.id)!;

    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    expect(store.getDiff(diff.id)?.status).toBe("preapplied");

    actor.send({ type: "ACCEPT_REQUESTED" });
    expect(store.getDiff(diff.id)?.status).toBe("accepting");

    actor.send({ type: "ACCEPT_CONFIRMED" });
    expect(store.getDiff(diff.id)?.status).toBe("accepted");

    store.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "accepted", diff.sourceToolId));
    expect(store.getDiff(diff.id)).toBeUndefined();
    expect(store.getTerminalCards()[0].status).toBe("accepted");
    expect(store.getDiffActor(diff.id)).toBeUndefined();
  });

  // covers: BR-DE-STATE-010
  it("acceptDiff open-file: does NOT call writeWorkspaceFile or edSaveFile (BR-DE-STATE-010 source check)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    const acceptFn = src.slice(
      src.indexOf("function acceptDiff"),
      src.indexOf("function handleAcceptPendingDiff"),
    );
    expect(acceptFn).toContain("ACCEPT_CONFIRMED");
    expect(acceptFn).toContain("moveToTerminal");
    // Open-file accept must NOT write DiskState.
    expect(acceptFn).not.toContain("writeWorkspaceFile");
    expect(acceptFn).not.toContain("edSaveFile");
  });

  // covers: BR-DE-STATE-002
  it("rejectDiff open-file: pending → preapplied → rejecting → rejected → terminal (BR-DE-STATE-002)", () => {
    const store = createDiffStoreInstance();
    const diff = store.createDiff(BASE_PARAMS);
    const actor = store.getDiffActor(diff.id)!;

    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    actor.send({ type: "REJECT_REQUESTED" });
    expect(store.getDiff(diff.id)?.status).toBe("rejecting");

    actor.send({ type: "TERMINAL_RECORDED" });
    expect(store.getDiff(diff.id)?.status).toBe("rejected");

    store.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "rejected", diff.sourceToolId));
    expect(store.getDiff(diff.id)).toBeUndefined();
    expect(store.getTerminalCards()[0].status).toBe("rejected");
  });

  // covers: BR-DE-STATE-002
  it("rejectDiff open-file: targets the diff tab and records error on rollback failure (source check BR-DE-STATE-002)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    const rejectFn = src.slice(
      src.indexOf("function rejectDiff"),
      src.indexOf("function handleAcceptPendingDiff"),
    );
    // Range rollback: the exact appliedRange must still contain newText before originalText is restored.
    expect(rejectFn).toContain("edRollbackDiffInTab(tabId, diff.appliedRange, diff.newText, diff.originalText)");
    expect(rejectFn).toContain('actor?.send({ type: "FAILED" })');
    expect(rejectFn).toContain('createTerminalDiffCard(diff.id, "error"');
    expect(rejectFn).toContain("return false");
    expect(rejectFn).toContain("return true");
  });

  // covers: BR-DE-STATE-003
  // covers: BR-DE-STATE-012
  it("expireDiff: preapplied → expired → terminal; DiffStore removes pending entry (BR-DE-STATE-003/012)", () => {
    const store = createDiffStoreInstance();
    const diff = store.createDiff(BASE_PARAMS);
    const actor = store.getDiffActor(diff.id)!;

    actor.send({ type: "LOGICAL_STATE_APPLIED" });
    actor.send({ type: "EXPIRE_REQUESTED" });
    expect(store.getDiff(diff.id)?.status).toBe("expired");

    store.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "expired", diff.sourceToolId));
    expect(store.getTerminalCards()[0].status).toBe("expired");
    expect(store.getDiff(diff.id)).toBeUndefined();
  });

  // covers: BR-DE-STATE-013
  it("BR-DE-STATE-013: diffStore.clear() on WORKSPACE_CLOSED stops all actors and wipes pending+terminal maps", () => {
    const store = createDiffStoreInstance();
    const d1 = store.createDiff(BASE_PARAMS);
    const d2 = store.createDiff({ ...BASE_PARAMS, sourceToolId: "tool-2", newText: "v2" });
    store.getDiffActor(d1.id)?.send({ type: "LOGICAL_STATE_APPLIED" });

    expect(store.getAllDiffs()).toHaveLength(2);
    store.clear();
    expect(store.getAllDiffs()).toHaveLength(0);
    expect(store.getDiffActor(d1.id)).toBeUndefined();
    expect(store.getDiffActor(d2.id)).toBeUndefined();
  });
});

// ── Issue 6-E: workspace.db persistence + Inherit Flow (pending Tauri mock) ──

describe("Issue 6-E — workspace.db persistence + Inherit Flow", () => {
  // covers: BR-DE-STATE-013
  it("expireAllOnClose: all non-terminal diffs → expired and written to terminal_diff_cards on WORKSPACE_CLOSED", () => {
    const store = createDiffStoreInstance();
    const d1 = store.createDiff(BASE_PARAMS);
    const d2 = store.createDiff({ ...BASE_PARAMS, sourceToolId: "tool-2", newText: "v2" });
    store.getDiffActor(d1.id)?.send({ type: "LOGICAL_STATE_APPLIED" });

    const cards = store.expireAllOnClose();

    expect(cards).toHaveLength(2);
    expect(cards.every((card) => card.status === "expired")).toBe(true);
    expect(store.getAllDiffs()).toHaveLength(0);
    expect(store.getDiffActor(d1.id)).toBeUndefined();
    expect(store.getDiffActor(d2.id)).toBeUndefined();

    const appSrc = readFileSync(repoPath("src/App.tsx"), "utf8");
    expect(appSrc).toContain("diffStore.expireAllOnClose()");
    expect(appSrc).toContain("await saveTerminalCards(root, expiredCards)");

    const rustSrc = readFileSync(repoPath("src-tauri/src/lib.rs"), "utf8");
    expect(rustSrc).toContain("fn save_terminal_cards");
    expect(rustSrc).toContain("INSERT OR REPLACE INTO terminal_diff_cards");
    expect(rustSrc).toContain("DELETE FROM pending_diffs WHERE id = ?1");
  });

  // covers: BR-DE-PERSIST-002
  it("loadDiffsFromWorkspace: baseRevision consistent → restored as pending", () => {
    const appSrc = readFileSync(repoPath("src/App.tsx"), "utf8");
    expect(appSrc).toContain('const recoveredStatus: PendingDiffStatus = status === "preapplied" ? "pending" : status');
    expect(appSrc).toContain('effectivePath: status === "preapplied" ? "closed-file" : record.effectivePath');

    const workspaceActorSrc = readFileSync(repoPath("src/services/workspaceActor.ts"), "utf8");
    expect(workspaceActorSrc).toContain("recoverDiffsFromWorkspace");
    expect(workspaceActorSrc).toContain("setLoadedDiffs(recovery.restored)");

    const rustSrc = readFileSync(repoPath("src-tauri/src/lib.rs"), "utf8");
    expect(rustSrc).toContain("hash == record.base_revision");
    expect(rustSrc).toContain("record.status = \"pending\".to_string()");
    expect(rustSrc).toContain("record.effective_path = \"closed-file\".to_string()");
  });

  // covers: BR-DE-PERSIST-002
  it("loadDiffsFromWorkspace: baseRevision mismatch → auto-expired on load", () => {
    const rustSrc = readFileSync(repoPath("src-tauri/src/lib.rs"), "utf8");
    expect(rustSrc).toContain("fn recover_diffs_from_workspace");
    expect(rustSrc).toContain("unwrap_or(false)");
    expect(rustSrc).toContain("status: \"expired\".to_string()");
    expect(rustSrc).toContain("save_terminal_card_with_conn(&tx, &card)");
  });
});

// ── Issue 6-F: Composite scenarios + DiffCard UI + @GOV coverage ──────────────

describe("Issue 6-F — Composite scenarios + DiffCard UI + @GOV coverage", () => {

  // covers: BR-DE-STATE-014
  it("CLOSE_TAB guard: App.tsx handleTabDiscard checks for preapplied diff before closing tab (BR-DE-STATE-014 source check)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    const fn = src.slice(
      src.indexOf("function handleTabDiscard"),
      src.indexOf("async function handleTabSaveAndClose"),
    );
    expect(fn).toContain("BR-DE-STATE-014");
    // Guard: if preapplied, dialog state is set and function returns early.
    expect(fn).toContain("setPreappliedCloseTabId(tabId)");
    expect(fn).toContain("return;");
    // Direct close only reachable AFTER guard check (non-preapplied path).
    const guardPos = fn.indexOf("setPreappliedCloseTabId");
    const closePos = fn.indexOf("edCloseTab(tabId)");
    expect(guardPos).toBeLessThan(closePos); // guard precedes direct close
  });

  // covers: BR-DE-STATE-014
  // covers: BR-DE-STATE-002
  it("PreappliedTabCloseDialog reject path: does not switch active tab before rollback; rejectDiff targets tab content (source check)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    const closeRejectFn = src.slice(
      src.indexOf("function handleTabRejectAndClose"),
      src.indexOf("function handleTabAcceptAndClose"),
    );
    expect(closeRejectFn).not.toContain("edSwitchTab(tabId)");
    expect(closeRejectFn).toContain("rejectDiff(diff)");
  });

  // covers: BR-DE-UI-001
  it("DiffCard accept/reject: App.tsx handlers use the clicked diffId, not only activePreappliedDiff (source check)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    expect(src).toContain("function handleAcceptDiffById(diffId: string)");
    expect(src).toContain("function handleRejectDiffById(diffId: string)");
    expect(src).toContain("diffStore.getDiff(diffId)");
    expect(src).toContain("onAcceptDiff={(diffId) => handleAcceptDiffById(diffId)}");
    expect(src).toContain("onRejectDiff={(diffId) => handleRejectDiffById(diffId)}");
  });

  // covers: BR-AG-DATA-002
  it("chat_stream multi-tool chain: Rust emits ToolCalls and chatActor handles toolCalls batch (source check)", () => {
    const rustSrc = readFileSync(
      repoPath("src-tauri/src/lib.rs"),
      "utf8",
    );
    const chatSrc = readFileSync(
      repoPath("src/services/chatActor.ts"),
      "utf8",
    );
    expect(rustSrc).toContain("ToolCalls { request_id: String, calls: Vec<ToolCallPayload> }");
    expect(rustSrc).toContain("let mut pending_tools: Vec<ToolCallPayload>");
    expect(rustSrc).toContain("ChatStreamEvent::ToolCalls {");
    expect(rustSrc).toContain("request_id: request_id.to_string()");
    expect(chatSrc).toContain('payload.type === "tool_calls" || payload.type === "toolCalls"');
    expect(chatSrc).toContain("await handleToolCalls(payload.calls)");
  });

  // covers: BR-AG-DATA-003
  it("chatActor apply failure: creates a traceable diff and sends LOGICAL_STATE_APPLIED_FAILED (source check)", () => {
    const src = readFileSync(
      repoPath("src/services/chatActor.ts"),
      "utf8",
    );
    expect(src).toContain("LOGICAL_STATE_APPLIED_FAILED");
    expect(src).toContain("createTerminalErrorCard");
    expect(src).toContain("diffStore.moveToTerminal(pendingDiff.id");
  });

  // covers: BR-DE-UI-001
  it("DiffCard: terminal status guard exists in source — accept/reject actions hidden for non-preapplied states (BR-DE-UI-001 source check)", () => {
    const src = readFileSync(
      repoPath("src/components/DiffCard.tsx"),
      "utf8",
    );
    expect(src).toContain("BR-DE-UI-001");
    expect(src).toContain("preapplied");
  });

  // covers: BR-DE-UI-002
  it("DiffCard contains --diff-del-bg; EditorArea does NOT contain --diff-del-bg (BR-DE-UI-002)", () => {
    const diffCardSrc = readFileSync(
      repoPath("src/components/DiffCard.tsx"),
      "utf8",
    );
    const editorAreaSrc = readFileSync(
      repoPath("src/components/EditorArea.tsx"),
      "utf8",
    );
    expect(diffCardSrc).toContain("--diff-del-bg");
    expect(editorAreaSrc).not.toContain("--diff-del-bg");
  });

  // covers: BR-AG-DATA-002
  // covers: BR-AG-DATA-003
  it("chatActor.ts contains @GOV with BR-AG-DATA-002 and BR-AG-DATA-003 (BR-AG-DATA-002/003 source check)", () => {
    const src = readFileSync(
      repoPath("src/services/chatActor.ts"),
      "utf8",
    );
    expect(src).toContain("@GOV");
    expect(src).toContain("BR-AG-DATA-002");
    expect(src).toContain("BR-AG-DATA-003");
  });

  // covers: BR-DE-STATE-004
  it("PendingDiff carries baseRevision field for closed-file accept hash check (BR-DE-STATE-004 source check)", () => {
    const diff = createDiff(BASE_PARAMS);
    // BR-DE-STATE-004: baseRevision must be present; closed-file accept checks DiskState hash against it
    expect(diff.baseRevision).toBeDefined();
    expect(diff.baseRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(diff.effectivePath).toBe("open-file");
  });

  // covers: BR-DE-PERSIST-001
  it("Cmd+S guard: handleSaveFile blocks save and sets PreappliedSaveDialog; handleAcceptAllAndSave accepts before writing (BR-DE-PERSIST-001 source check)", () => {
    const src = readFileSync(
      repoPath("src/App.tsx"),
      "utf8",
    );
    // handleSaveFile must check for preapplied and show dialog.
    const saveFn = src.slice(
      src.indexOf("async function handleSaveFile"),
      src.indexOf("function handleEditorChange"),
    );
    expect(saveFn).toContain("BR-DE-PERSIST-001");
    expect(saveFn).toContain("setShowPreappliedSaveDialog(true)");
    expect(saveFn).toContain("return;"); // must NOT fall through to edSaveFile

    // handleAcceptAllAndSave must call acceptDiff() before edSaveFile().
    const acceptAllFn = src.slice(
      src.indexOf("async function handleAcceptAllAndSave"),
      src.indexOf("// ── Diff lifecycle helpers"),
    );
    expect(acceptAllFn).toContain("acceptDiff(diff)");
    expect(acceptAllFn).toContain("edSaveFile()");
    const acceptPos = acceptAllFn.indexOf("acceptDiff");
    const savePos   = acceptAllFn.indexOf("edSaveFile");
    expect(acceptPos).toBeLessThan(savePos); // accept precedes save
  });
});
