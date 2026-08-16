# dsh-file-review

File Explorer for DeepSeek Harness — a resizable file tree with context-menu file operations, a Shiki-powered editable code editor (preview = editing), Markdown source/render switching, and auto-refresh of the directory tree.

## Features

- **File tree sidebar** (dockable left/right, resizable 220–900px): lazy-loaded directories, expand/collapse all, search across the workspace.
- **Context menu**: 剪切 / 复制 / 粘贴 / 复制绝对路径 / 复制相对路径 / 重命名 / 删除到回收站 / 新建文件 / 新建文件夹 / 刷新 / 在 VS Code 中打开.
- **Unified editor** (Shiki syntax highlighting + direct editing in one view, no preview/edit split): debounced highlighting, scroll-synced textarea ghost overlay, Ctrl/Cmd+S save, dirty-tab close confirmation.
- **Markdown**: syntax-highlighted source editing by default, with a 渲染/编辑 toggle into a read-only render view (official `MarkdownText`).
- **Auto-refresh**: the visible tree polls every ~2s and only re-renders when entry signatures change; manual refresh button kept as fallback; write operations refresh immediately.
- **Dual hosting**: floating editor window when there is no session; a fixed 文件 parent tab (对话 | 轨迹 | 文件) once a session exists — shared store, nothing lost when switching tabs.
- Deletion goes to the Windows Recycle Bin (PowerShell `Microsoft.VisualBasic`), never permanent.

## Install

Requires a local DeepSeek Harness profile (web). Build first, then add the package:

```bash
npm install
npm run build
dsh plugin --profile web add -w <path-to-this-package>
```

Then restart the harness. The host half mounts the `file-explorer` plugin and registers the `/plugins/file-explorer/*` routes; the client half renders the panel, the sidebar toggle, and the editor.

> `lib/` and `docs/` are build artifacts / local design docs and are not committed (see `.gitignore`). Rebuild after changing `src/`.

## Development

```bash
npm install          # devDependencies only (esbuild, shiki, typescript…)
npm run build        # esbuild → lib/index.js (host ESM) + lib/client.js (client bundle)
```

- Host half (`src/host/`): `services → paths → recycle/vscode → ops → routes → index`. All writes go through `node:fs/promises` after `fs.resolve`/`fs.processPath` canonicalization.
- Client half (`src/client/`): `api → store → highlighter/languages → styles → autoRefresh → components → slots/measure → index`. Components never `fetch` directly and never touch `ctx`; the shared route contract lives in `src/shared/contract.ts`.
- The client bundle inlines `shiki` (JavaScript regex engine, no WASM) with a fixed ~25-language set; colors follow the DSH theme through `--shiki-*` CSS variables.

## License

MIT
