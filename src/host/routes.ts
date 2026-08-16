// 路由注册 + JSON 助手（send / readJson / param）。ops 只通过 RouteEnv 访问这些助手。
import { ROUTES } from '../shared/contract'
import type { Services, Req, Res } from './services'
import { listOp, searchOp, readOp, versionOp } from './ops/read'
import { writeOp, createOp, mkdirOp, renameOp } from './ops/write'
import { copyOp, moveOp } from './ops/copy-move'
import { deleteOp } from './ops/delete'
import { openVscodeOp } from './ops/open-vscode'

export interface RouteEnv {
  deps: Services
  send(res: Res, status: number, obj: unknown): void
  readJson(req: Req, res: Res): Promise<any | null>
  param(req: Req, key: string): string | null
  message(err: unknown): string
}

export function registerRoutes(ctx: any, deps: Services): void {
  const webServer = deps.webServer
  if (webServer === undefined) return

  const message = (err: unknown): string => String((err as any)?.message || err)

  const send = (res: Res, status: number, obj: unknown): void => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify(obj))
  }

  const readBody = async (req: Req): Promise<string> => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8')
  }

  const readJson = async (req: Req, res: Res): Promise<any | null> => {
    if (req.method !== 'POST') {
      send(res, 405, { error: '请使用 POST' })
      return null
    }
    try {
      return JSON.parse(await readBody(req))
    } catch {
      send(res, 400, { error: '请求体不是合法 JSON' })
      return null
    }
  }

  const param = (req: Req, key: string): string | null => {
    try {
      return new URL(req.url ?? '/', 'http://x').searchParams.get(key)
    } catch {
      return null
    }
  }

  const env: RouteEnv = { deps, send, readJson, param, message }

  // register 返回 disposer；包在 ctx.effect 里，卸载自动移除路由。
  const route = (path: string, handler: (req: Req, res: Res) => void | Promise<void>): void => {
    ctx.effect(() => webServer.register({ kind: 'exact', path, handler }), 'file-explorer: ' + path)
  }

  route(ROUTES.list, (req, res) => listOp(env, req, res))
  route(ROUTES.search, (req, res) => searchOp(env, req, res))
  route(ROUTES.read, (req, res) => readOp(env, req, res))
  route(ROUTES.version, (req, res) => versionOp(env, req, res))
  route(ROUTES.write, (req, res) => writeOp(env, req, res))
  route(ROUTES.create, (req, res) => createOp(env, req, res))
  route(ROUTES.mkdir, (req, res) => mkdirOp(env, req, res))
  route(ROUTES.rename, (req, res) => renameOp(env, req, res))
  route(ROUTES.copy, (req, res) => copyOp(env, req, res))
  route(ROUTES.move, (req, res) => moveOp(env, req, res))
  route(ROUTES.delete, (req, res) => deleteOp(env, req, res))
  route(ROUTES.openVscode, (req, res) => openVscodeOp(env, req, res))
}
