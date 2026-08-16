// 通信层：唯一 fetch 出处。组件绝不直接 fetch，只走这里调 host 路由。
// 返回 shape 见 src/shared/contract.ts（统一错误形态：非 2xx 或业务失败时带 error 字段）。
import { ROUTES } from '../shared/contract'

async function request(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, init)
  return res.json()
}

function get(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString()
  return request(path + '?' + qs)
}

function post(path: string, body: unknown): Promise<any> {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const api = {
  list: (path: string) => get(ROUTES.list, { path }),
  search: (root: string, q: string) => get(ROUTES.search, { root, q }),
  read: (path: string) => get(ROUTES.read, { path }),
  version: (path: string) => get(ROUTES.version, { path }),
  write: (path: string, content: string) => post(ROUTES.write, { path, content }),
  copy: (source: string, targetDir: string) => post(ROUTES.copy, { source, targetDir }),
  move: (source: string, targetDir: string) => post(ROUTES.move, { source, targetDir }),
  rename: (path: string, name: string) => post(ROUTES.rename, { path, name }),
  mkdir: (parent: string, name: string) => post(ROUTES.mkdir, { parent, name }),
  create: (parent: string, name: string) => post(ROUTES.create, { parent, name }),
  del: (path: string) => post(ROUTES.delete, { path }),
  openVscode: (path: string) => post(ROUTES.openVscode, { path }),
}
