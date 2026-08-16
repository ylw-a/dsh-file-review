// 路由契约：host 与 client 唯一共享的类型定义，禁止两端各写一份。

export interface Entry {
  name: string
  type: 'file' | 'directory'
  size: number | null
  path: string
}

export interface ListResult { entries: Entry[] }
export interface SearchResult { matches: Entry[]; truncated: boolean }
export interface ReadResult { content?: string; size?: number; tooLarge?: boolean }
export interface WriteBody { path: string; content: string }
export interface PairBody { source: string; targetDir: string }
export interface NamedBody { path: string; name: string }
export interface ParentBody { parent: string; name: string }
export interface PathBody { path: string }
export interface OkResult { ok: boolean; path?: string; error?: string }
export interface VersionResult { version: string }

export const ROUTES = {
  list: '/plugins/file-explorer/list',
  search: '/plugins/file-explorer/search',
  read: '/plugins/file-explorer/read',
  write: '/plugins/file-explorer/write',
  copy: '/plugins/file-explorer/copy',
  move: '/plugins/file-explorer/move',
  rename: '/plugins/file-explorer/rename',
  mkdir: '/plugins/file-explorer/mkdir',
  create: '/plugins/file-explorer/create',
  delete: '/plugins/file-explorer/delete',
  openVscode: '/plugins/file-explorer/open-vscode',
  version: '/plugins/file-explorer/version',
} as const
