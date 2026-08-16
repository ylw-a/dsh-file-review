// 平台对接层：唯一注册 UI 的地方（4 处官方 slot，见 DESIGN.md §8.4 / §17.10）。
// conversation.view 的 inject 尝试捕获官方 setView；拿不到时 store.jumpToFile 保持 null，
// 跳转走 jumpToFileView 里的 DOM 点击兜底（分层降级，见 §10.3）。
import React from 'react'
import { mutate } from './store'
import { ExplorerPanel } from './components/ExplorerPanel'
import { EditorChrome } from './components/EditorChrome'
import { ToggleButton } from './components/ToggleButton'

// 已捕获的 setView（官方 actions.setView，仅「文件」页激活时注入；store-less 注册通常拿不到，
// 此时走 jumpToFileView 的 DOM 点击兜底）。用模块级标志避免每次渲染都 mutate。
let capturedSetView: ((viewId: string) => void) | null = null

export function registerSlots(ctx: any): void {
  const slots = ctx.get('slots')
  if (slots === undefined) return

  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'file-explorer', order: 90, label: '文件资源管理器' },
    (props: any) => React.createElement(ExplorerPanel, props),
  ))

  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'file-explorer-toggle', order: 10, label: '文件资源管理器' },
    (props: any) => React.createElement(ToggleButton, props),
  ))

  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'file-editor', order: 91, label: '文件编辑器' },
    () => React.createElement(EditorChrome, { floatMode: true }),
  ))

  slots.inject('conversation.view', () => slots.register(
    {
      name: 'conversation.view',
      id: 'file-explorer',
      order: 20,
      label: '文件',
      inject: (sessionId: string, actions: any) => ({ setView: actions?.setView }),
    },
    (props: any) => {
      const sv = props?.setView
      if (sv && sv !== capturedSetView) {
        capturedSetView = sv
        // 延迟到渲染相位之外再写 store，避免渲染期 mutate
        queueMicrotask(() => mutate((s) => { s.jumpToFile = capturedSetView }))
      }
      return React.createElement(EditorChrome, { floatMode: false })
    },
  ))
}
