/**
 * @GOV
 * codes: BR-WS-STATE-003
 * type: RB
 * chain: WS-CLOSE
 * rules: BR-WS-STATE-003
 * boundary: in=WorkspaceMachine CLOSE_WORKSPACE event with dirty EditorTab list or pending PendingDiff list | out=WorkspaceCloseGuardDialog modal requiring explicit confirmation before workspace teardown
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-DE-001, TERM-ED-001
 */

interface WorkspaceCloseGuardDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function WorkspaceCloseGuardDialog({
  onCancel,
  onConfirm,
}: WorkspaceCloseGuardDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h2 className="dialog-title">确认关闭 Workspace</h2>
        <p className="dialog-body">
          当前有未保存的编辑或待处理的 AI 修改建议，关闭后这些内容将丢失。
        </p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            确认关闭
          </button>
        </div>
      </div>
    </div>
  );
}
