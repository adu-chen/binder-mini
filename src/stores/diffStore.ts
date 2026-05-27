import { createActor } from "xstate";
import type { Actor } from "xstate";
import { diffMachine } from "../machines/diffMachine";
import type {
  PendingDiff,
  TerminalDiffCard,
  CreateDiffParams,
} from "../types/diff";

/**
 * @GOV
 * codes: BR-DE-DATA-001-DATA-DE-DE-CREATE-DIFF-006,
 *        BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-007,
 *        BR-DE-STATE-004-GUARD-DE-DE-ACCEPT-DIFF-006,
 *        BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-007,
 *        BR-DE-PERSIST-002-DATA-DE-DE-CREATE-DIFF-008
 * type: DATA
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-DATA-001, BR-DE-STATE-001, BR-DE-STATE-004, BR-DE-PERSIST-001, BR-DE-PERSIST-002
 * boundary: in=CreateDiffParams with sourceToolId and baseRevision |
 *           out=DiffStore Map<diffId, PendingDiff> with per-diff XState diffMachine actor, TerminalDiffCard list, and subscribe() for React useSyncExternalStore |
 *           delegate=diffMachine per-instance state transitions
 * term_ref: TERM-DE-001, TERM-DE-002, TERM-DE-005, TERM-DE-009, TERM-DE-010, TERM-WS-002
 */

// ── DiffStore factory ────────────────────────────────────────────────────────

type DiffActor = Actor<typeof diffMachine>;

export interface DiffStoreInstance {
  /** BR-DE-STATE-001: sole authorised entry point for creating a PendingDiff. */
  createDiff(params: CreateDiffParams): PendingDiff;
  getDiff(diffId: string): PendingDiff | undefined;
  /** Returns the cached snapshot — stable reference between notifications. */
  getAllDiffs(): PendingDiff[];
  /** Apply a partial update to a pending diff (e.g. record appliedRange). */
  updateDiff(diffId: string, update: Partial<PendingDiff>): void;
  /** Rebuild an in-memory PendingDiff and its diffMachine actor from WorkspaceDatabase. */
  hydrateDiff(diff: PendingDiff): void;
  /** BR-DE-STATE-013: expire every live diff for WORKSPACE_CLOSED and return terminal cards for persistence. */
  expireAllOnClose(): TerminalDiffCard[];
  /**
   * Remove from pendingDiffs map and prepend the TerminalDiffCard.
   * Called by accept/reject/expire paths after the diffMachine reaches a final state.
   */
  moveToTerminal(diffId: string, card: TerminalDiffCard): void;
  /** Returns the cached snapshot — stable reference between notifications. */
  getTerminalCards(): TerminalDiffCard[];
  /** Reset all state. Used by WORKSPACE_CLOSED (BR-DE-STATE-013) and tests. */
  clear(): void;
  /** Per-diff XState actor; drive state transitions (LOGICAL_STATE_APPLIED, etc.). */
  getDiffActor(diffId: string): DiffActor | undefined;
  /**
   * Subscribe for React useSyncExternalStore.
   * Listener is called synchronously after any mutation.
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void;
}

/**
 * Create an independent DiffStore instance.
 * Export as a factory so tests can instantiate fresh stores without module singletons.
 */
export function createDiffStoreInstance(): DiffStoreInstance {
  const pendingDiffs = new Map<string, PendingDiff>();
  const diffActors = new Map<string, DiffActor>();
  let terminalCards: TerminalDiffCard[] = [];

  // Stable snapshots for React useSyncExternalStore (Object.is comparison).
  // Rebuilt only when data actually changes.
  let cachedAllDiffs: PendingDiff[] = [];
  let cachedTerminalCards: TerminalDiffCard[] = [];

  const listeners = new Set<() => void>();

  function notifyListeners() {
    cachedAllDiffs = Array.from(pendingDiffs.values());
    cachedTerminalCards = [...terminalCards];
    for (const l of listeners) l();
  }

  // BR-DE-DATA-001: sourceToolId + baseRevision validated at creation.
  function createDiff(params: CreateDiffParams): PendingDiff {
    if (!params.sourceToolId) {
      throw new Error(
        "[DiffStore] BR-DE-DATA-001: sourceToolId is required to create a PendingDiff.",
      );
    }
    if (!params.baseRevision) {
      throw new Error(
        "[DiffStore] BR-DE-DATA-001: baseRevision is required to create a PendingDiff.",
      );
    }
    const diff: PendingDiff = {
      id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      filePath: params.filePath,
      originalText: params.originalText,
      newText: params.newText,
      status: "pending",
      summary: params.summary,
      sourceToolId: params.sourceToolId,
      baseRevision: params.baseRevision,
      createdAt: Date.now(),
      effectivePath: params.effectivePath,
      anchor: params.anchor,
    };
    // BR-DE-STATE-001: DiffStore.createDiff is the sole entry point.
    pendingDiffs.set(diff.id, diff);

    // Start a per-diff XState actor to drive state transitions.
    const actor = createActor(diffMachine);
    actor.subscribe((snapshot) => {
      // Sync machine state back into the data map whenever it transitions.
      const newStatus = snapshot.value as PendingDiff["status"];
      const existing = pendingDiffs.get(diff.id);
      if (existing && existing.status !== newStatus) {
        pendingDiffs.set(diff.id, { ...existing, status: newStatus });
        notifyListeners();
      }
    });
    actor.start();
    diffActors.set(diff.id, actor);

    notifyListeners();
    return diff;
  }

  function getDiff(diffId: string): PendingDiff | undefined {
    return pendingDiffs.get(diffId);
  }

  function getAllDiffs(): PendingDiff[] {
    return cachedAllDiffs;
  }

  function updateDiff(diffId: string, update: Partial<PendingDiff>): void {
    const existing = pendingDiffs.get(diffId);
    if (!existing) return;
    pendingDiffs.set(diffId, { ...existing, ...update });
    notifyListeners();
  }

  function syncActorToStatus(actor: DiffActor, status: PendingDiff["status"]) {
    if (status === "preapplied") actor.send({ type: "LOGICAL_STATE_APPLIED" });
    else if (status === "accepting") actor.send({ type: "ACCEPT_REQUESTED" });
    else if (status === "rejecting") actor.send({ type: "REJECT_REQUESTED" });
    else if (status === "expired") actor.send({ type: "EXPIRE_REQUESTED" });
    else if (status === "error") actor.send({ type: "LOGICAL_STATE_APPLIED_FAILED" });
  }

  function hydrateDiff(diff: PendingDiff): void {
    if (!diff.id || pendingDiffs.has(diff.id)) return;
    const hydratedDiff: PendingDiff = diff.status === "preapplied"
      ? {
          ...diff,
          status: "pending",
          effectivePath: "closed-file",
          appliedRange: undefined,
          contentRevisionBeforeApply: undefined,
          contentRevisionAfterApply: undefined,
        }
      : diff;
    pendingDiffs.set(hydratedDiff.id, hydratedDiff);
    const actor = createActor(diffMachine);
    actor.subscribe((snapshot) => {
      const newStatus = snapshot.value as PendingDiff["status"];
      const existing = pendingDiffs.get(hydratedDiff.id);
      if (existing && existing.status !== newStatus) {
        pendingDiffs.set(hydratedDiff.id, { ...existing, status: newStatus });
        notifyListeners();
      }
    });
    actor.start();
    syncActorToStatus(actor, hydratedDiff.status);
    diffActors.set(hydratedDiff.id, actor);
    notifyListeners();
  }

  function moveToTerminal(diffId: string, card: TerminalDiffCard): void {
    pendingDiffs.delete(diffId);
    const actor = diffActors.get(diffId);
    if (actor) {
      actor.stop();
      diffActors.delete(diffId);
    }
    terminalCards = [card, ...terminalCards];
    notifyListeners();
  }

  function expireAllOnClose(): TerminalDiffCard[] {
    const cards: TerminalDiffCard[] = [];
    for (const diff of Array.from(pendingDiffs.values())) {
      const actor = diffActors.get(diff.id);
      actor?.send({ type: "EXPIRE_REQUESTED" });
      const card: TerminalDiffCard = {
        diffId: diff.id,
        status: "expired",
        message: "Diff expired",
        sourceToolId: diff.sourceToolId,
        resolvedAt: Date.now(),
      };
      cards.push(card);
      pendingDiffs.delete(diff.id);
      actor?.stop();
      diffActors.delete(diff.id);
    }
    if (cards.length > 0) {
      terminalCards = [...cards, ...terminalCards];
      notifyListeners();
    }
    return cards;
  }

  function getTerminalCards(): TerminalDiffCard[] {
    return cachedTerminalCards;
  }

  function clear(): void {
    for (const actor of diffActors.values()) {
      actor.stop();
    }
    pendingDiffs.clear();
    diffActors.clear();
    terminalCards = [];
    notifyListeners();
  }

  function getDiffActor(diffId: string): DiffActor | undefined {
    return diffActors.get(diffId);
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  return {
    createDiff,
    getDiff,
    getAllDiffs,
    updateDiff,
    hydrateDiff,
    expireAllOnClose,
    moveToTerminal,
    getTerminalCards,
    clear,
    getDiffActor,
    subscribe,
  };
}

// ── Module singleton ─────────────────────────────────────────────────────────
// One shared instance per application session; replaced by WORKSPACE_CLOSED → clear().
export const diffStore: DiffStoreInstance = createDiffStoreInstance();

// ── React hook ───────────────────────────────────────────────────────────────
/**
 * Returns the module-level DiffStore instance.
 * For reactive rendering use useSyncExternalStore with diffStore.subscribe().
 */
export function useDiffStore(): DiffStoreInstance {
  return diffStore;
}
