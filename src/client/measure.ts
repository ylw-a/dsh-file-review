// 布局测量 + 全局键盘（Ctrl+S / Escape）：副作用统一管理，ctx.effect 卸载。
// 挤列策略（[data-phase=active] padding / 无该元素时 body padding）是 DSH 升级可能需适配的单一改点。
import { getState, mutate, saveEditor } from './store'
import type { Rect } from './store'

// 会话标题栏底部（对话/轨迹 标签行下缘）的视口坐标，找不到返回 null。
function measureHeaderBottom(conv: Element | null): number | null {
  if (!conv) return null
  const walker = document.createTreeWalker(conv, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = (n.nodeValue || '').trim()
    if (t !== '对话' && t !== '轨迹') continue
    let el = n.parentElement
    while (el && el !== conv) {
      const txt = (el.textContent || '').replace(/\s+/g, ' ')
      if (txt.indexOf('对话') >= 0 && txt.indexOf('轨迹') >= 0) {
        const r = el.getBoundingClientRect()
        if (r.height > 0 && r.height < 100) return r.bottom
      }
      el = el.parentElement
    }
  }
  return null
}

// 官方侧栏宽度（无会话时编辑器浮窗起始位置用）。
function measureSidebarWidth(): number {
  const foot = document.querySelector('.fe-foot')
  if (!foot) return 0
  let el = foot.parentElement
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect()
    if (r.width > 40 && r.width < 420 && r.left >= 0 && r.left < 24) return r.width
    el = el.parentElement
  }
  return 0
}

function differs(a: Rect, b: Rect): boolean {
  return Math.abs(a.left - b.left) > 1 || Math.abs(a.right - b.right) > 1 ||
    Math.abs(a.top - b.top) > 1 || Math.abs(a.bottom - b.bottom) > 1
}

export function startMeasureLoop(ctx: any): void {
  let timer = 0
  const measure = (): void => {
    const s = getState()
    const conv = document.querySelector('[data-phase=active]')
    const shift = s.panel.open ? s.panel.width + 12 : 0
    let nr: Rect | null = null
    if (conv) {
      // 正常会话：CSS 挤列 [data-phase=active] 本身，body padding 不动。
      document.body.style.paddingRight = ''
      document.body.style.paddingLeft = ''
      const r = conv.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) nr = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    } else {
      // 无会话：body padding 推开整个应用，面板/编辑器与官方 UI 并排。
      document.body.style.paddingRight = s.panel.open && s.panel.side === 'right' ? shift + 'px' : ''
      document.body.style.paddingLeft = s.panel.open && s.panel.side === 'left' ? shift + 'px' : ''
      const pl = parseFloat(document.body.style.paddingLeft) || 0
      const pr = parseFloat(document.body.style.paddingRight) || 0
      nr = { left: pl + measureSidebarWidth(), right: window.innerWidth - pr, top: 0, bottom: window.innerHeight }
    }
    const b = measureHeaderBottom(conv)
    const hv = b !== null
    const hh = hv && conv ? Math.max(0, b - conv.getBoundingClientRect().top) : 0
    // 只在真正变化时 mutate，避免每次测量都触发全量重渲染
    let changed = false
    if (nr && (!s.columnRect || differs(s.columnRect, nr))) { s.columnRect = nr; changed = true }
    if (s.hasColumn !== !!conv) { s.hasColumn = !!conv; changed = true }
    if (hv !== s.headerVisible || Math.abs(hh - s.headerH) > 1) {
      s.headerVisible = hv
      s.headerH = hh
      changed = true
    }
    if (changed) mutate(() => {})
  }

  measure()
  window.addEventListener('resize', measure)
  const mo = new MutationObserver(() => {
    clearTimeout(timer)
    timer = window.setTimeout(measure, 100)
  })
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
  ctx.effect(() => () => {
    window.removeEventListener('resize', measure)
    mo.disconnect()
    clearTimeout(timer)
    document.body.style.paddingRight = ''
    document.body.style.paddingLeft = ''
  }, 'file-explorer: measure')}

// 全局键盘：有页签时 Escape 关未保存确认；Ctrl/Cmd+S 保存当前页签。
export function startEditorKeys(ctx: any): void {
  const onKey = (e: KeyboardEvent): void => {
    const s = getState()
    if (!s.editors.length) return
    if (e.key === 'Escape') {
      if (s.pendingClose) {
        mutate((st) => { st.pendingClose = null })
        return
      }
    }
    if (!(e.ctrlKey || e.metaKey)) return
    if (String(e.key || '').toLowerCase() !== 's') return
    const ed = s.editors.find((x) => x.path === s.activeEditorPath)
    if (ed && ed.state === 'ready') {
      e.preventDefault()
      saveEditor(ed.path)
    }
  }
  document.addEventListener('keydown', onKey)
  ctx.effect(() => () => document.removeEventListener('keydown', onKey), 'file-explorer: keys')
}
