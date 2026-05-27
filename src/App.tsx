import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createTerminalDiffCard } from "./services/diffService";
import {
  canChangeWorkspace,
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceItem,
  isPathConflict,
  renameWorkspaceItem,
  sortWorkspaceEntries,
} from "./services/workspaceService";
import { useWorkspaceActor } from "./services/workspaceActor";
import { useEditorActor } from "./services/editorActor";
import { useChatActor } from "./services/chatActor";
import { diffStore } from "./stores/diffStore";
import { extractDocumentStructure } from "./stores/editorRegistry";
import { useWorkspaceSearch } from "./hooks/useWorkspaceSearch";
import { MainLayout } from "./components/MainLayout";
import { FileTreePanel } from "./components/FileTreePanel";
import { EditorColumn } from "./components/EditorColumn";
import { ChatPanel } from "./components/ChatPanel";
import { WorkspaceCloseGuardDialog } from "./components/WorkspaceCloseGuardDialog";
import { PreappliedSaveDialog } from "./components/PreappliedSaveDialog";
import { PreappliedTabCloseDialog } from "./components/PreappliedTabCloseDialog";
import type { InputReference, ProviderConfig } from "./types/agent";
import type { PendingDiff, TerminalDiffCard } from "./types/diff";
import type { WorkspaceMutationResult } from "./types/workspace";
import type { PendingDiffStatus } from "./machines/diffMachine";
import type { ChatMessageRecord, PendingDiffRecord } from "./ipc";
import { saveApiKey, isApiKeyConfigured, updateDiffStatus } from "./ipc";

const MAX_ACTIVE_FILE_LOGICAL_STATE_SNAPSHOT = 12_000;
/**
 * @GOV
 * codes: BR-SYS-UI-001, BR-SYS-UI-002, BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-PERSIST-001, BR-WS-DATA-005, BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-003, BR-ED-STATE-004, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003, BR-ED-STATE-005, BR-ED-STATE-006, BR-AG-SEC-001, BR-AG-UI-001, BR-AG-PERSIST-001, BR-AG-PERSIST-002, BR-AG-DATA-004, BR-DE-PERSIST-001, BR-DE-STATE-014, BR-DE-UI-001, BR-DE-UI-002
 * type: RB
 * chain: WS-OPEN, WS-CLOSE, WS-FILE-MANAGE, WS-SEARCH, ED-OPEN-FILE, ED-SAVE-FILE, AG-SEND-MESSAGE, AG-TOOL-CALL, DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-SYS-UI-001, BR-SYS-UI-002, BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-PERSIST-001, BR-WS-DATA-005, BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-003, BR-ED-STATE-004, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003, BR-ED-STATE-005, BR-ED-STATE-006, BR-AG-SEC-001, BR-AG-UI-001, BR-AG-PERSIST-001, BR-AG-PERSIST-002, BR-AG-DATA-004, BR-DE-PERSIST-001, BR-DE-STATE-014, BR-DE-UI-001, BR-DE-UI-002
 * boundary: in=Tauri IPC command results and user interaction events | out=three-column MainLayout delegating to FileTreePanel, EditorColumn, ChatPanel with WorkspaceCloseGuardDialog overlay
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-WS-005, TERM-ED-001, TERM-ED-003, TERM-AG-002, TERM-AG-004, TERM-AG-015, TERM-DE-001
 */
export default function App() {
  // ── editorMachine actor (Issue 4-A) ───────────────────────────
  const {
    edActor: _edActor,
    edValue,
    edTabs,
    edActiveTabId,
    edErrorMessage,
    activeContent,
    onWorkspaceOpened: edOnWorkspaceOpened,
    onWorkspaceClosed: edOnWorkspaceClosed,
    openFile: edOpenFile,
    saveFile: edSaveFile,
    setContent: edSetContent,
    applyDiffReplaceInTab: edApplyDiffReplaceInTab,
    closeTab: edCloseTab,
    switchTab: edSwitchTab,
  } = useEditorActor();

  // ── workspaceMachine actor (Issue 3-A) ─────────────────────────
  const {
    wsActor,
    wsValue,
    workspaceSnapshot,
    recentWorkspaces,
    loadedDiffs,
    openWorkspaceFlow,
    confirmCloseFlow,
  } = useWorkspaceActor({
    onWorkspaceOpened: (workspaceRoot) => {
      edOnWorkspaceOpened(workspaceRoot);
      void chatOnWorkspaceOpened(workspaceRoot);
    },
    onWorkspaceClosed: () => {
      const root = workspaceSnapshot?.workspace.rootPath;
      for (const diff of diffStore.getAllDiffs()) {
        if (root) void updateDiffStatus(root, diff.id, "expired");
      }
      edOnWorkspaceClosed();
      void chatOnWorkspaceClosed();
      setShowPreappliedSaveDialog(false);
      setPreappliedCloseTabId(null);
      setInputReferences([]);
      // BR-DE-STATE-013: all non-terminal PendingDiffs cleared — diffStore.clear() stops
      // all per-diff actors and notifies subscribers, which re-renders allDiffs as [].
      diffStore.clear();
    },
  });

  // ── Workspace close guard ───────────────────────────────────────
  const [showCloseGuard, setShowCloseGuard] = useState(false);

  // ── PathConflict error banner (BR-WS-DATA-002, BR-AG-TOOL-001) ─
  const conflictTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const referenceErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  function showConflictError(message: string) {
    if (conflictTimeoutRef.current) clearTimeout(conflictTimeoutRef.current);
    setConflictError(message);
    conflictTimeoutRef.current = setTimeout(() => setConflictError(null), 3000);
  }

  function showReferenceError(message: string) {
    if (referenceErrorTimeoutRef.current) clearTimeout(referenceErrorTimeoutRef.current);
    setReferenceError(message);
    referenceErrorTimeoutRef.current = setTimeout(() => setReferenceError(null), 3000);
  }

  // ── Agent / Chat (Issue 5-A) ────────────────────────────────────
  const {
    chatValue,
    chatMessages,
    chatStreamingContent,
    chatErrorMessage,
    onWorkspaceOpened: chatOnWorkspaceOpened,
    onWorkspaceClosed: chatOnWorkspaceClosed,
    sendMessage: chatSendMessage,
    cancelMessage: chatCancelMessage,
    retryMessage: chatRetryMessage,
    notifyActiveFileChanged,
  } = useChatActor();

  const [inputReferences, setInputReferences] = useState<InputReference[]>([]);
  const previousChatValueRef = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousChatValueRef.current;
    if (previous === "streaming" && chatValue === "ready") {
      setInputReferences([]);
    }
    previousChatValueRef.current = chatValue;
  }, [chatValue]);

  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: "anthropic",
    model: "claude-opus-4-5",
    apiKeyConfigured: false,
  });

const defaultModels: Record<ProviderConfig["provider"], string> = {
    anthropic: "claude-opus-4-5",
    openai: "gpt-4.1",
    deepseek: "deepseek-chat",
  };

  function pendingDiffFromRecord(record: PendingDiffRecord): PendingDiff | null {
    const status = record.status as PendingDiffStatus;
    if (!["pending", "preapplied", "accepting", "rejecting"].includes(status)) {
      return null;
    }
    return {
      id: record.id,
      filePath: record.filePath,
      originalText: record.originalText,
      newText: record.newText,
      summary: record.summary,
      status,
      effectivePath: record.effectivePath,
      sourceToolId: record.sourceToolId,
      baseRevision: record.baseRevision,
      createdAt: record.createdAt,
      appliedRange:
        record.appliedRangeFrom !== null && record.appliedRangeTo !== null
          ? { from: record.appliedRangeFrom, to: record.appliedRangeTo }
          : undefined,
    };
  }

  useEffect(() => {
    void isApiKeyConfigured(providerConfig.provider).then((configured) =>
      setProviderConfig((current) =>
        current.provider === providerConfig.provider
          ? { ...current, apiKeyConfigured: configured }
          : current,
      ),
    );
  }, [providerConfig.provider]);

  function handleProviderChange(provider: ProviderConfig["provider"]) {
    setProviderConfig((current) => ({
      provider,
      model: defaultModels[provider],
      apiKeyConfigured: current.provider === provider ? current.apiKeyConfigured : false,
    }));
  }

  function handleModelChange(model: string) {
    setProviderConfig((current) => ({ ...current, model }));
  }

  // ── Diff — reactive via diffStore (BR-DE-STATE-001, BR-DE-STATE-013) ──────
  // useSyncExternalStore gives React a stable snapshot reference between mutations.
  const allDiffs = useSyncExternalStore(
    (cb) => diffStore.subscribe(cb),
    () => diffStore.getAllDiffs(),
  );
  const terminalDiffCards = useSyncExternalStore(
    (cb) => diffStore.subscribe(cb),
    () => diffStore.getTerminalCards(),
  );

  // BR-DE-PERSIST-001: guard Cmd+S when a preapplied diff is present in the active tab.
  const [showPreappliedSaveDialog, setShowPreappliedSaveDialog] = useState(false);
  // BR-DE-STATE-014: guard tab-close when a preapplied diff is present in that tab.
  const [preappliedCloseTabId, setPreappliedCloseTabId] = useState<string | null>(null);

  // ── Search (Issue 3-C, BR-WS-DATA-005) ─────────────────────────
  const { searchQuery, searchResults, handleSearchQueryChange, clearSearchResults } =
    useWorkspaceSearch();

  // ── Local entries state for file mutations (Phase 3-D) ─────────
  // workspaceActor manages workspaceSnapshot; local mutations update entries here.
  // Reset when workspace root changes.
  const [localWorkspaceEntries, setLocalWorkspaceEntries] = useState<
    import("./types/workspace").WorkspaceEntry[] | null
  >(null);

  useEffect(() => {
    setLocalWorkspaceEntries(null);
  }, [workspaceSnapshot?.workspace.rootPath]);

  // ── Derived ────────────────────────────────────────────────────
  const isActive = wsValue === "Active";

  // ── State derivation helpers ───────────────────────────────────
  type WorkspacePanelState = "NoWorkspace" | "Loading" | "Active" | "Closing" | "Error";
  function workspacePanelState(): WorkspacePanelState {
    return wsValue as WorkspacePanelState;
  }

  type EditorStateName =
    | "noWorkspace" | "idle" | "loading" | "editing" | "dirty" | "saving" | "readonly" | "error";
  function editorStateName(): EditorStateName {
    return edValue as EditorStateName;
  }

  type ChatStateName =
    | "noWorkspace" | "ready" | "validatingProvider" | "sending" | "streaming"
    | "toolCalling" | "cancelling" | "error";
  function chatStateName(): ChatStateName {
    return chatValue as ChatStateName;
  }

  // Derive active tab's fileType for EditorArea serialization path
  const activeTab = edTabs.find((t) => t.id === edActiveTabId) ?? null;
  const activeFileType = activeTab?.fileType;

  // ── Workspace handlers ─────────────────────────────────────────
  // Preapplied diffs for the currently active tab's file.
  const activeFilePath = activeTab?.filePath ?? null;
  const activeFileMode = activeTab
    ? activeTab.fileType === "other" ? "readonly" : "editable"
    : undefined;
  const activeFileDirty = activeTab?.dirty ?? false;
  const activePreappliedDiff: PendingDiff | null = activeFilePath
    ? (allDiffs.find((d) => d.filePath === activeFilePath && d.status === "preapplied") ?? null)
    : null;
  const activeFilePendingDiffCount = activeFilePath
    ? allDiffs.filter((d) => d.filePath === activeFilePath).length
    : 0;
  const activeFileLogicalStateSnapshot =
    activeFilePath && activeFileMode === "editable"
      ? activeContent.slice(0, MAX_ACTIVE_FILE_LOGICAL_STATE_SNAPSHOT)
      : undefined;
  const activeFileSnapshotTruncated =
    activeFilePath && activeFileMode === "editable"
      ? activeContent.length > MAX_ACTIVE_FILE_LOGICAL_STATE_SNAPSHOT
      : undefined;

  useEffect(() => {
    if (!workspaceSnapshot) return;
    for (const record of loadedDiffs) {
      const hydrated = pendingDiffFromRecord(record);
      if (hydrated) diffStore.hydrateDiff(hydrated);
    }
  }, [loadedDiffs, workspaceSnapshot]);

  const previousActiveFilePathRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousActiveFilePathRef.current;
    if (previous !== activeFilePath) {
      if (previous && activeFilePath) {
        notifyActiveFileChanged(previous, activeFilePath);
      }
      previousActiveFilePathRef.current = activeFilePath;
    }
  }, [activeFilePath, notifyActiveFileChanged]);

  // Tabs that have at least one preapplied diff — for tab close guard and tab indicator.
  const preappliedTabIds = new Set(
    allDiffs.filter((d) => d.status === "preapplied").map((d) => d.filePath),
  );

  function canLeaveWorkspace() {
    return canChangeWorkspace({
      editorDirty: edTabs.some((t) => t.dirty),
      hasPendingDiff: allDiffs.length > 0,
    });
  }

  function handleOpenWorkspace() {
    void openWorkspaceFlow();
  }

  function handleCloseWorkspaceWithGuard() {
    if (!workspaceSnapshot) return;
    if (!canLeaveWorkspace()) {
      wsActor.send({ type: "CLOSE_WORKSPACE" });
      setShowCloseGuard(true);
      return;
    }
    // No guard needed — transition machine to Closing then immediately close
    wsActor.send({ type: "CLOSE_WORKSPACE" });
    wsActor.send({ type: "CONFIRM_CLOSE" });
    void confirmCloseFlow(toChatMessageRecords());
  }

  function handleForceCloseWorkspace() {
    setShowCloseGuard(false);
    wsActor.send({ type: "CONFIRM_CLOSE" });
    void confirmCloseFlow(toChatMessageRecords());
  }

  function handleCancelClose() {
    setShowCloseGuard(false);
    wsActor.send({ type: "CANCEL_CLOSE" });
  }

  /** BR-AG-PERSIST-001: chat persistence is handled by chatActor.onWorkspaceClosed(). */
  function toChatMessageRecords(): ChatMessageRecord[] {
    // chatActor persists messages directly; this returns empty to satisfy confirmCloseFlow signature
    return [];
  }

  async function applyWorkspaceMutation(
    action: () => Promise<WorkspaceMutationResult>,
  ) {
    if (!workspaceSnapshot) return;
    const result = await action();
    if (isPathConflict(result)) {
      // Show banner (BR-WS-DATA-002) and throw so FileTreeNode can show inline error
      showConflictError(result.conflict.message);
      throw new Error(result.conflict.message);
    }
    // Update local entries state (workspaceActor owns snapshot; Phase 4 wires full actor path)
    setLocalWorkspaceEntries(sortWorkspaceEntries(result.entries));
    // BR-WS-DATA-005: invalidate stale search results after any file mutation
    clearSearchResults();
  }

  // The effective entries: local mutations override actor snapshot
  const effectiveEntries = isActive
    ? (localWorkspaceEntries ?? workspaceSnapshot?.entries ?? [])
    : [];

  // ── File management handlers (Issue 3-D) ─────────────────────
  async function handleCreateWorkspaceItem(
    kind: "file" | "folder",
    parentRelativePath: string,
    name: string,
  ) {
    if (!workspaceSnapshot) return;
    const separator = parentRelativePath ? "/" : "";
    const relativePath = `${parentRelativePath}${separator}${name}`;
    await applyWorkspaceMutation(() =>
      kind === "file"
        ? createWorkspaceFile(workspaceSnapshot.workspace.rootPath, relativePath)
        : createWorkspaceFolder(workspaceSnapshot.workspace.rootPath, relativePath),
    );
  }

  async function handleRenameWorkspaceItem(relativePath: string, newName: string) {
    if (!workspaceSnapshot) return;
    await applyWorkspaceMutation(() =>
      renameWorkspaceItem(workspaceSnapshot.workspace.rootPath, { sourcePath: relativePath, newName }),
    );
  }

  async function handleDeleteWorkspaceItem(relativePath: string) {
    if (!workspaceSnapshot) return;
    await applyWorkspaceMutation(() =>
      deleteWorkspaceItem(workspaceSnapshot.workspace.rootPath, relativePath),
    );
  }

  // ── Editor handlers (Issue 4-A / 4-B) ─────────────────────────
  async function handleOpenFile(relativePath: string) {
    if (!workspaceSnapshot) return;
    await edOpenFile(workspaceSnapshot.workspace.rootPath, relativePath);
    // Expire preapplied diffs that belong to other files (no longer visible in editor).
    for (const diff of allDiffs) {
      if (diff.status === "preapplied" && diff.filePath !== relativePath) {
        expireDiff(diff);
      }
    }
  }

  async function handleSaveFile(tabId?: string) {
    // BR-DE-PERSIST-001: block save when active tab has a preapplied diff.
    const targetFilePath = tabId
      ? edTabs.find((t) => t.id === tabId)?.filePath
      : activeFilePath;
    const hasPreapplied = targetFilePath &&
      allDiffs.some((d) => d.filePath === targetFilePath && d.status === "preapplied");
    if (hasPreapplied) {
      setShowPreappliedSaveDialog(true);
      return;
    }
    await edSaveFile(tabId);
  }

  function handleEditorChange(content: string) {
    edSetContent(content);
    // BR-DE-STATE-012: expire preapplied diffs whose applied newText is no longer present.
    // Deletion diffs have newText="", so any subsequent user edit invalidates the preapplied anchor.
    //
    // NOTE: diffStore.getAllDiffs() is used here instead of the `allDiffs` React snapshot.
    // handleEditorChange can be called synchronously from inside TipTap's onUpdate during
    // edApplyDiffReplaceInTab (e.g. during rejectDiff). At that point the React snapshot is
    // stale — it still shows `preapplied` for a diff whose actor has already transitioned to
    // `rejecting` (actor subscriber updates cachedAllDiffs synchronously). Reading from the
    // store directly prevents a spurious expireDiff() call that would stop the actor before
    // rejectDiff sends TERMINAL_RECORDED, producing a XState warning and a duplicate terminal card.
    for (const diff of diffStore.getAllDiffs()) {
      if (diff.status === "preapplied" && diff.filePath === activeFilePath) {
        if (!diff.newText || !content.includes(diff.newText)) {
          expireDiff(diff);
        }
      }
    }
  }

  function handleTabDiscard(tabId: string) {
    // BR-DE-STATE-014: if this tab has a preapplied diff, require explicit decision.
    const tab = edTabs.find((t) => t.id === tabId);
    const hasPreapplied = tab?.filePath &&
      allDiffs.some((d) => d.filePath === tab.filePath && d.status === "preapplied");
    if (hasPreapplied) {
      setPreappliedCloseTabId(tabId);
      return;
    }
    edCloseTab(tabId);
  }

  async function handleTabSaveAndClose(tabId: string) {
    const tab = edTabs.find((t) => t.id === tabId);
    if (!tab) return;
    if (tabId !== edActiveTabId) {
      edSwitchTab(tabId);
    }
    await edSaveFile(tabId);
    edCloseTab(tabId);
  }

  function handleTabRejectAndClose(tabId: string) {
    const tab = edTabs.find((t) => t.id === tabId);
    if (tab) {
      for (const diff of allDiffs) {
        if (diff.filePath === tab.filePath && diff.status === "preapplied") {
          if (!rejectDiff(diff)) {
            return;
          }
        }
      }
    }
    edCloseTab(tabId);
    setPreappliedCloseTabId(null);
  }

  function handleTabAcceptAndClose(tabId: string) {
    const tab = edTabs.find((t) => t.id === tabId);
    if (tab) {
      for (const diff of allDiffs) {
        if (diff.filePath === tab.filePath && diff.status === "preapplied") {
          acceptDiff(diff);
        }
      }
    }
    edCloseTab(tabId);
    setPreappliedCloseTabId(null);
  }

  async function handleAcceptAllAndSave() {
    if (activeFilePath) {
      for (const diff of allDiffs) {
        if (diff.filePath === activeFilePath && diff.status === "preapplied") {
          acceptDiff(diff);
        }
      }
    }
    setShowPreappliedSaveDialog(false);
    await edSaveFile();
  }

  // ── Diff lifecycle helpers (drive diffMachine + diffStore) ─────

  /** BR-DE-STATE-003 / BR-DE-STATE-012 / BR-DE-STATE-013: move diff to expired terminal. */
  function expireDiff(diff: PendingDiff) {
    diffStore.getDiffActor(diff.id)?.send({ type: "EXPIRE_REQUESTED" });
    persistDiffStatus(diff.id, "expired");
    diffStore.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "expired", diff.sourceToolId));
  }

  /**
   * BR-DE-STATE-010 / BR-DE-STATE-011: Accept open-file diff.
   * Content is already in LogicalState (PM applied). Confirm without writing DiskState.
   * File remains dirty until user saves explicitly.
   */
  function acceptDiff(diff: PendingDiff) {
    const actor = diffStore.getDiffActor(diff.id);
    actor?.send({ type: "ACCEPT_REQUESTED" });
    actor?.send({ type: "ACCEPT_CONFIRMED" });
    persistDiffStatus(diff.id, "accepted");
    diffStore.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "accepted", diff.sourceToolId));
  }

  /**
   * BR-DE-STATE-002: Reject open-file diff.
   * Reverts LogicalState by re-applying inverse replace (newText → originalText).
   */
  function rejectDiff(diff: PendingDiff): boolean {
    const actor = diffStore.getDiffActor(diff.id);
    actor?.send({ type: "REJECT_REQUESTED" });
    const tabId = edTabs.find((t) => t.filePath === diff.filePath)?.id;
    const result = tabId
      ? edApplyDiffReplaceInTab(tabId, diff.newText, diff.originalText)
      : { success: false as const, reason: "text-not-found" as const };
    if (!result.success) {
      actor?.send({ type: "FAILED" });
      persistDiffStatus(diff.id, "error");
      diffStore.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "error", diff.sourceToolId));
      return false;
    }
    actor?.send({ type: "TERMINAL_RECORDED" });
    persistDiffStatus(diff.id, "rejected");
    diffStore.moveToTerminal(diff.id, createTerminalDiffCard(diff.id, "rejected", diff.sourceToolId));
    return true;
  }

  function persistDiffStatus(diffId: string, status: PendingDiffStatus) {
    const root = workspaceSnapshot?.workspace.rootPath;
    if (root) void updateDiffStatus(root, diffId, status);
  }

  function handleAcceptDiffById(diffId: string) {
    const diff = diffStore.getDiff(diffId);
    if (diff && diff.status === "preapplied") acceptDiff(diff);
  }

  function handleRejectDiffById(diffId: string) {
    const diff = diffStore.getDiff(diffId);
    if (diff && diff.status === "preapplied") rejectDiff(diff);
  }

  function appendInputReference(reference: InputReference) {
    setInputReferences((current) => [...current, reference]);
  }

  function handleRemoveReference(index: number) {
    setInputReferences((current) => current.filter((_, i) => i !== index));
  }

  function handleCreateTextReference(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    appendInputReference({
      id: `ref-text-${Date.now()}`,
      kind: "text",
      content,
      displayName: summarizeReferenceText(trimmed),
      createdAt: Date.now(),
    });
  }

  function handleCreateUrlReference(url: string) {
    const trimmed = url.trim();
    if (!/^https?:\/\/\S+$/i.test(trimmed)) {
      handleCreateTextReference(url);
      return;
    }
    appendInputReference({
      id: `ref-url-${Date.now()}`,
      kind: "url",
      url: trimmed,
      displayName: trimmed,
      createdAt: Date.now(),
    });
  }

  // ── Agent / Chat handlers (Issue 5-A / 5-B / 5-C) ────────────
  async function handleSendAgentMessage(userContent: string) {
    await chatSendMessage(
      userContent,
      providerConfig.provider,
      providerConfig.model,
      providerConfig.apiKeyConfigured,
      {
        activeFilePath: activeFilePath ?? undefined,
        activeFileMode,
        activeFileDirty,
        pendingDiffCount: activeFilePendingDiffCount,
        activeFileLogicalStateSnapshot,
        activeFileSnapshotTruncated,
        documentStructure:
          activeFilePath && activeFileMode === "editable"
            ? (extractDocumentStructure(activeFilePath) ?? undefined)
            : undefined,
      },
      inputReferences,
    );
  }

  function handleCancelMessage() {
    chatCancelMessage();
    for (const diff of allDiffs) {
      if (diff.status === "preapplied") {
        rejectDiff(diff);
      }
    }
  }

  function handleRetryMessage() {
    chatRetryMessage();
  }

  // ── Diff card data mapping (all live + terminal) ───────────────
  // BR-DE-UI-003: sourceToolId is included so MessageList can group DiffCards
  // by AgentMessage.toolCallId === diff.sourceToolId for inline rendering.
  const diffEntries = [
    ...allDiffs.map((d) => ({
      diffId: d.id,
      filePath: d.filePath,
      originalText: d.originalText,
      newText: d.newText,
      status: d.status as PendingDiffStatus,
      sourceToolId: d.sourceToolId,
    })),
    ...terminalDiffCards.map((tc) => ({
      diffId: tc.diffId,
      filePath: "",
      originalText: "",
      newText: tc.message,
      status: tc.status as PendingDiffStatus,
      sourceToolId: tc.sourceToolId,
    })),
  ];

  // BR-DE-UI-003: batch accept/reject all pending/preapplied diffs.
  // Each diff is processed independently; failure of one does not block others.
  function handleAcceptAllDiffs() {
    for (const d of allDiffs) {
      if (d.status === "pending" || d.status === "preapplied") {
        acceptDiff(d);
      }
    }
  }

  function handleRejectAllDiffs() {
    for (const d of allDiffs) {
      if (d.status === "pending" || d.status === "preapplied") {
        rejectDiff(d);
      }
    }
  }

  // chatMessages is already AgentMessage[] from useChatActor (chatMachine type)

  // ── Tab list mapping ───────────────────────────────────────────
  const editorTabs = edTabs.map((t) => ({
    id: t.id,
    filePath: t.filePath,
    dirty: t.dirty,
  }));

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
      <MainLayout
        leftPanel={
          <FileTreePanel
            workspaceState={workspacePanelState()}
            displayName={workspaceSnapshot?.workspace.displayName}
            rootPath={workspaceSnapshot?.workspace.rootPath}
            entries={effectiveEntries}
            recentWorkspaces={recentWorkspaces}
            errorMessage={wsValue === "Error"
              ? (wsActor.getSnapshot().context.errorMessage ?? "加载失败")
              : undefined}
            conflictError={conflictError}
            searchQuery={searchQuery}
            searchResults={searchResults}
            onSearchQueryChange={(q) =>
              handleSearchQueryChange(q, workspaceSnapshot?.workspace.rootPath ?? null, isActive)
            }
            onSearchResultClick={(filePath) => void handleOpenFile(filePath)}
            onOpenWorkspace={handleOpenWorkspace}
            onCloseWorkspace={handleCloseWorkspaceWithGuard}
            onFileClick={(relativePath) => void handleOpenFile(relativePath)}
            onRetry={handleOpenWorkspace}
            onCreateFile={(parentPath, name) =>
              handleCreateWorkspaceItem("file", parentPath, name)
            }
            onCreateFolder={(parentPath, name) =>
              handleCreateWorkspaceItem("folder", parentPath, name)
            }
            onRename={handleRenameWorkspaceItem}
            onDelete={handleDeleteWorkspaceItem}
          />
        }
        centerPanel={
          <EditorColumn
            stateName={editorStateName()}
            tabs={editorTabs}
            activeTabId={edActiveTabId}
            content={activeContent}
            fileType={activeFileType}
            appliedRange={activePreappliedDiff?.appliedRange ?? null}
            errorMessage={edErrorMessage}
            preappliedTabIds={preappliedTabIds}
            onTabClick={(tabId) => edSwitchTab(tabId)}
            onTabDiscard={handleTabDiscard}
            onTabSaveAndClose={(tabId) => void handleTabSaveAndClose(tabId)}
            onTabRejectAndClose={handleTabRejectAndClose}
            onTabAcceptAndClose={(tabId) => void handleTabAcceptAndClose(tabId)}
            onChange={handleEditorChange}
            onSave={() => void handleSaveFile()}
            onAcceptAllAndSave={() => void handleAcceptAllAndSave()}
          />
        }
        rightPanel={
          <ChatPanel
            stateName={chatStateName()}
            messages={chatMessages}
            streamingContent={chatStreamingContent}
            inputReferences={inputReferences}
            diffs={diffEntries}
            providerConfig={providerConfig}
            errorMessage={chatErrorMessage}
            referenceError={referenceError}
            onSend={(content) => void handleSendAgentMessage(content)}
            onCancel={handleCancelMessage}
            onRetry={handleRetryMessage}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onSaveApiKey={(key) => {
              // BR-AG-SEC-001 / BR-AG-PERSIST-002: API key sent to Rust backend only;
              // raw key never stored in React state and persists in backend app config.
              void saveApiKey(providerConfig.provider, key).then(() =>
                isApiKeyConfigured(providerConfig.provider).then((configured) =>
                  setProviderConfig((c) => ({ ...c, apiKeyConfigured: configured })),
                ),
              );
            }}
            onRemoveReference={handleRemoveReference}
            onCreateTextReference={handleCreateTextReference}
            onCreateUrlReference={handleCreateUrlReference}
            onAcceptDiff={(diffId) => handleAcceptDiffById(diffId)}
            onRejectDiff={(diffId) => handleRejectDiffById(diffId)}
            onAcceptAll={handleAcceptAllDiffs}
            onRejectAll={handleRejectAllDiffs}
          />
        }
      />

      {showCloseGuard && (
        <WorkspaceCloseGuardDialog
          onCancel={handleCancelClose}
          onConfirm={handleForceCloseWorkspace}
        />
      )}

      {showPreappliedSaveDialog && (
        <PreappliedSaveDialog
          onCancel={() => setShowPreappliedSaveDialog(false)}
          onAcceptAllAndSave={() => void handleAcceptAllAndSave()}
        />
      )}

      {preappliedCloseTabId && (
        <PreappliedTabCloseDialog
          filePath={edTabs.find((t) => t.id === preappliedCloseTabId)?.filePath ?? ""}
          onCancelClose={() => setPreappliedCloseTabId(null)}
          onRejectAndClose={() => handleTabRejectAndClose(preappliedCloseTabId)}
          onAcceptAndClose={() => handleTabAcceptAndClose(preappliedCloseTabId)}
        />
      )}
    </>
  );
}

function summarizeReferenceText(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 40 ? `${oneLine.slice(0, 40)}...` : oneLine;
}
