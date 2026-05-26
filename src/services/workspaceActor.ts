import { useState, useEffect, useRef } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { workspaceMachine } from "../machines/workspaceMachine";
import {
  openWorkspace as openWorkspaceIpc,
  loadDiffsFromWorkspace,
  saveChatMessages,
} from "../ipc";
import { normalizeRecentWorkspaces, sortWorkspaceEntries } from "./workspaceService";
import type { WorkspaceSnapshot, RecentWorkspace } from "../types/workspace";
import type { PendingDiffRecord, ChatMessageRecord } from "../ipc";

/**
 * @GOV
 * codes: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-PERSIST-001
 * type: RB
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-PERSIST-001
 * boundary: in=user workspace selection and CONFIRM_CLOSE event | out=workspaceMachine actor broadcasting WORKSPACE_OPENED and WORKSPACE_CLOSED to editorMachine actor and chatMachine actor
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-WS-003, TERM-WS-005, TERM-ED-003, TERM-AG-004
 */

export interface WorkspaceActorBroadcasts {
  /** Called after workspaceMachine Loading → Active (WORKSPACE_OPENED). */
  onWorkspaceOpened: (workspaceRoot: string) => void;
  /** Called after CONFIRM_CLOSE and before CLOSE_DONE (WORKSPACE_CLOSED). */
  onWorkspaceClosed: () => void;
}

/**
 * Custom hook that creates and manages the workspaceMachine actor.
 *
 * Orchestrates:
 * - BR-WS-STATE-001: workspaceMachine full state lifecycle
 * - BR-WS-STATE-002: Loading sequence (open_workspace IPC → loadDiffsFromWorkspace → LOAD_SUCCEEDED)
 * - BR-WS-STATE-003: Closing sequence with guard check and WORKSPACE_CLOSED broadcast
 * - BR-WS-PERSIST-001: RecentWorkspace normalization from open_workspace result
 */
export function useWorkspaceActor(broadcasts: WorkspaceActorBroadcasts) {
  const wsActor = useActorRef(workspaceMachine);
  const wsValue = useSelector(wsActor, (s) => s.value);

  // Workspace snapshot data (entries, displayName, rootPath) lives separately from machine context
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [loadedDiffs, setLoadedDiffs] = useState<PendingDiffRecord[]>([]);

  // Stores the open result while the Loading sequence runs
  const pendingResultRef = useRef<{
    snapshot: WorkspaceSnapshot;
    recentWorkspaces: RecentWorkspace[];
  } | null>(null);

  // Keep broadcasts ref current so effects never have stale callbacks
  const broadcastsRef = useRef(broadcasts);
  useEffect(() => {
    broadcastsRef.current = broadcasts;
  });

  // Track previous state to detect Loading → Active transition for WORKSPACE_OPENED broadcast
  const prevValueRef = useRef<string>(wsValue as string);
  useEffect(() => {
    const prev = prevValueRef.current;
    const curr = wsValue as string;
    prevValueRef.current = curr;
    if (prev === "Loading" && curr === "Active") {
      const root = wsActor.getSnapshot().context.workspaceRoot;
      if (root) broadcastsRef.current.onWorkspaceOpened(root);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsValue]);

  // Loading sequence (BR-WS-STATE-002): when machine enters Loading, run IPC calls
  useEffect(() => {
    if (wsValue !== "Loading") return;
    const workspaceRoot = wsActor.getSnapshot().context.workspaceRoot;
    if (!workspaceRoot) return;

    let cancelled = false;
    void (async () => {
      try {
        // Step 3 of Loading sequence: load non-terminal PendingDiff records from workspace.db
        const diffs = await loadDiffsFromWorkspace(workspaceRoot);
        if (cancelled) return;
        setLoadedDiffs(diffs);
        // Promote pending open result to active snapshot
        if (pendingResultRef.current) {
          setWorkspaceSnapshot(pendingResultRef.current.snapshot);
          setRecentWorkspaces(pendingResultRef.current.recentWorkspaces);
        }
        wsActor.send({ type: "LOAD_SUCCEEDED" });
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        wsActor.send({ type: "LOAD_FAILED", errorMessage });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsValue]);

  /**
   * Opens a workspace via folder-picker dialog.
   * On selection: stores the result in pendingResultRef and sends OPEN_WORKSPACE event.
   * The Loading sequence effect then completes the sequence.
   */
  async function openWorkspaceFlow(): Promise<void> {
    const result = await openWorkspaceIpc();
    if (result.cancelled || !result.snapshot) return;
    pendingResultRef.current = {
      snapshot: {
        ...result.snapshot,
        entries: sortWorkspaceEntries(result.snapshot.entries),
      },
      recentWorkspaces: normalizeRecentWorkspaces(result.recentWorkspaces ?? []),
    };
    wsActor.send({
      type: "OPEN_WORKSPACE",
      workspaceRoot: result.snapshot.workspace.rootPath,
    });
  }

  /**
   * Completes the workspace close sequence (BR-WS-STATE-003).
   * Called after user confirms WorkspaceCloseGuardDialog or when no guard is needed.
   *
   * Sequence:
   * 1. Persist AgentMessage list (BR-AG-PERSIST-001) — save_chat_messages IPC
   * 2. Broadcast WORKSPACE_CLOSED to other modules
   * 3. Clear local workspace data
   * 4. Send CLOSE_DONE → machine: Closing → NoWorkspace
   */
  async function confirmCloseFlow(chatMessages: ChatMessageRecord[]): Promise<void> {
    const root = wsActor.getSnapshot().context.workspaceRoot;
    if (!root) return;

    // BR-AG-PERSIST-001: persist chat messages before clearing in-memory state
    try {
      await saveChatMessages(root, chatMessages);
    } catch {
      // Persistence failure does not block close; continue
    }

    // Broadcast WORKSPACE_CLOSED before clearing (per plan: before CLOSE_DONE)
    broadcastsRef.current.onWorkspaceClosed();

    // Clear workspace data
    setWorkspaceSnapshot(null);
    setRecentWorkspaces([]);
    setLoadedDiffs([]);
    pendingResultRef.current = null;

    // Transition machine: Closing → NoWorkspace
    wsActor.send({ type: "CLOSE_DONE" });
  }

  return {
    wsActor,
    wsValue,
    workspaceSnapshot,
    recentWorkspaces,
    loadedDiffs,
    openWorkspaceFlow,
    confirmCloseFlow,
  };
}
