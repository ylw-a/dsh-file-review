// client 半部入口：只做四件事（样式 / slot 注册 / 测量与键盘 / 自动刷新）。
// 产物被 scripts/build.mjs 打包成 CJS 并套上 __ModuleLoader__.load 包装，最终导出 { apply, inject }。
import { mountStyles } from './styles'
import { registerSlots } from './slots'
import { startMeasureLoop, startEditorKeys } from './measure'
import { startAutoRefresh } from './autoRefresh'

export const inject = ['slots']

export function apply(ctx: any): void {
  mountStyles(ctx)
  const slots = ctx.get('slots')
  if (slots === undefined) return
  registerSlots(ctx)
  startMeasureLoop(ctx)
  startEditorKeys(ctx)
  startAutoRefresh(ctx)
}
