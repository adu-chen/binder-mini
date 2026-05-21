import { describe, expect, it } from "vitest";
import {
  acceptPendingDiff,
  createPendingDiffFromCurrentEditor,
  rejectPendingDiff,
  shouldExpirePendingDiff,
} from "../src/services/diffService";

describe("Diff Review MVP service behavior", () => {
  // covers: BR-DE-STATE-001
  it("creates PendingDiff from current editor without mutating content", () => {
    const diff = createPendingDiffFromCurrentEditor({
      filePath: "notes.md",
      originalText: "hello",
      instruction: " add summary ",
    });

    expect(diff.status).toBe("pending");
    expect(diff.filePath).toBe("notes.md");
    expect(diff.originalText).toBe("hello");
    expect(diff.proposedText).toContain("Binder Mini proposal: add summary");
  });

  // covers: BR-DE-STATE-001
  it("allows a PendingDiff for an empty current editor document", () => {
    const diff = createPendingDiffFromCurrentEditor({
      filePath: "new.md",
      originalText: "",
      instruction: "start draft",
    });

    expect(diff.originalText).toBe("");
    expect(diff.proposedText).toContain("start draft");
  });

  // covers: BR-DE-PERSIST-001
  it("accepts PendingDiff only when current content still matches original", () => {
    const diff = createPendingDiffFromCurrentEditor({
      filePath: "notes.md",
      originalText: "hello",
      instruction: "add summary",
    });

    const accepted = acceptPendingDiff(diff, "notes.md", "hello");
    expect(accepted.content).toBe(diff.proposedText);
    expect(accepted.terminalCard.status).toBe("accepted");
  });

  // covers: BR-DE-STATE-002
  it("rejects PendingDiff without producing write content", () => {
    const diff = createPendingDiffFromCurrentEditor({
      filePath: "notes.md",
      originalText: "hello",
      instruction: "add summary",
    });

    expect(rejectPendingDiff(diff).status).toBe("rejected");
  });

  // covers: BR-DE-STATE-003
  it("expires PendingDiff when target content changed", () => {
    const diff = createPendingDiffFromCurrentEditor({
      filePath: "notes.md",
      originalText: "hello",
      instruction: "add summary",
    });

    expect(shouldExpirePendingDiff(diff, "notes.md", "changed")).toBe(true);
    expect(acceptPendingDiff(diff, "notes.md", "changed").terminalCard.status).toBe(
      "expired",
    );
  });
});
