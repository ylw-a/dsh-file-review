// 编辑器容器（页签栏 + 头部 + 编辑器主体）：float（无会话浮窗）与 fixed（「文件」父页签）共用。
// 状态全部在 store，切父页签 / 切文件页签不丢内容。
import type { CSSProperties, ReactNode } from 'react'
import {
  activateEditor,
  requestClose,
  requestCloseAll,
  resolvePendingClose,
  saveEditor,
  setEditorMode,
  useStoreState,
} from '../store'
import type { EditorState } from '../store'
import { isMarkdown } from '../languages'
import { fmtSize } from '../format'
import { Editor } from './Editor'
import { MarkdownView } from './MarkdownView'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'

export function EditorChrome({ floatMode }: { floatMode: boolean }) {
  const s = useStoreState()

  // 无会话时由浮窗承载；有会话标题栏后浮窗自动隐藏，交给固定「文件」页签。
  if (floatMode && (s.headerVisible || !s.editors.length)) return null
  if (!s.editors.length) {
    return (
      <div className="fe-editor-view">
        <div className="fe-editor-empty">双击左侧文件树中的文件以编辑</div>
      </div>
    )
  }
  const rect = s.columnRect
  if (!rect) return null

  const active = s.editors.find((ed) => ed.path === s.activeEditorPath) || null

  // 窗口几何：有会话列时扣除面板占用宽度，编辑器与侧栏并排不遮挡。
  let left = rect.left
  let right = rect.right
  if (s.hasColumn) {
    const shift = s.panel.width + 12
    if (s.panel.open && s.panel.side === 'right') right = Math.max(left + 1, right - shift)
    else if (s.panel.open && s.panel.side === 'left') left = Math.min(right - 1, left + shift)
  }
  const winStyle: CSSProperties = {
    left: left + 'px',
    right: window.innerWidth - right + 'px',
    top: rect.top + s.headerH + 'px',
    bottom: 0,
  }

  // 页签栏
  const tabs = (
    <div className="fe-editor-tabs">
      {s.editors.map((ed) => {
        const dirty = ed.content !== ed.savedContent
        return (
          <div
            key={ed.path}
            className="fe-editor-tab"
            data-active={ed.path === s.activeEditorPath || undefined}
            data-dirty={dirty || undefined}
            title={ed.path}
            onClick={() => activateEditor(ed.path)}
          >
            <span className="fe-editor-tab-name">{ed.name}</span>
            <button
              className="fe-tab-close"
              title="关闭"
              onClick={(e) => {
                e.stopPropagation()
                requestClose(ed.path)
              }}
            >
              {dirty ? <span className="fe-tab-dot" /> : <Icon name="close" size={12} />}
            </button>
          </div>
        )
      })}
      <button className="fe-tab-close-all" title="关闭全部" onClick={requestCloseAll}>
        <Icon name="close" size={14} />
      </button>
    </div>
  )

  // 头部：路径 + Markdown「渲染/编辑」切换 + 保存
  let head: ReactNode = null
  if (active) {
    const md = isMarkdown(active.name)
    head = (
      <div className="fe-editor-head">
        <span className="fe-editor-path">{active.path}</span>
        {active.state === 'ready' && md ? (
          <button
            className="fe-btn"
            onClick={() => setEditorMode(active.path, active.mode === 'render' ? 'source' : 'render')}
          >
            {active.mode === 'render' ? '编辑' : '渲染'}
          </button>
        ) : null}
        {active.state === 'ready' ? (
          <button className="fe-btn" onClick={() => saveEditor(active.path)}>保存</button>
        ) : null}
      </div>
    )
  }

  const pending = s.pendingClose
  return (
    <div className="fe-overlay-root">
      <div className="fe-editor-window" style={winStyle}>
        {tabs}
        {head}
        {s.editorStatus ? (
          <div className={'fe-status ' + (s.editorStatus.ok ? 'fe-status-ok' : 'fe-status-err')}>{s.editorStatus.text}</div>
        ) : null}
        {active ? renderEditorBody(active) : null}
      </div>
      {pending ? (
        <ConfirmDialog
          title="未保存的更改"
          message={`“${pending.name}” 有未保存的更改，关闭前要保存吗？`}
          buttons={[
            { label: '取消', onClick: () => resolvePendingClose('cancel') },
            { label: '不保存关闭', onClick: () => resolvePendingClose('discard') },
            { label: '保存并关闭', danger: true, onClick: () => resolvePendingClose('save') },
          ]}
          onCancel={() => resolvePendingClose('cancel')}
        />
      ) : null}
    </div>
  )
}

function renderEditorBody(active: EditorState): ReactNode {
  if (active.state === 'loading') return <div className="fe-editor-msg">加载中…</div>
  if (active.state === 'error') return <div className="fe-editor-msg fe-err">{active.message}</div>
  if (active.state === 'too-large') return <div className="fe-editor-msg">文件过大（{fmtSize(active.size)}），不支持编辑</div>
  if (isMarkdown(active.name) && active.mode === 'render') {
    return <MarkdownView key={active.path} content={active.content} />
  }
  return <Editor key={active.path} editor={active} />
}
