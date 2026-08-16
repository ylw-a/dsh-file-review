// Shiki 单例：JavaScript 正则引擎（非 WASM）+ CSS 变量主题，同步高亮。
// 语言显式 import（esbuild 只打用到的）；配色走 --shiki-*（DSH 主题注入）。见 DESIGN.md §9.3。
import { createHighlighterCoreSync, createCssVariablesTheme } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langTs from '@shikijs/langs/typescript'
import langJs from '@shikijs/langs/javascript'
import langJson from '@shikijs/langs/json'
import langYaml from '@shikijs/langs/yaml'
import langToml from '@shikijs/langs/toml'
import langIni from '@shikijs/langs/ini'
import langMarkdown from '@shikijs/langs/markdown'
import langHtml from '@shikijs/langs/html'
import langCss from '@shikijs/langs/css'
import langScss from '@shikijs/langs/scss'
import langLess from '@shikijs/langs/less'
import langSql from '@shikijs/langs/sql'
import langShell from '@shikijs/langs/shellscript'
import langPython from '@shikijs/langs/python'
import langGo from '@shikijs/langs/go'
import langRust from '@shikijs/langs/rust'
import langJava from '@shikijs/langs/java'
import langC from '@shikijs/langs/c'
import langCpp from '@shikijs/langs/cpp'
import langCsharp from '@shikijs/langs/csharp'
import langKotlin from '@shikijs/langs/kotlin'
import langSwift from '@shikijs/langs/swift'
import langPhp from '@shikijs/langs/php'
import langXml from '@shikijs/langs/xml'
import langLua from '@shikijs/langs/lua'

const engine = createJavaScriptRegexEngine()
const theme = createCssVariablesTheme({ name: 'dsh', variablePrefix: '--shiki-' })

export const highlighter = createHighlighterCoreSync({
  themes: [theme],
  langs: [
    langJs, langTs, langJson, langYaml, langToml, langIni, langMarkdown,
    langHtml, langCss, langScss, langLess, langSql, langShell, langPython,
    langGo, langRust, langJava, langC, langCpp, langCsharp, langKotlin,
    langSwift, langPhp, langXml, langLua,
  ],
  engine,
})

const KNOWN_LANGS = new Set(highlighter.getLoadedLanguages())

export function highlight(code: string, lang: string | null): string {
  if (!lang || !KNOWN_LANGS.has(lang)) return escapeHtml(code)
  // 与官方 CodeBlock 一致：去尾换行后再高亮
  const trimmed = code.endsWith('\n') ? code.slice(0, -1) : code
  try {
    const html = highlighter.codeToHtml(trimmed, { lang, theme: 'dsh' })
    // 去掉外层 pre 的内联背景/前景（编辑器覆盖层背景透明，由本插件 CSS 控制）；
    // token 的内联 color:var(--shiki-*) 保留，配色仍跟随主题。
    return html.replace(/\sstyle="[^"]*"/, '').replace(/\stabindex="0"/, '')
  } catch {
    return escapeHtml(code)
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
