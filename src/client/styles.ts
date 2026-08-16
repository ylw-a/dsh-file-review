// 样式挂载：styles.css（构建期以 text loader 内联为字符串）→ <style>，ctx.effect 卸载。
import cssText from './styles.css'

export function mountStyles(ctx: any): void {
  const styleEl = document.createElement('style')
  styleEl.textContent = cssText
  document.head.appendChild(styleEl)
  ctx.effect(() => () => { styleEl.remove() }, 'file-explorer: styles')
}
