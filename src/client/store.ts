// 状态层：单一 store（useSyncExternalStore + 版本号模式，见 DESIGN.md §17.7）。
// 组件不直接 fetch / 不直接碰 ctx；动作集中在 store 里，读写状态统一走这里。
import { useSyncExternalStore } from 'react'
import { api } from './api'
import { langForFile } from './languages'
import type { Entry } from '../shared/contract'

// ---------- 类型 ----------

export interface EditorState {
  path: string
  name: string
  content: string
  savedContent: string          // 最近保存内容，用于判断 dirty
  lang: string | null           // shiki lang id，null = 纯文本
  mode: 'source' | 'render'     // Markdown 用：源码高亮 / 渲染预览
  state: 'loading' | 'ready' | 'error' | 'too-large'
  message?: string
  size: number
}

export interface ClipState { action: 'copy' | 'move'; path: string }
export interface EditorStatus { ok: boolean; text: string }
export interface Rect { left: number; right: number; top: number; bottom: number }

export interface TreeState {
  rootPath: string | null
  rootName: string
  cache: Map<string, Entry[]>   // dirPath → entries（懒加载缓存）
  expanded: Set<string>
  loading: Set<string>
  selected: string | null
  errors: Record<string, string>
}

export interface Store {
  panel: { open: boolean; width: number; side: 'left' | 'right' }
  query: string
  searching: boolean
  searchError: string | null
  matches: Entry[] | null
  truncated: boolean
  tree: TreeState
  editors: EditorState[]
  activeEditorPath: string | null
  editorStatus: EditorStatus | null
  pendingClose: { path: string; name: string } | null
  clipboard: ClipState | null
  headerVisible: boolean
  headerH: number
  columnRect: Rect | null
  hasColumn: boolean
  jumpToFile: ((viewId: string) => void) | null   // 官方 setView（视图树内注入，可缺省）
  refreshTick: number            // 手动/自动刷新触发令牌
}

// ---------- store 本体 ----------

const state: Store = {
  panel: { open: false, width: 340, side: 'right' },
  query: '',
  searching: false,
  searchError: null,
  matches: null,
  truncated: false,
  tree: { rootPath: null, rootName: '', cache: new Map(), expanded: new Set(), loading: new Set(), selected: null, errors: {} },
  editors: [],
  activeEditorPath: null,
  editorStatus: null,
  pendingClose: null,
  clipboard: null,
  headerVisible: false,
  headerH: 44,
  columnRect: null,
  hasColumn: false,
  jumpToFile: null,
  refreshTick: 0,
}

let version = 0
const listeners = new Set<() => void>()

export const getState = (): Store => state
export const getVersion = (): number => version
export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export function mutate(fn: (s: Store) => void): void {
  fn(state)
  version++
  listeners.forEach((l) => l())
}

export function useStoreState(): Store {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return state
}

export function useStore<T>(selector: (s: Store) => T): T {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return selector(state)
}

// ---------- 面板 ----------

export function setPanelOpen(value: boolean): void {
  mutate((s) => { s.panel.open = !!value })
}
export function togglePanel(): void {
  mutate((s) => { s.panel.open = !s.panel.open })
}
export function setPanelSide(side: 'left' | 'right'): void {
  mutate((s) => { s.panel.side = side === 'left' ? 'left' : 'right' })
}
export function togglePanelSide(): void {
  mutate((s) => { s.panel.side = s.panel.side === 'left' ? 'right' : 'left' })
}
export function setPanelWidth(width: number): void {
  mutate((s) => { s.panel.width = Math.max(220, Math.min(900, Math.round(width))) })
}
export function setClipboard(clip: ClipState | null): void {
  mutate((s) => { s.clipboard = clip })
}

// ---------- 树 ----------

export function initTree(rootPath: string, rootName: string): void {
  mutate((s) => {
    s.tree = {
      rootPath,
      rootName,
      cache: new Map(),
      expanded: new Set([rootPath]),
      loading: new Set([rootPath]),
      selected: null,
      errors: {},
    }
  })
  loadChildren(rootPath)
}

export function clearTree(): void {
  mutate((s) => {
    s.tree = { rootPath: null, rootName: '', cache: new Map(), expanded: new Set(), loading: new Set(), selected: null, errors: {} }
    s.matches = null
    s.searching = false
  })
}

export function loadChildren(path: string): void {
  api.list(path).then((res) => {
    mutate((s) => {
      const t = s.tree
      if (res?.error) t.errors[path] = res.error
      else t.cache.set(path, res.entries || [])
      t.loading.delete(path)
    })
  }).catch((err) => {
    mutate((s) => {
      const t = s.tree
      t.errors[path] = String((err as any)?.message || err)
      t.loading.delete(path)
    })
  })
}

export function toggleDir(path: string): void {
  const t = state.tree
  if (t.expanded.has(path)) {
    mutate((s) => { s.tree.expanded.delete(path) })
    return
  }
  const needLoad = !t.cache.has(path)
  mutate((s) => {
    s.tree.expanded.add(path)
    if (needLoad) s.tree.loading.add(path)
  })
  if (needLoad) loadChildren(path)
}

export function selectFile(path: string): void {
  mutate((s) => { s.tree.selected = path })
}

export function refreshTree(): void {
  const root = state.tree.rootPath
  if (!root) return
  mutate((s) => {
    s.tree.cache = new Map()
    s.tree.expanded = new Set([root])
    s.tree.loading = new Set([root])
    s.tree.errors = {}
    s.tree.selected = null
    s.refreshTick++
  })
  loadChildren(root)
}

export function reloadParent(path: string): void {
  const parent = dirnameOf(path)
  if (parent) loadChildren(parent)
}

export function dirnameOf(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i <= 0 ? p : p.slice(0, i)
}

// ---------- 全部展开 / 折叠 ----------

let expandToken = 0
let expandBusy = false
const MAX_EXPAND_DIRS = 500

export function toggleExpandAll(): void {
  if (expandBusy || state.tree.expanded.size > 1) collapseAll()
  else void expandAll()
}

function collectDirs(t: TreeState): string[] {
  const dirs: string[] = []
  const walk = (dir: string): void => {
    const children = t.cache.get(dir)
    if (!children) return
    for (const e of children) {
      if (e.type === 'directory') { dirs.push(e.path); walk(e.path) }
    }
  }
  if (t.rootPath) walk(t.rootPath)
  return dirs
}

async function expandAll(): Promise<void> {
  const root = state.tree.rootPath
  if (!root || expandBusy) return
  expandBusy = true
  const token = ++expandToken
  const visited = new Set<string>()
  mutate((s) => {
    const dirs = collectDirs(s.tree)
    const expanded = new Set(dirs)
    expanded.add(s.tree.rootPath!)
    const loading = new Set(s.tree.loading)
    for (const d of dirs) loading.add(d)
    s.tree.expanded = expanded
    s.tree.loading = loading
  })
  let loaded = 0
  const work = async (dir: string): Promise<void> => {
    if (token !== expandToken || visited.has(dir) || loaded >= MAX_EXPAND_DIRS) return
    visited.add(dir)
    loaded++
    let entries: Entry[] | null = null
    try {
      const res = await api.list(dir)
      entries = res && !res.error ? res.entries : null
    } catch {
      entries = null
    }
    if (token !== expandToken) return
    mutate((s) => {
      if (entries) s.tree.cache.set(dir, entries)
      else s.tree.errors[dir] = '加载失败'
      s.tree.loading.delete(dir)
    })
    if (entries) {
      const subs = entries.filter((e) => e.type === 'directory').map((e) => e.path)
      await Promise.all(subs.map((d) => work(d)))
    }
  }
  try {
    await work(root)
  } finally {
    expandBusy = false
  }
}

export function collapseAll(): void {
  expandToken++
  expandBusy = false
  mutate((s) => { s.tree.expanded = new Set(s.tree.rootPath ? [s.tree.rootPath] : []) })
}

// ---------- 搜索 ----------

let searchTimer: number | null = null
let searchSeq = 0

export function setQuery(value: string): void {
  const q = String(value || '')
  mutate((s) => { s.query = q })
  runSearch(q)
}

function runSearch(q: string): void {
  if (!q.trim()) {
    mutate((s) => { s.matches = null; s.searching = false; s.searchError = null })
    return
  }
  const seq = ++searchSeq
  mutate((s) => { s.searching = true; s.searchError = null })
  if (searchTimer !== null) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => { searchTimer = null; doSearch(q, seq, false) }, 300)
}

// 自动刷新用：静默重跑当前搜索（不闪「搜索中…」）。
export function rerunSearch(): void {
  const q = state.query.trim()
  if (!q) return
  const seq = ++searchSeq
  doSearch(q, seq, true)
}

function doSearch(q: string, seq: number, silent: boolean): void {
  const root = state.tree.rootPath
  if (!root) return
  if (!silent) mutate((s) => { s.searching = true; s.searchError = null })
  api.search(root, q).then((res) => {
    if (seq !== searchSeq || state.query !== q) return
    mutate((s) => {
      s.searching = false
      if (res?.error) s.searchError = res.error
      else { s.matches = res.matches || []; s.truncated = !!res.truncated }
    })
  }).catch((err) => {
    if (seq !== searchSeq || state.query !== q) return
    mutate((s) => {
      s.searching = false
      s.searchError = String((err as any)?.message || err)
    })
  })
}

// ---------- 编辑器页签 ----------

function findEditor(path: string): EditorState | undefined {
  return state.editors.find((ed) => ed.path === path)
}

function patchEditor(path: string, patch: Partial<EditorState>): void {
  mutate((s) => {
    s.editors = s.editors.map((ed) => (ed.path === path ? { ...ed, ...patch } : ed))
  })
}

let editorStatusSeq = 0
export function showEditorStatus(msg: EditorStatus | null): void {
  const seq = ++editorStatusSeq
  mutate((s) => { s.editorStatus = msg })
  if (!msg) return
  window.setTimeout(() => { if (seq === editorStatusSeq) mutate((s) => { s.editorStatus = null }) }, 4000)
}

export function openEditor(entry: Entry): void {
  const path = entry.path
  if (findEditor(path)) {
    mutate((s) => { s.activeEditorPath = path })
    jumpToFileView()
    return
  }
  const ed: EditorState = {
    path,
    name: entry.name,
    content: '',
    savedContent: '',
    lang: langForFile(entry.name),
    mode: 'source',
    state: 'loading',
    size: entry.size ?? 0,
  }
  mutate((s) => {
    s.editors = [...s.editors, ed]
    s.activeEditorPath = path
    s.editorStatus = null
  })
  jumpToFileView()
  api.read(path).then((res) => {
    if (!findEditor(path)) return
    if (res?.error) patchEditor(path, { state: 'error', message: res.error })
    else if (res?.tooLarge) patchEditor(path, { state: 'too-large', size: res.size })
    else patchEditor(path, { state: 'ready', content: res.content ?? '', savedContent: res.content ?? '' })
  }).catch((err) => {
    if (!findEditor(path)) return
    patchEditor(path, { state: 'error', message: String((err as any)?.message || err) })
  })
}

export function activateEditor(path: string): void {
  if (findEditor(path)) mutate((s) => { s.activeEditorPath = path })
}

export function closeEditor(path: string): void {
  const idx = state.editors.findIndex((ed) => ed.path === path)
  if (idx < 0) return
  mutate((s) => {
    s.editors = s.editors.filter((ed) => ed.path !== path)
    if (s.activeEditorPath === path) {
      const next = s.editors[idx] || s.editors[idx - 1] || null
      s.activeEditorPath = next ? next.path : null
    }
    if (!s.editors.length) s.editorStatus = null
  })
}

export function requestClose(path: string): void {
  const ed = findEditor(path)
  if (!ed) return
  if (ed.content !== ed.savedContent) {
    mutate((s) => { s.pendingClose = { path: ed.path, name: ed.name } })
  } else {
    closeEditor(path)
  }
}

export function requestCloseAll(): void {
  const dirty = state.editors.find((ed) => ed.content !== ed.savedContent)
  if (dirty) {
    mutate((s) => { s.pendingClose = { path: dirty.path, name: dirty.name } })
    return
  }
  mutate((s) => { s.editors = []; s.activeEditorPath = null; s.editorStatus = null })
}

export function resolvePendingClose(action: 'cancel' | 'discard' | 'save'): void {
  const pc = state.pendingClose
  if (!pc) return
  const path = pc.path
  if (action === 'cancel') {
    mutate((s) => { s.pendingClose = null })
    return
  }
  if (action === 'discard') {
    mutate((s) => { s.pendingClose = null })
    closeEditor(path)
    return
  }
  mutate((s) => { s.pendingClose = null })
  saveEditor(path, () => closeEditor(path))
}

export function setEditorContent(path: string, content: string): void {
  if (findEditor(path)) patchEditor(path, { content })
}

export function setEditorMode(path: string, mode: 'source' | 'render'): void {
  if (findEditor(path)) patchEditor(path, { mode })
}

export function saveEditor(path: string, done?: () => void): void {
  const ed = findEditor(path)
  if (!ed || ed.state !== 'ready') return
  const written = ed.content
  api.write(ed.path, written).then((res) => {
    if (res?.error) {
      showEditorStatus({ ok: false, text: '保存失败：' + res.error })
      return
    }
    patchEditor(path, { savedContent: written })
    reloadParent(path) // 文件大小变化 → 刷新父目录展示
    showEditorStatus({ ok: true, text: '已保存' })
    done?.()
  }).catch((err) => {
    showEditorStatus({ ok: false, text: '保存失败：' + String((err as any)?.message || err) })
  })
}

export function renameEditorPath(oldPath: string, newPath: string, name: string): void {
  mutate((s) => {
    s.editors = s.editors.map((ed) => {
      if (ed.path !== oldPath) return ed
      return { ...ed, path: newPath, name, lang: langForFile(name) }
    })
    if (s.activeEditorPath === oldPath) s.activeEditorPath = newPath
  })
}

// ---------- 跳转「文件」父页签（分层降级，见 DESIGN.md §10.3） ----------

export function jumpToFileView(): void {
  const { jumpToFile, headerVisible, columnRect, headerH } = state
  if (jumpToFile) {
    try {
      jumpToFile('file-explorer')
      return
    } catch {
      /* 视图树内跳转失败 → 降级 DOM 点击 */
    }
  }
  if (!headerVisible || !columnRect) return
  const conv = document.querySelector('[data-phase=active]')
  if (!conv) return
  const top0 = columnRect.top
  const bottomLimit = top0 + headerH + 8
  const walker = document.createTreeWalker(conv, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    if ((n.nodeValue || '').trim() !== '文件') continue
    const el = n.parentElement
    if (!el || !el.getClientRects().length) continue
    const r = el.getBoundingClientRect()
    if (r.top < top0 - 4 || r.bottom > bottomLimit) continue
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return
  }
}
