// host 半部入口：name/inject/apply，装配一切。见 DESIGN.md §7.1。
import { createServices } from './services'
import { registerRoutes } from './routes'

export const name = 'file-explorer'
export const inject = ['fs']

export function apply(ctx: any): void {
  const deps = createServices(ctx)

  let registered = false
  const register = (): void => {
    if (registered) return
    if (deps.webServer === undefined) return
    registered = true
    registerRoutes(ctx, deps)
  }

  register()
  ctx.on('internal/service', (name: string) => {
    if (name === 'webServer' || name === 'httpServer') register()
  })
}
