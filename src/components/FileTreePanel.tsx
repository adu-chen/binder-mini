import { useState, useEffect, useRef } from "react";
import type { RecentWorkspace, WorkspaceEntry } from "../types/workspace";
import type { SearchResult } from "../types/agent";
import { FileTree } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

/**
 * @GOV
 * codes: BR-SYS-UI-001, BR-WS-STATE-003, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004, BR-AG-TOOL-001
 * type: RB
 * chain: WS-OPEN, WS-CLOSE, WS-FILE-MANAGE
 * rules: BR-SYS-UI-001, BR-WS-STATE-003, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004, BR-AG-TOOL-001
 * boundary: in=workspaceMachine Active state snapshot and FileNode tree | out=FileTreePanel with file management actions; DeleteConfirmDialog guarding delete_workspace_item; PathConflict banner with 3s auto-dismiss
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-WS-004, TERM-WS-005
 */

type WorkspacePanelState = "NoWorkspace" | "Loading" | "Active" | "Closing" | "Error";

interface FileTreePanelProps {
  workspaceState: WorkspacePanelState;
  displayName?: string;
  rootPath?: string;
  entries?: WorkspaceEntry[];
  recentWorkspaces?: RecentWorkspace[];
  errorMessage?: string;
  /** PathConflict error shown as a short banner above the file tree (3s auto-dismiss). */
  conflictError?: string | null;
  searchQuery: string;
  searchResults: SearchResult[];
  onSearchQueryChange: (q: string) => void;
  onSearchResultClick: (filePath: string) => void;
  onOpenWorkspace: () => void;
  onCloseWorkspace: () => void;
  onFileClick: (relativePath: string) => void;
  onRetry?: () => void;
  // Phase 3-D: file management
  onCreateFile?: (parentRelativePath: string, name: string) => Promise<void>;
  onCreateFolder?: (parentRelativePath: string, name: string) => Promise<void>;
  onRename?: (relativePath: string, newName: string) => Promise<void>;
  onDelete?: (relativePath: string) => Promise<void>;
}

export function FileTreePanel({
  workspaceState,
  displayName = "",
  rootPath = "",
  entries = [],
  recentWorkspaces = [],
  errorMessage,
  conflictError,
  searchQuery,
  searchResults,
  onSearchQueryChange,
  onSearchResultClick,
  onOpenWorkspace,
  onCloseWorkspace,
  onFileClick,
  onRetry,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: FileTreePanelProps) {
  // DeleteConfirmDialog state — managed at panel level for proper modal overlay
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // PathConflict error banner auto-dismiss (BR-WS-DATA-002)
  const conflictTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localConflictError, setLocalConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (conflictError) {
      setLocalConflictError(conflictError);
      if (conflictTimeoutRef.current) clearTimeout(conflictTimeoutRef.current);
      conflictTimeoutRef.current = setTimeout(() => setLocalConflictError(null), 3000);
    }
  }, [conflictError]);

  async function handleDeleteConfirm() {
    if (!deleteTarget || !onDelete) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await onDelete(target);
    } catch {
      // Error handled via conflictError prop from App.tsx
    }
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* NoWorkspace: 打开入口 + 最近列表 */}
      {workspaceState === "NoWorkspace" && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={onOpenWorkspace}
            style={{ width: "100%" }}
          >
            打开 Workspace
          </button>
          {recentWorkspaces.length > 0 && (
            <div>
              <div
                style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6 }}
              >
                最近打开
              </div>
              {recentWorkspaces.map((ws) => (
                <button
                  key={ws.rootPath}
                  onClick={onOpenWorkspace}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "5px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "none";
                  }}
                >
                  <div style={{ color: "var(--text-primary)" }}>{ws.displayName}</div>
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ws.rootPath}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading: skeleton */}
      {workspaceState === "Loading" && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {[70, 50, 85, 60, 40].map((w, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 14, width: `${w}%` }}
            />
          ))}
        </div>
      )}

      {/* Active: 正常文件树 */}
      {workspaceState === "Active" && (
        <>
          <WorkspaceHeader
            displayName={displayName}
            rootPath={rootPath}
            onCloseRequest={onCloseWorkspace}
          />

          {/* PathConflict error banner (BR-WS-DATA-002, BR-AG-TOOL-001) */}
          {localConflictError && (
            <div
              style={{
                padding: "4px 12px",
                background: "var(--bg-elevated)",
                borderBottom: "1px solid var(--danger)",
                color: "var(--danger)",
                fontSize: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span>{localConflictError}</span>
              <button
                onClick={() => setLocalConflictError(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--danger)",
                  cursor: "pointer",
                  padding: "0 4px",
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            </div>
          )}

          <SearchPanel
            query={searchQuery}
            onQueryChange={onSearchQueryChange}
            results={searchResults}
            onResultClick={onSearchResultClick}
          />
          <div style={{ flex: 1, overflowY: "auto" }}>
            <FileTree
              entries={entries}
              onFileClick={onFileClick}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onRename={onRename}
              onDeleteRequest={onDelete ? (path) => setDeleteTarget(path) : undefined}
            />
          </div>
        </>
      )}

      {/* DeleteConfirmDialog — rendered at panel level for fixed modal overlay (BR-WS-DATA-003) */}
      {deleteTarget !== null && (
        <DeleteConfirmDialog
          filePath={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDeleteConfirm()}
        />
      )}

      {/* Closing: 不可操作 */}
      {workspaceState === "Closing" && (
        <div
          style={{
            padding: 16,
            color: "var(--text-muted)",
            pointerEvents: "none",
            opacity: 0.6,
          }}
        >
          关闭中…
        </div>
      )}

      {/* Error: 错误 + 重试 */}
      {workspaceState === "Error" && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ color: "var(--danger)", fontSize: 13 }}>
            {errorMessage ?? "加载失败"}
          </p>
          <button className="btn btn-ghost" onClick={onRetry ?? onOpenWorkspace}>
            重试
          </button>
        </div>
      )}
    </div>
  );
}
