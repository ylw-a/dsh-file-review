// Markdown「渲染」只读视图：官方 MarkdownText（自带 HTML 消毒 + GFM + KaTeX + Shiki 代码块）。
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="fe-md">
      <MarkdownText text={content} />
    </div>
  )
}
