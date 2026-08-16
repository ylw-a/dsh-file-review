// 写操作：write / create / mkdir / rename。铁律：直接 node:fs/promises，不过 DSH 沙箱。
import * as nodeFs from 'node:fs/promises'
import * as nodePath from 'node:path'
import type { RouteEnv } from '../routes'
import type { Req, Res } from '../services'
import { absTarget, exists, validName } from '../paths'

export async function writeOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const body = await env.readJson(req, res)
  if (body === null) return
  const path = String(body?.path || '')
  if (!path) return env.send(res, 400, { error: '缺少路径' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const abs = await absTarget(fs, path)
    await nodeFs.writeFile(abs, String(body?.content ?? ''), 'utf8')
    env.send(res, 200, { ok: true })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}

export async function createOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const body = await env.readJson(req, res)
  if (body === null) return
  const parent = String(body?.parent || '')
  const name = validName(body?.name)
  if (!parent || !name) return env.send(res, 400, { error: '缺少父目录或名称无效' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const parentPath = await absTarget(fs, parent)
    await nodeFs.writeFile(nodePath.join(parentPath, name), '', { flag: 'wx' })
    env.send(res, 200, { ok: true })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}

export async function mkdirOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const body = await env.readJson(req, res)
  if (body === null) return
  const parent = String(body?.parent || '')
  const name = validName(body?.name)
  if (!parent || !name) return env.send(res, 400, { error: '缺少父目录或名称无效' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const parentPath = await absTarget(fs, parent)
    await nodeFs.mkdir(nodePath.join(parentPath, name))
    env.send(res, 200, { ok: true })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}

export async function renameOp(env: RouteEnv, req: Req, res: Res): Promise<void> {
  const body = await env.readJson(req, res)
  if (body === null) return
  const path = String(body?.path || '')
  const name = validName(body?.name)
  if (!path || !name) return env.send(res, 400, { error: '缺少路径或名称无效' })
  const fs = env.deps.fs
  if (fs === undefined) return env.send(res, 500, { error: '缺少 fs 服务' })
  try {
    const src = await absTarget(fs, path)
    const dest = nodePath.join(nodePath.dirname(src), name)
    if (dest !== src && (await exists(dest))) {
      env.send(res, 409, { error: '目标名称已存在' })
      return
    }
    await nodeFs.rename(src, dest)
    env.send(res, 200, { ok: true, path: dest })
  } catch (err) {
    env.send(res, 500, { error: env.message(err) })
  }
}
