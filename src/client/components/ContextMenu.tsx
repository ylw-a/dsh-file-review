// 右键菜单：纯展示，动作列表由调用方按条目类型构造，onAction 分发。
import type { ReactNode } from 'react'

export interface MenuAction {
  id: string
  label: string
  danger?: boolean
  /** 在此项之前插一条分隔线 */
  sep?: boolean
}

export interface ContextMenuProps {
  x: number
  y: number
  actions: MenuAction[]
  onAction(id: string): void
  onClose(): void
}

export function ContextMenu({ x, y, actions, onAction, onClose }: ContextMenuProps) {
  const items: ReactNode[] = []
  for (const a of actions) {
    if (a.sep) items.push(<div key={'sep-' + a.id} className="fe-menu-sep" />)
    items.push(
      <div
        key={a.id}
        className={'fe-menu-item' + (a.danger ? ' fe-menu-item-danger' : '')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onAction(a.id)}
      >
        <span className="fe-menu-label">{a.label}</span>
      </div>,
    )
  }
  const estimatedHeight = actions.length * 27 + 12
  const left = Math.max(6, Math.min(x, window.innerWidth - 190))
  const top = Math.max(6, Math.min(y, window.innerHeight - estimatedHeight - 8))
  return (
    <div className="fe-overlay-root">
      <div
        className="fe-menu-capture"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div className="fe-menu" style={{ left: left + 'px', top: top + 'px' }}>{items}</div>
    </div>
  )
}
