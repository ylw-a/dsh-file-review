// 外部模块 / 全局对象的本地声明（供 IDE 与 tsc --noEmit 使用；构建由 esbuild 完成，不打类型）。
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export const MarkdownText: (props: { text: string; streaming?: boolean }) => React.JSX.Element
}

declare module '*.css' {
  const content: string
  export default content
}

interface Window {
  __ModuleLoader__: {
    load(opts: { id: string; factory: (require: (id: string) => any) => any }): void
  }
}
