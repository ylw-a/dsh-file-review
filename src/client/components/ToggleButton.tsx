// 左下角开关按钮（sidebar.footer.action）。wide=false 时是 56px 窄栏的圆钮。
import { togglePanel, useStoreState } from '../store'
import { Icon } from './Icon'

export function ToggleButton(props: { wide?: boolean }) {
  const s = useStoreState()
  const rail = !props.wide
  return (
    <button
      type="button"
      className={'fe-foot' + (rail ? ' fe-foot-rail' : '')}
      data-active={s.panel.open || undefined}
      title="文件资源管理器"
      aria-label="文件资源管理器"
      aria-pressed={!!s.panel.open}
      onClick={togglePanel}
    >
      <span className="fe-foot-icon">
        <Icon name="files" size={rail ? 18 : 16} />
      </span>
      {rail ? null : <span className="fe-foot-label">文件</span>}
    </button>
  )
}
