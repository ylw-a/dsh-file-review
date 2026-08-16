// ★ 自动刷新：面板打开时轮询可见目录 / 搜索结果，条目签名（name|type|size）变化才重渲染。
// 写操作（保存/复制/粘贴/重命名/删除/新建）由 store 动作立即触发刷新，不依赖轮询。
// 面板关闭即停；编辑中有未保存内容时跳过。见 DESIGN.md §11。
import { api } from './api'
import { getState, mutate, rerunSearch } from './store'
import type { Entry } from '../shared/contract'

const REFRESH_INTERVAL = 2000

function signatureOf(entries: Entry[]): string {
  let h = 0
  for (const e of entries) {
    const s = e.name + '|' + e.type + '|' + e.size
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return entries.length + ':' + (h >>> 0).toString(36)
}

export function startAutoRefresh(ctx: any): void {
  let timer: number | null = null

  const refreshDir = (dir: string): void => {
    api.list(dir).then((res) => {
      if (res?.error) return
      const entries = (res.entries || []) as Entry[]
      const sig = signatureOf(entries)
      // 签名 diff 在 mutate 之外做：无变化就不 bump 版本，避免无谓重渲染
      const current = getState().tree.cache.get(dir)
      if (current && signatureOf(current) === sig) return
      mutate((s) => {
        s.tree.cache.set(dir, entries)
        s.tree.loading.delete(dir)
        delete s.tree.errors[dir]
      })
    }).catch(() => {
      /* 轮询失败静默，下次再试 */
    })
  }

  const tick = (): void => {
    const s = getState()
    if (!s.panel.open) return // 面板关闭不轮询
    // 有未保存内容 / 正在编辑时不打扰
    if (s.editors.some((ed) => ed.content !== ed.savedContent)) return
    const active = document.activeElement
    if (active && active.tagName === 'TEXTAREA' && active.closest('.fe-editor-input')) return
    const tree = s.tree
    if (!tree.rootPath) return
    if (s.query.trim()) {
      rerunSearch()
      return
    }
    // 可见目录：根 + 已展开且已加载的目录
    const dirs = new Set<string>([tree.rootPath])
    for (const d of tree.expanded) {
      if (tree.cache.has(d)) dirs.add(d)
    }
    for (const d of dirs) refreshDir(d)
  }

  timer = window.setInterval(tick, REFRESH_INTERVAL)
  ctx.effect(() => () => {
    if (timer !== null) window.clearInterval(timer)
  }, 'file-explorer: auto-refresh')
}
