// 扩展名 → shiki lang id 映射。未知扩展名 → null（纯文本，可编辑，不高亮）。
// jsx/tsx 复用 javascript/typescript 语法；shell 用 shellscript。见 DESIGN.md §9.4。

const EXT_LANG: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  jsonc: 'json',
  map: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  md: 'markdown',
  markdown: 'markdown',
  mdown: 'markdown',
  mkd: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  py: 'python',
  pyw: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  cs: 'csharp',
  kt: 'kotlin',
  swift: 'swift',
  php: 'php',
  xml: 'xml',
  svg: 'xml',
  lua: 'lua',
}

export function langForFile(name: string): string | null {
  const n = String(name || '')
  const i = n.lastIndexOf('.')
  const ext = i >= 0 ? n.slice(i + 1).toLowerCase() : ''
  return EXT_LANG[ext] || null
}

export function isMarkdown(name: string): boolean {
  return /\.(md|markdown|mdown|mkd)$/i.test(String(name || ''))
}
