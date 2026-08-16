// ★ 合一编辑器：textarea 幽灵覆盖 + shiki 高亮（见 DESIGN.md §9）。
// 两层（背景高亮层 .fe-editor-hl / 前景输入层 .fe-editor-input）CSS 完全一致，
// 滚动同步走 textarea 的 scroll 事件；高亮防抖 ~120ms。
import { useEffect, useRef } from 'react'
import { highlight } from '../highlighter'
import { setEditorContent } from '../store'
import type { EditorState } from '../store'

// 超长文件降级为纯文本（仍可编辑），避免同步高亮卡顿。
const MAX_HL_LENGTH = 100_000

export function Editor({ editor }: { editor: EditorState }) {
  const preRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const paint = () => {
    const pre = preRef.current
    if (!pre) return
    if (editor.content.length > MAX_HL_LENGTH) {
      pre.textContent = editor.content
      return
    }
    pre.innerHTML = highlight(editor.content, editor.lang)
    const ta = taRef.current
    if (ta && pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
  }

  // 挂载 / 语言切换：立即高亮
  useEffect(() => {
    paint()
    // 语言与文件路径都不变时（同文件切换）不需要重绘；editor 在 EditorChrome 里按 path key 重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.lang])

  // 内容变化：防抖高亮
  useEffect(() => {
    const id = window.setTimeout(paint, 120)
    return () => window.clearTimeout(id)
  }, [editor.content])

  const onScroll = () => {
    const pre = preRef.current
    const ta = taRef.current
    if (pre && ta) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
  }

  return (
    <div className="fe-editor">
      <div ref={preRef} className="fe-editor-hl" aria-hidden="true" />
      <textarea
        ref={taRef}
        className="fe-editor-input"
        spellCheck={false}
        value={editor.content}
        onChange={(e) => setEditorContent(editor.path, e.target.value)}
        onScroll={onScroll}
      />
    </div>
  )
}
