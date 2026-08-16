// 读操作：list / search / read / version。全部只读，不碰 node:fs 写。
import type { RouteEnv } from '../routes'
import type { Req, Res } from '../services'
import type { Entry } from '../../shared/contract'

const MAX_READ = 1_000_000
const MAX_SEARCH_NODES = 4000
const MAX_SEARCH_MATCHES = 300

function toEntry(fs: NonNullable<RouteEnv['deps']['fs']>, e: any): Entry {
  return {
    name: e.name,
    type: e.type,
    size: typeof e.size === 'number' ? e.size : null,
    path: fs.processPath(e.target),
  }
}

export async function listOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const path = env.param(req, 'path')
  if (!path) return env.send(res, 400, { error: '缺少路径' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const target = await fs.resolve(path)
    const info = await fs.stat(target)
    if (info === undefined || info.type !== 'directory') {
      env.send(res, 404, { error: '不是目录' })
      return
    }
    const entries = await fs.listDir(target)
    env.send(res, 200, { entries: entries.map((e) => toEntry(fs, e)) })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}

export async function searchOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const root = env.param(req, 'root')
  const q = String(env.param(req, 'q') || '').toLowerCase().trim()
  if (!root || !q) {
    env.send(res, 200, { matches: [], truncated: false })
    return
  }
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    let nodes = 0
    const matches: Entry[] = []
    const stack: string[] = [root]
    let truncated = false
    while (stack.length > 0 && nodes < MAX_SEARCH_NODES && matches.length < MAX_SEARCH_MATCHES) {
      const dir = stack.pop()!
      let target: unknown
      try {
        target = await fs.resolve(dir)
      } catch {
        continue
      }
      let entries: any[]
      try {
        entries = await fs.listDir(target)
      } catch {
        continue
      }
      nodes += entries.length
      for (const e of entries) {
        const entry = toEntry(fs, e)
        if (e.type === 'directory') {
          if (e.name === '.git' || e.name === 'node_modules') continue
          stack.push(entry.path)
          if (e.name.toLowerCase().includes(q)) matches.push(entry)
        } else if (e.name.toLowerCase().includes(q)) {
          matches.push(entry)
        }
      }
    }
    if (nodes >= MAX_SEARCH_NODES || matches.length >= MAX_SEARCH_MATCHES) truncated = true
    env.send(res, 200, { matches, truncated })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}

export async function readOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const path = env.param(req, 'path')
  if (!path) return env.send(res, 400, { error: '缺少路径' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const target = await fs.resolve(path)
    const info = await fs.stat(target)
    if (info === undefined) {
      env.send(res, 404, { error: '文件不存在' })
      return
    }
    if (info.type !== 'file') {
      env.send(res, 400, { error: '不是文件' })
      return
    }
    const size = typeof info.size === 'number' ? info.size : 0
    if (size > MAX_READ) {
      env.send(res, 200, { tooLarge: true, size })
      return
    }
    const content = await fs.readText(target)
    env.send(res, 200, { content, size })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// 轻量变更签名（供自动刷新优化）：条目名 + 类型 + 大小聚合。见 DESIGN.md §7.8。
export async function versionOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const path = env.param(req, 'path')
  if (!path) return env.send(res, 400, { error: '缺少路径' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const target = await fs.resolve(path)
    const info = await fs.stat(target)
    if (info === undefined || info.type !== 'directory') {
      env.send(res, 404, { error: '不是目录' })
      return
    }
    const entries = await fs.listDir(target)
    const sig = entries.map((e) => e.name + '|' + e.type + '|' + e.size).join('\n')
    env.send(res, 200, { version: entries.length + ':' + hashString(sig) })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}
