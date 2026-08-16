// 平台对接层：把 host 半部需要的 DSH 服务统一收拢到一处，全部用 ctx.get 判空降级。
// 铁律：host 只做「文件系统 / 进程 / 网络」，ops 不得直接碰 ctx。

// DSH 抽象文件服务（@deepseek-ai/dsh-fs*），接口见 DESIGN.md 附录 A。
export interface FsService {
  resolve(path: string): Promise<unknown>
  processPath(target: unknown): string
  stat(target: unknown): Promise<{ type: 'file' | 'directory'; size: number } | undefined>
  listDir(target: unknown): Promise<Array<{ name: string; type: 'file' | 'directory'; size: number | null; target: unknown }>>
  readText(target: unknown): Promise<string>
}

// Node 风格的 HTTP 请求 / 响应（webServer handler 签名，见 DESIGN.md 附录 A）。
export interface Req {
  method?: string
  url?: string
  [Symbol.asyncIterator](): AsyncIterator<Buffer>
}
export interface Res {
  writeHead(status: number, headers: Record<string, string>): void
  end(body: string): void
}

// webServer 注册（register 返回 disposer）。
export interface WebServer {
  register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req: Req, res: Res) => void | Promise<void> }): () => void
}

// 子进程服务（@deepseek-ai/dsh-subprocess-local）。
export interface Subprocess {
  resolveExecutable(name: string): Promise<string | null>
  spawn(spec: {
    argv: string[]
    cwd?: string
    stdio?: unknown
    graceMs?: number
  }): { done: Promise<{ exitCode: number }> }
}

// bash shell 服务（非 PowerShell）。
export interface Shell {
  resolve(spec: { command: string; timeoutMs?: number }): unknown
  run(spec: unknown): Promise<{ exitCode: number }>
}

export interface Services {
  fs: FsService | undefined
  webServer: WebServer | undefined
  subprocess: Subprocess | undefined
  shell: Shell | undefined
}

// 注意：字段必须是 getter（每次访问重新 ctx.get）。webServer/subprocess/shell 可能晚于
// apply 出现，一次性捕获会让 deps 里的值停留在 undefined，导致注册/调用失败。
export function createServices(ctx: any): Services {
  return {
    get fs() { return ctx.get('fs') },
    get webServer() { return ctx.get('webServer') ?? ctx.get('httpServer') },
    get subprocess() { return ctx.get('subprocess') },
    get shell() { return ctx.get('shell') },
  }
}
