// delete：文件 / 目录 → 回收站（PowerShell Microsoft.VisualBasic）。见 DESIGN.md §7.6。
import type { RouteEnv } from '../routes'
import type { Req, Res } from '../services'
import { recycleBinDelete } from '../recycle'

export async function deleteOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const body = await env.readJson(req, res)
  if (body === null) return
  const path = String(body?.path || '')
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
    const absPath = fs.processPath(target)
    const outcome = await recycleBinDelete(env.deps, absPath, info.type === 'directory')
    if (outcome.ok) env.send(res, 200, { ok: true })
    else env.send(res, 500, { error: outcome.error || '删除失败' })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}
