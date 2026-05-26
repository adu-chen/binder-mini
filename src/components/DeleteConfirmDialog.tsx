/**
 * @GOV
 * codes: BR-WS-DATA-003
 * type: RB
 * chain: WS-FILE-MANAGE
 * rules: BR-WS-DATA-003
 * boundary: in=FileNode filePath to be deleted | out=DeleteConfirmDialog modal requiring explicit user confirmation before delete_workspace_item IPC is called
 * term_ref: TERM-WS-001
 */

interface DeleteConfirmDialogProps {
  filePath: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  filePath,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h2 className="dialog-title">确认删除</h2>
        <p className="dialog-body">
          {filePath} 将被永久删除，无法恢复。
        </p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
