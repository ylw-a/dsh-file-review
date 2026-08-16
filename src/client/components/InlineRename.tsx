// 行内输入框：树节点重命名 / 新建文件 / 新建文件夹共用。
// Enter 提交，Escape 取消，失焦取消（点击菜单项时 onMouseDown preventDefault 挡住 blur）。
export interface InlineInputProps {
  className: string
  placeholder?: string
  value: string
  onChange(v: string): void
  onCommit(): void
  onCancel(): void
}

export function InlineInput({ className, placeholder, value, onChange, onCommit, onCancel }: InlineInputProps) {
  return (
    <input
      className={className}
      autoFocus
      placeholder={placeholder}
      value={value}
      spellCheck={false}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit()
        else if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
    />
  )
}
