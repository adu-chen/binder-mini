/**
 * @GOV
 * codes: BR-ED-STATE-003
 * type: RB
 * chain: ED-OPEN-FILE
 * rules: BR-ED-STATE-003
 * boundary: in=dirty EditorTab close request with filePath | out=DirtyTabCloseDialog modal with discard and save-and-close actions
 * term_ref: TERM-ED-001, TERM-ED-003
 */

interface DirtyTabCloseDialogProps {
  filePath: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAndClose: () => void;
}

export function DirtyTabCloseDialog({
  filePath,
  onCancel,
  onDiscard,
  onSaveAndClose,
}: DirtyTabCloseDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h2 className="dialog-title">关闭未保存文件</h2>
        <p className="dialog-body">{filePath} 有未保存的修改。</p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-ghost" onClick={onDiscard}>
            放弃修改并关闭
          </button>
          <button className="btn btn-primary" onClick={onSaveAndClose}>
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  );
}
