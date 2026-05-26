/**
 * @GOV
 * codes: BR-DE-PERSIST-001
 * type: RB
 * chain: ED-SAVE-FILE
 * rules: BR-DE-PERSIST-001
 * boundary: in=Cmd+S event with preapplied PendingDiff present in active EditorTab | out=PreappliedSaveDialog modal prompting user to accept all diffs before saving
 * term_ref: TERM-DE-001, TERM-ED-001
 */

interface PreappliedSaveDialogProps {
  onCancel: () => void;
  onAcceptAllAndSave: () => void;
}

export function PreappliedSaveDialog({
  onCancel,
  onAcceptAllAndSave,
}: PreappliedSaveDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h2 className="dialog-title">当前文件有待审阅的 AI 修改</h2>
        <p className="dialog-body">
          保存前建议先处理 AI 生成的修改建议。
        </p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-primary" onClick={onAcceptAllAndSave}>
            接受所有修改后保存
          </button>
        </div>
      </div>
    </div>
  );
}
