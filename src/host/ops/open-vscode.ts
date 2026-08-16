// open-vscode：文件 / 目录在 VS Code 中打开。见 DESIGN.md §7.7。
import type { RouteEnv } from '../routes'
import type { Req, Res } from '../services'
import { openInVscode } from '../vscode'

export async function openVscodeOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const body = await env.readJson(req, res)
  if (body === null) return
  const path = String(body?.path || '')
  if (!path) return env.send(res, 400, { error: '缺少路径' })
  try {
    const outcome = await openInVscode(env.deps, path)
    if (outcome.ok) env.send(res, 200, { ok: true })
    else env.send(res, 200, { ok: false, error: outcome.error })
  } catch (err) {
    env.send(res, 500, { ok: false, error: env.message(err) })
  }
}
