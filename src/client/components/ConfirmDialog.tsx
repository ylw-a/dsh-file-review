// 面板内确认弹窗（删除确认 / 未保存关闭确认共用）。点遮罩取消。
export interface ConfirmButton {
  label: string
  danger?: boolean
  onClick(): void
}

export interface ConfirmDialogProps {
  title: string
  message: string
  buttons: ConfirmButton[]
  onCancel(): void
}

export function ConfirmDialog({ title, message, buttons, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fe-confirm-capture" onClick={onCancel}>
      <div className="fe-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="fe-confirm-title">{title}</div>
        <div className="fe-confirm-msg">{message}</div>
        <div className="fe-confirm-actions">
          {buttons.map((b) => (
            <button
              key={b.label}
              className={'fe-btn' + (b.danger ? ' fe-btn-danger' : '')}
              onClick={b.onClick}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
