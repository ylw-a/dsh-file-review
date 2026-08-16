// 主面板：文件树 + 搜索 + 工具栏 + 右键菜单 + 删除确认 + 行内重命名/新建。
// 工作区根目录来自官方 slot 注入的 useSessions / useWorkspaces 钩子（全局标准套件）。
// 具体树节点渲染交给 FileTree / SearchResults；本组件只做组合与文件操作。
import { useEffect, useRef, useState } from 'react'
import {
  clearTree,
  closeEditor,
  initTree,
  loadChildren,
  openEditor,
  refreshTree,
  reloadParent,
  renameEditorPath,
  selectFile,
  setClipboard,
  setPanelOpen,
  setPanelWidth,
  setQuery,
  toggleDir,
  toggleExpandAll,
  togglePanelSide,
  useStoreState,
} from '../store'
import { api } from '../api'
import type { Entry } from '../../shared/contract'
import { Icon } from './Icon'
import { FileTree } from './FileTree'
import type { CreateState, RenameState } from './FileTree'
import { SearchResults } from './SearchResults'
import { ContextMenu } from './ContextMenu'
import type { MenuAction } from './ContextMenu'
import { ConfirmDialog } from './ConfirmDialog'

interface WorkspaceItem {
  workspaceId: string
  path: string
  title: string
  sessionIds: string[]
}

export interface ExplorerPanelProps {
  useSessions: <T>(selector: (s: { current: string | null }) => T) => T
  useWorkspaces: <T>(selector: (s: { items: WorkspaceItem[]; recentWorkspaceId: string | null }) => T) => T
}

export function ExplorerPanel(props: ExplorerPanelProps) {
  const s = useStoreState()

  // 工作区根目录推导（官方会话/工作区状态）
  const currentSessionId = props.useSessions((st) => st.current)
  const wsItems = props.useWorkspaces((st) => st.items)
  const recentWorkspaceId = props.useWorkspaces((st) => st.recentWorkspaceId)

  let rootPath: string | null = null
  let rootName = ''
  if (currentSessionId) {
    for (const w of wsItems) {
      if (w.sessionIds.indexOf(currentSessionId) >= 0) { rootPath = w.path; rootName = w.title; break }
    }
  }
  if (!rootPath && recentWorkspaceId) {
    for (const w of wsItems) {
      if (w.workspaceId === recentWorkspaceId) { rootPath = w.path; rootName = w.title; break }
    }
  }
  if (!rootPath && wsItems.length > 0) { rootPath = wsItems[0].path; rootName = wsItems[0].title }

  // 工作区变化 → 重建树（懒加载缓存进 store）
  useEffect(() => {
    if (!rootPath) {
      clearTree()
      return
    }
    initTree(rootPath, rootName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, rootName])

  // ---------- 本地交互态（不进全局 store） ----------
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry } | null>(null)
  const [renaming, setRenaming] = useState<RenameState | null>(null)
  const [creating, setCreating] = useState<CreateState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Entry | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [drag, setDrag] = useState<{ startX: number; startWidth: number } | null>(null)
  const [sidebarLeft, setSidebarLeft] = useState(0)
  const statusSeq = useRef(0)

  const showStatus = (msg: { ok: boolean; text: string } | null) => {
    const seq = ++statusSeq.current
    setStatus(msg)
    if (msg) {
      window.setTimeout(() => {
        if (seq === statusSeq.current) setStatus(null)
      }, 4000)
    }
  }

  // Escape 关闭浮层（菜单 / 重命名 / 新建 / 删除确认）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null)
        setRenaming(null)
        setCreating(null)
        setConfirmDelete(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // 面板开关 → html 属性（CSS 挤列）
  useEffect(() => {
    const root = document.documentElement
    if (s.panel.open) {
      root.setAttribute('data-fe-panel-open', '')
      root.setAttribute('data-fe-side', s.panel.side)
    } else {
      root.removeAttribute('data-fe-panel-open')
    }
    return () => {
      root.removeAttribute('data-fe-panel-open')
    }
  }, [s.panel.open, s.panel.side])

  // 左侧停靠：列起点偏移 = 官方侧栏宽度
  useEffect(() => {
    if (!s.panel.open || s.panel.side !== 'left') return
    const conv = document.querySelector('[data-phase=active]')
    if (conv) setSidebarLeft(conv.getBoundingClientRect().left)
  }, [s.panel.open, s.panel.side])

  useEffect(() => {
    document.documentElement.style.setProperty('--fe-panel-width', s.panel.width + 'px')
  }, [s.panel.width])

  // ---------- 文件操作 ----------

  const dirnameOf = (p: string): string => {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
    return i <= 0 ? p : p.slice(0, i)
  }

  const relPathOf = (p: string): string => {
    const base = s.tree.rootPath ? s.tree.rootPath.replace(/[\\/]+$/, '') : ''
    if (p === s.tree.rootPath) return '.'
    if (base && p.indexOf(base) === 0) {
      const rel = p.slice(base.length).replace(/^[\\/]+/, '')
      return rel || '.'
    }
    return p
  }

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showStatus({ ok: true, text: '已复制路径' }),
        () => showStatus({ ok: false, text: '复制失败' }),
      )
    } else {
      showStatus({ ok: false, text: '剪贴板不可用' })
    }
  }

  const openContextMenu = (e: React.MouseEvent, entry: Entry) => {
    e.preventDefault()
    selectFile(entry.path)
    setMenu({ x: e.clientX, y: e.clientY, entry })
  }

  const closeMenu = () => setMenu(null)

  const doCut = (entry: Entry) => {
    setClipboard({ action: 'move', path: entry.path })
    closeMenu()
    showStatus({ ok: true, text: '已剪切：' + entry.name })
  }
  const doCopy = (entry: Entry) => {
    setClipboard({ action: 'copy', path: entry.path })
    closeMenu()
    showStatus({ ok: true, text: '已复制：' + entry.name })
  }
  const doCopyAbs = (entry: Entry) => {
    copyToClipboard(entry.path)
    closeMenu()
  }
  const doCopyRel = (entry: Entry) => {
    copyToClipboard(relPathOf(entry.path))
    closeMenu()
  }
  const doRename = (entry: Entry) => {
    setRenaming({ path: entry.path, value: entry.name })
    closeMenu()
  }
  const commitRename = () => {
    const r = renaming
    if (!r) return
    setRenaming(null)
    const name = String(r.value || '').trim()
    if (!name) return
    api.rename(r.path, name).then((res) => {
      if (res?.error) {
        showStatus({ ok: false, text: '重命名失败：' + res.error })
        return
      }
      showStatus({ ok: true, text: '已重命名' })
      if (res?.path && s.editors.some((ed) => ed.path === r.path)) {
        renameEditorPath(r.path, res.path, name)
      }
      reloadParent(r.path)
    }).catch((err) => {
      showStatus({ ok: false, text: '重命名失败：' + String((err as any)?.message || err) })
    })
  }
  const cancelRename = () => setRenaming(null)

  const doDelete = (entry: Entry) => {
    closeMenu()
    setConfirmDelete(entry)
  }
  const confirmDeleteNow = () => {
    const entry = confirmDelete
    setConfirmDelete(null)
    if (!entry) return
    api.del(entry.path).then((res) => {
      if (res?.error) {
        showStatus({ ok: false, text: '删除失败：' + res.error })
        return
      }
      showStatus({ ok: true, text: '已删除到回收站：' + entry.name })
      if (entry.type === 'directory') {
        // 从展开集移除（store 里直接操作）
        const t = s.tree
        if (t.expanded.has(entry.path)) {
          // 通过 store 的 toggleDir 折叠
          toggleDir(entry.path)
        }
      }
      if (s.editors.some((ed) => ed.path === entry.path)) closeEditor(entry.path)
      reloadParent(entry.path)
    }).catch((err) => {
      showStatus({ ok: false, text: '删除失败：' + String((err as any)?.message || err) })
    })
  }

  const doPasteInto = (dirEntry: Entry) => {
    const clip = s.clipboard
    closeMenu()
    if (!clip) return
    const targetDir = dirEntry.path
    const call = clip.action === 'move' ? api.move : api.copy
    call(clip.path, targetDir).then((res) => {
      if (res?.error) {
        showStatus({ ok: false, text: '粘贴失败：' + res.error })
        return
      }
      showStatus({ ok: true, text: (clip.action === 'move' ? '已移动' : '已复制') + '到 ' + dirEntry.name })
      if (clip.action === 'move') setClipboard(null)
      loadChildren(targetDir)
      if (clip.action === 'move') reloadParent(clip.path)
    }).catch((err) => {
      showStatus({ ok: false, text: '粘贴失败：' + String((err as any)?.message || err) })
    })
  }

  const doNewItem = (dirEntry: Entry, kind: 'file' | 'dir') => {
    closeMenu()
    if (dirEntry.type !== 'directory') return
    if (!s.tree.expanded.has(dirEntry.path)) toggleDir(dirEntry.path)
    setCreating({ parent: dirEntry.path, kind, value: '' })
  }
  const commitCreate = () => {
    const c = creating
    if (!c) return
    setCreating(null)
    const name = String(c.value || '').trim()
    if (!name) return
    const call = c.kind === 'dir' ? api.mkdir : api.create
    call(c.parent, name).then((res) => {
      if (res?.error) {
        showStatus({ ok: false, text: '新建失败：' + res.error })
        return
      }
      showStatus({ ok: true, text: '已新建：' + name })
      loadChildren(c.parent)
    }).catch((err) => {
      showStatus({ ok: false, text: '新建失败：' + String((err as any)?.message || err) })
    })
  }
  const cancelCreate = () => setCreating(null)

  const doOpenVscode = (entry: Entry) => {
    closeMenu()
    api.openVscode(entry.path).then((res) => {
      showStatus(res?.ok
        ? { ok: true, text: '已在 VS Code 中打开' }
        : { ok: false, text: (res?.error) || '打开失败（未检测到 code 命令）' })
    }).catch((err) => {
      showStatus({ ok: false, text: '打开失败：' + String((err as any)?.message || err) })
    })
  }

  const onVscodeRoot = () => {
    if (!s.tree.rootPath) return
    api.openVscode(s.tree.rootPath).then((res) => {
      showStatus(res?.ok
        ? { ok: true, text: '已在 VS Code 中打开项目' }
        : { ok: false, text: (res?.error) || '打开失败（未检测到 code 命令）' })
    }).catch((err) => {
      showStatus({ ok: false, text: '打开失败：' + String((err as any)?.message || err) })
    })
  }

  const doRefreshEntry = (entry: Entry) => {
    closeMenu()
    loadChildren(entry.type === 'directory' ? entry.path : dirnameOf(entry.path))
    showStatus({ ok: true, text: '已刷新' })
  }

  // 右键菜单项构造
  const buildMenuActions = (entry: Entry): MenuAction[] => {
    const isDir = entry.type === 'directory'
    const isRoot = s.tree.rootPath !== null && entry.path === s.tree.rootPath
    const expanded = isDir && s.tree.expanded.has(entry.path)
    const actions: MenuAction[] = []
    if (isDir) actions.push({ id: 'toggle', label: expanded ? '折叠' : '展开' })
    else actions.push({ id: 'open', label: '打开' })
    if (!isRoot) {
      actions.push({ id: 'cut', label: '剪切', sep: true })
      actions.push({ id: 'copy', label: '复制' })
    }
    actions.push({ id: 'copyAbs', label: '复制绝对路径', sep: true })
    actions.push({ id: 'copyRel', label: '复制相对路径' })
    if (isDir) {
      if (s.clipboard) actions.push({ id: 'paste', label: '粘贴', sep: true })
      actions.push({ id: 'newFile', label: '新建文件', sep: !s.clipboard })
      actions.push({ id: 'newFolder', label: '新建文件夹' })
    }
    if (!isRoot) {
      actions.push({ id: 'rename', label: '重命名', sep: true })
      actions.push({ id: 'delete', label: '删除', danger: true })
    }
    if (isDir) actions.push({ id: 'refresh', label: '刷新', sep: true })
    actions.push({ id: 'vscode', label: '在 VS Code 中打开', sep: !isDir })
    return actions
  }

  const onMenuAction = (id: string) => {
    const entry = menu?.entry
    if (!entry) return
    switch (id) {
      case 'toggle': closeMenu(); toggleDir(entry.path); break
      case 'open': closeMenu(); openEditor(entry); break
      case 'cut': doCut(entry); break
      case 'copy': doCopy(entry); break
      case 'copyAbs': doCopyAbs(entry); break
      case 'copyRel': doCopyRel(entry); break
      case 'paste': doPasteInto(entry); break
      case 'newFile': doNewItem(entry, 'file'); break
      case 'newFolder': doNewItem(entry, 'dir'); break
      case 'rename': doRename(entry); break
      case 'delete': doDelete(entry); break
      case 'refresh': doRefreshEntry(entry); break
      case 'vscode': doOpenVscode(entry); break
      default: closeMenu()
    }
  }

  // ---------- 拖动调宽 ----------
  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    setDrag({ startX: e.clientX, startWidth: s.panel.width })
  }
  const onResizeMove = (e: React.PointerEvent) => {
    if (!drag) return
    const dx = s.panel.side === 'left' ? (e.clientX - drag.startX) : (drag.startX - e.clientX)
    setPanelWidth(drag.startWidth + dx)
  }
  const endDrag = () => setDrag(null)

  // ---------- 渲染 ----------
  if (!s.panel.open) return null

  const treePanel = (
    <div
      className="fe-panel"
      data-side={s.panel.side}
      style={{
        width: s.panel.width + 'px',
        right: s.panel.side === 'right' ? 0 : 'auto',
        left: s.panel.side === 'left' ? sidebarLeft + 'px' : 'auto',
      }}
    >
      <div className="fe-resize" title="拖动调整宽度" onPointerDown={onResizeStart} />
      <div className="fe-header">
        <span className="fe-title">文件</span>
        <button className="fe-iconbtn fe-icon-vscode" title="在 Visual Studio Code 中打开项目" onClick={onVscodeRoot}>
          <Icon name="vscode" size={15} />
        </button>
        <button className="fe-iconbtn" title="全部展开 / 全部折叠" onClick={toggleExpandAll}>
          <Icon name="chevronDown" size={14} />
        </button>
        <button className="fe-iconbtn" title="刷新" onClick={refreshTree}>
          <Icon name="refresh" size={14} />
        </button>
        <button className="fe-iconbtn" title={s.panel.side === 'left' ? '面板移到右侧' : '面板移到左侧'} onClick={togglePanelSide}>
          <Icon name="swap" size={14} />
        </button>
        <button className="fe-iconbtn" title="关闭" onClick={() => setPanelOpen(false)}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="fe-searchbar">
        <input
          className="fe-search"
          type="text"
          placeholder="搜索文件"
          value={s.query}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
        />
        {s.searching ? <span className="fe-search-state">…</span> : null}
      </div>
      {status ? <div className={'fe-status ' + (status.ok ? 'fe-status-ok' : 'fe-status-err')}>{status.text}</div> : null}
      {s.clipboard ? (
        <div className="fe-clip-hint">
          {(s.clipboard.action === 'move' ? '待粘贴（剪切）：' : '待粘贴（复制）：') +
            (s.clipboard.path.split(/[\\/]/).pop() || s.clipboard.path)}
        </div>
      ) : null}
      <div className="fe-tree">
        {s.query.trim() ? (
          <SearchResults
            matches={s.matches || []}
            truncated={s.truncated}
            searching={s.searching}
            searchError={s.searchError}
            selected={s.tree.selected}
            rootPath={s.tree.rootPath}
            onSelect={selectFile}
            onOpen={openEditor}
            onContextMenu={openContextMenu}
          />
        ) : (
          <FileTree
            tree={s.tree}
            renaming={renaming}
            creating={creating}
            onToggle={toggleDir}
            onSelect={selectFile}
            onOpen={openEditor}
            onContextMenu={openContextMenu}
            onRenameChange={(v) => setRenaming((r) => (r ? { ...r, value: v } : r))}
            onRenameCommit={commitRename}
            onRenameCancel={cancelRename}
            onCreateChange={(v) => setCreating((c) => (c ? { ...c, value: v } : c))}
            onCreateCommit={commitCreate}
            onCreateCancel={cancelCreate}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="fe-overlay-root">
      {drag ? (
        <div className="fe-drag-capture" onPointerMove={onResizeMove} onPointerUp={endDrag} onPointerLeave={endDrag} />
      ) : null}
      {treePanel}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          actions={buildMenuActions(menu.entry)}
          onAction={onMenuAction}
          onClose={closeMenu}
        />
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="删除到回收站"
          message={`确定将 "${confirmDelete.name}" 删除到回收站吗？`}
          buttons={[
            { label: '取消', onClick: () => setConfirmDelete(null) },
            { label: '删除', danger: true, onClick: confirmDeleteNow },
          ]}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  )
}
