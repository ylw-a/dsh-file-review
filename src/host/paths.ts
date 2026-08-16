// 路径安全：先把客户端路径解析成规范绝对路径，之后才可用 node:fs。
import * as nodeFs from 'node:fs/promises'
import * as nodePath from 'node:path'
import type { FsService } from './services'

// 客户端路径 → 规范绝对路径（走 DSH fs 抽象，拿到执行世界的真实路径）。
export async function absTarget(fs: FsService, path: string): Promise<string> {
  const target = await fs.resolve(path)
  return fs.processPath(target)
}

export async function exists(p: string): Promise<boolean> {
  try {
    await nodeFs.stat(p)
    return true
  } catch {
    return false
  }
}

// 冲突时生成 "name (2)" / "name (3)" … 的首个空闲兄弟路径。
export async function uniquePath(p: string): Promise<string> {
  if (!(await exists(p))) return p
  const dir = nodePath.dirname(p)
  const ext = nodePath.extname(p)
  const base = nodePath.basename(p, ext)
  for (let i = 2; ; i++) {
    const cand = nodePath.join(dir, `${base} (${i})${ext}`)
    if (!(await exists(cand))) return cand
  }
}

// 校验单段名（rename / mkdir / create 用）：拒绝空、`.`/`..`、路径分隔与非法字符。
export function validName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const n = name.trim()
  if (!n || n === '.' || n === '..') return null
  if (/[\\/:*?"<>|]/.test(n)) return null
  return n
}
