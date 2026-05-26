/**
 * @GOV
 * codes: BR-ED-STATE-003, BR-ED-STATE-005, BR-ED-STATE-006, BR-DE-PERSIST-001, BR-DE-STATE-014, BR-DE-UI-002
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE, DE-ACCEPT-DIFF, DE-REJECT-DIFF
 * rules: BR-ED-STATE-003, BR-ED-STATE-005, BR-ED-STATE-006, BR-DE-PERSIST-001, BR-DE-STATE-014, BR-DE-UI-002
 * boundary: in=editorMachine state name, EditorTab list, active EditorTab content, and preapplied PendingDiff tab ids | out=EditorColumn rendering EditorTabs, EditorArea, EditorStatusBar, and conditional dialog overlays
 * term_ref: TERM-ED-001, TERM-ED-003, TERM-DE-001
 */

import { useState } from "react";
import { EditorTabs } from "./EditorTabs";
import { EditorArea } from "./EditorArea";
import { EditorStatusBar } from "./EditorStatusBar";
import { DirtyTabCloseDialog } from "./DirtyTabCloseDialog";
import { PreappliedSaveDialog } from "./PreappliedSaveDialog";
import { PreappliedTabCloseDialog } from "./PreappliedTabCloseDialog";

type EditorStateName =
  | "noWorkspace"
  | "idle"
  | "loading"
  | "editing"
  | "dirty"
  | "saving"
  | "readonly"
  | "error";

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

interface EditorTabItem {
  id: string;
  filePath: string;
  dirty: boolean;
}

interface AppliedRange {
  from: number;
  to: number;
}

interface EditorColumnProps {
  stateName: EditorStateName;
  tabs: EditorTabItem[];
  activeTabId: string | null;
  content: string;
  fileType?: "md" | "txt" | "other";
  appliedRange: AppliedRange | null;
  errorMessage: string | null;
  preappliedTabIds: ReadonlySet<string>;
  onTabClick: (tabId: string) => void;
  onTabDiscard: (tabId: string) => void;
  onTabSaveAndClose: (tabId: string) => void;
  onTabRejectAndClose: (tabId: string) => void;
  onTabAcceptAndClose: (tabId: string) => void;
  onChange: (content: string) => void;
  onSave: () => void;
  onAcceptAllAndSave: () => void;
}

type PendingClose =
  | { kind: "dirty"; tabId: string; filePath: string }
  | { kind: "preapplied"; tabId: string; filePath: string };

function deriveSaveStatus(stateName: EditorStateName): SaveStatus {
  if (stateName === "dirty") return "unsaved";
  if (stateName === "saving") return "saving";
  if (stateName === "error") return "error";
  return "saved";
}

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export function EditorColumn({
  stateName,
  tabs,
  activeTabId,
  content,
  fileType,
  appliedRange,
  errorMessage,
  preappliedTabIds,
  onTabClick,
  onTabDiscard,
  onTabSaveAndClose,
  onTabRejectAndClose,
  onTabAcceptAndClose,
  onChange,
  onSave,
  onAcceptAllAndSave,
}: EditorColumnProps) {
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);
  const [showPreappliedSave, setShowPreappliedSave] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const saveStatus = deriveSaveStatus(stateName);
  const wordCount = countWords(content);

  function handleTabClose(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (preappliedTabIds.has(tabId)) {
      setPendingClose({ kind: "preapplied", tabId, filePath: tab.filePath });
      return;
    }
    if (tab.dirty) {
      setPendingClose({ kind: "dirty", tabId, filePath: tab.filePath });
      return;
    }
    onTabDiscard(tabId);
  }

  function handleSaveKey() {
    if (activeTabId && preappliedTabIds.has(activeTabId)) {
      setShowPreappliedSave(true);
      return;
    }
    onSave();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      handleSaveKey();
    }
  }

  return (
    <div
      style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={onTabClick}
        onTabClose={handleTabClose}
      />

      <EditorArea
        stateName={stateName}
        filePath={activeTab?.filePath ?? null}
        content={content}
        fileType={fileType}
        appliedRange={appliedRange}
        errorMessage={errorMessage}
        onChange={onChange}
      />

      {activeTab && (
        <EditorStatusBar
          filePath={activeTab.filePath}
          saveStatus={saveStatus}
          wordCount={wordCount}
        />
      )}

      {pendingClose?.kind === "dirty" && (
        <DirtyTabCloseDialog
          filePath={pendingClose.filePath}
          onCancel={() => setPendingClose(null)}
          onDiscard={() => {
            const id = pendingClose.tabId;
            setPendingClose(null);
            onTabDiscard(id);
          }}
          onSaveAndClose={() => {
            const id = pendingClose.tabId;
            setPendingClose(null);
            onTabSaveAndClose(id);
          }}
        />
      )}

      {pendingClose?.kind === "preapplied" && (
        <PreappliedTabCloseDialog
          filePath={pendingClose.filePath}
          onCancelClose={() => setPendingClose(null)}
          onRejectAndClose={() => {
            const id = pendingClose.tabId;
            setPendingClose(null);
            onTabRejectAndClose(id);
          }}
          onAcceptAndClose={() => {
            const id = pendingClose.tabId;
            setPendingClose(null);
            onTabAcceptAndClose(id);
          }}
        />
      )}

      {showPreappliedSave && (
        <PreappliedSaveDialog
          onCancel={() => setShowPreappliedSave(false)}
          onAcceptAllAndSave={() => {
            setShowPreappliedSave(false);
            onAcceptAllAndSave();
          }}
        />
      )}
    </div>
  );
}
