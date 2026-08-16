// copy / move：含 (2) 去重与跨设备 rename 兜底。见 DESIGN.md §7.5。
import * as nodeFs from 'node:fs/promises'
import * as nodePath from 'node:path'
import type { RouteEnv } from '../routes'
import type { Req, Res } from '../services'
import { absTarget, uniquePath } from '../paths'

async function copyRecursive(src: string, dest: string): Promise<void> {
  const st = await nodeFs.stat(src)
  if (st.isDirectory()) {
    await nodeFs.mkdir(dest, { recursive: true })
    const entries = await nodeFs.readdir(src, { withFileTypes: true })
    for (const e of entries) {
      await copyRecursive(nodePath.join(src, e.name), nodePath.join(dest, e.name))
    }
  } else {
    await nodeFs.copyFile(src, dest)
  }
}

async function moveRecursive(src: string, dest: string): Promise<void> {
  try {
    await nodeFs.rename(src, dest)
  } catch (err: any) {
    // 跨设备（或非原子）rename：复制后删除。
    if (err && (err.code === 'EXDEV' || err.code === 'EPERM')) {
      await copyRecursive(src, dest)
      await nodeFs.rm(src, { recursive: true, force: true })
    } else {
      throw err
    }
  }
}

async function runPair(
  env: RouteEnv,
  req: Req,
  res: Res,
  kind: 'copy' | 'move',
): Promise<void> {
  const body = await env.readJson(req, res)
  if (body === null) return
  const source = String(body?.source || '')
  const targetDir = String(body?.targetDir || '')
  if (!source || !targetDir) return env.send(res, 400, { error: '缺少来源或目标目录' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const srcPath = await absTarget(fs, source)
    const dstDir = await absTarget(fs, targetDir)
    const dest = await uniquePath(nodePath.join(dstDir, nodePath.basename(srcPath)))
    if (kind === 'copy') await copyRecursive(srcPath, dest)
    else await moveRecursive(srcPath, dest)
    env.send(res, 200, { ok: true, path: dest })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}

export function copyOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  return runPair(env, req, res, 'copy')
}

export function moveOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  return runPair(env, req, res, 'move')
}
