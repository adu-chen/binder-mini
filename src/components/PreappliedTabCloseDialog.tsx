/**
 * @GOV
 * codes: BR-DE-STATE-014
 * type: RB
 * chain: DE-ACCEPT-DIFF, DE-REJECT-DIFF
 * rules: BR-DE-STATE-014
 * boundary: in=EditorTab close request with preapplied PendingDiff present | out=PreappliedTabCloseDialog three-option modal for reject-and-close or accept-and-close
 * term_ref: TERM-DE-001, TERM-ED-001
 */

interface PreappliedTabCloseDialogProps {
  filePath: string;
  onCancelClose: () => void;
  onRejectAndClose: () => void;
  onAcceptAndClose: () => void;
}

export function PreappliedTabCloseDialog({
  filePath,
  onCancelClose,
  onRejectAndClose,
  onAcceptAndClose,
}: PreappliedTabCloseDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h2 className="dialog-title">{filePath} 有 AI 修改待处理</h2>
        <p className="dialog-body">
          关闭前请选择如何处理编辑器中的 AI 修改建议。
        </p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancelClose}>
            取消关闭
          </button>
          <button className="btn btn-ghost" onClick={onRejectAndClose}>
            拒绝修改并关闭
          </button>
          <button className="btn btn-primary" onClick={onAcceptAndClose}>
            接受修改并关闭
          </button>
        </div>
      </div>
    </div>
  );
}
