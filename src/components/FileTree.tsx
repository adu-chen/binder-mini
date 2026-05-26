import { useState, useRef } from "react";
import type { WorkspaceEntry } from "../types/workspace";

/**
 * @GOV
 * codes: BR-WS-DATA-001, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004, BR-AG-TOOL-001
 * type: RB
 * chain: WS-FILE-MANAGE, ED-OPEN-FILE
 * rules: BR-WS-DATA-001, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004, BR-AG-TOOL-001
 * boundary: in=WorkspaceEntry list and workspace root path | out=FileNode recursive tree with inline create/rename and DeleteConfirmDialog guarding delete operations; PathConflict surfaced as error banner
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-WS-004, TERM-WS-005
 */

interface FileTreeProps {
  entries: WorkspaceEntry[];
  onFileClick: (relativePath: string) => void;
  depth?: number;
  // Phase 3-D: file management callbacks
  onCreateFile?: (parentRelativePath: string, name: string) => Promise<void>;
  onCreateFolder?: (parentRelativePath: string, name: string) => Promise<void>;
  onRename?: (relativePath: string, newName: string) => Promise<void>;
  onDeleteRequest?: (relativePath: string) => void;
}

export function FileTree({
  entries,
  onFileClick,
  depth = 0,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDeleteRequest,
}: FileTreeProps) {
  return (
    <div>
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.relativePath}
          entry={entry}
          onFileClick={onFileClick}
          depth={depth}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onDeleteRequest={onDeleteRequest}
        />
      ))}
    </div>
  );
}

type InlineMode = "create-file" | "create-folder" | "rename" | null;

function FileTreeNode({
  entry,
  onFileClick,
  depth,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDeleteRequest,
}: {
  entry: WorkspaceEntry;
  onFileClick: (path: string) => void;
  depth: number;
  onCreateFile?: (parentRelativePath: string, name: string) => Promise<void>;
  onCreateFolder?: (parentRelativePath: string, name: string) => Promise<void>;
  onRename?: (relativePath: string, newName: string) => Promise<void>;
  onDeleteRequest?: (relativePath: string) => void;
}) {
  const indent = depth * 12 + 12;
  const icon = entry.kind === "directory" ? "📁" : fileIcon(entry.name);

  const [isHovered, setIsHovered] = useState(false);
  const [inlineMode, setInlineMode] = useState<InlineMode>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  function openInlineMode(mode: InlineMode, initialValue = "") {
    setInlineMode(mode);
    setInlineValue(initialValue);
    setInlineError(null);
    // Focus is handled via autoFocus on the input element
  }

  function cancelInline() {
    setInlineMode(null);
    setInlineValue("");
    setInlineError(null);
  }

  async function commitInline() {
    const trimmed = inlineValue.trim();
    if (!trimmed || isBusy) return;
    setIsBusy(true);
    setInlineError(null);
    try {
      if (inlineMode === "create-file" && onCreateFile) {
        await onCreateFile(entry.relativePath, trimmed);
      } else if (inlineMode === "create-folder" && onCreateFolder) {
        await onCreateFolder(entry.relativePath, trimmed);
      } else if (inlineMode === "rename" && onRename) {
        await onRename(entry.relativePath, trimmed);
      }
      cancelInline();
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setIsBusy(false);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitInline();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelInline();
    }
  }

  const actionBtnStyle: React.CSSProperties = {
    padding: "1px 4px",
    fontSize: 11,
    color: "var(--text-muted)",
    background: "none",
    border: "none",
    cursor: "pointer",
    borderRadius: 3,
    flexShrink: 0,
  };

  const inlineInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "2px 4px",
    fontSize: 12,
    background: "var(--bg-base)",
    border: inlineError ? "1px solid var(--danger)" : "1px solid var(--accent)",
    borderRadius: 3,
    color: "var(--text-primary)",
    outline: "none",
  };

  // Inline input row shown for create/rename
  const inlineInput = inlineMode !== null && (
    <div style={{ paddingLeft: inlineMode === "rename" ? indent : indent + 12, paddingRight: 4, paddingBottom: 2 }}>
      <input
        ref={inputRef}
        autoFocus
        value={inlineValue}
        onChange={(e) => setInlineValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        onBlur={() => { if (!isBusy) cancelInline(); }}
        style={inlineInputStyle}
        placeholder={inlineMode === "rename" ? "新名称" : inlineMode === "create-file" ? "文件名" : "文件夹名"}
      />
      {inlineError && (
        <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 2 }}>
          {inlineError}
        </div>
      )}
    </div>
  );

  if (entry.kind === "directory") {
    return (
      <div>
        {inlineMode === "rename" ? (
          inlineInput
        ) : (
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 4px 3px 0",
              paddingLeft: indent,
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "default",
              background: isHovered ? "var(--bg-hover)" : "none",
            }}
          >
            <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.name}
            </span>
            {isHovered && (
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                {onCreateFile && (
                  <button
                    style={actionBtnStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                    onClick={(e) => { e.stopPropagation(); openInlineMode("create-file"); }}
                    title="新建文件"
                  >
                    +f
                  </button>
                )}
                {onCreateFolder && (
                  <button
                    style={actionBtnStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                    onClick={(e) => { e.stopPropagation(); openInlineMode("create-folder"); }}
                    title="新建文件夹"
                  >
                    +d
                  </button>
                )}
                {onRename && (
                  <button
                    style={actionBtnStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                    onClick={(e) => { e.stopPropagation(); openInlineMode("rename", entry.name); }}
                    title="重命名"
                  >
                    ✎
                  </button>
                )}
                {onDeleteRequest && (
                  <button
                    style={actionBtnStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                    onClick={(e) => { e.stopPropagation(); onDeleteRequest(entry.relativePath); }}
                    title="删除"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inline create input appears below directory header, before children */}
        {(inlineMode === "create-file" || inlineMode === "create-folder") && inlineInput}

        {entry.children && entry.children.length > 0 && (
          <FileTree
            entries={entry.children}
            onFileClick={onFileClick}
            depth={depth + 1}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onRename={onRename}
            onDeleteRequest={onDeleteRequest}
          />
        )}
      </div>
    );
  }

  // File node
  return (
    <div>
      {inlineMode === "rename" ? (
        inlineInput
      ) : (
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ position: "relative" }}
        >
          <button
            onClick={() => onFileClick(entry.relativePath)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              width: "100%",
              padding: "3px 4px 3px 0",
              paddingLeft: indent,
              textAlign: "left",
              fontSize: 13,
              color: "var(--text-primary)",
              borderRadius: 0,
              background: isHovered ? "var(--bg-hover)" : "none",
            }}
          >
            <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.name}
            </span>
            {isHovered && (
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                {onRename && (
                  <span
                    role="button"
                    tabIndex={0}
                    style={actionBtnStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                    onClick={(e) => { e.stopPropagation(); openInlineMode("rename", entry.name); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openInlineMode("rename", entry.name); } }}
                    title="重命名"
                  >
                    ✎
                  </span>
                )}
                {onDeleteRequest && (
                  <span
                    role="button"
                    tabIndex={0}
                    style={actionBtnStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                    onClick={(e) => { e.stopPropagation(); onDeleteRequest(entry.relativePath); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onDeleteRequest(entry.relativePath); } }}
                    title="删除"
                  >
                    ✕
                  </span>
                )}
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function fileIcon(name: string): string {
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".txt")) return "📄";
  return "📃";
}
